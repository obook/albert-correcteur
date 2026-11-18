/*
 * service-api.js - Appels à l'API Albert (correction, reformulation, traduction).
 *
 * Ce script s'exécute dans le service worker (background script) et
 * contient les deux fonctions d'appel à l'API :
 *
 * 1. checkText(text, mode) :
 *    Envoie le texte à l'API /v1/chat/completions avec un prompt
 *    système adapté au mode (correction ou reformulation).
 *    Retourne un tableau de corrections avec offsets recalibrés.
 *
 * 2. translateText(text, targetLang) :
 *    Envoie le texte à l'API avec un prompt de traduction.
 *    Retourne la traduction et les langues source/cible.
 *
 * Post-traitement des corrections (mode correction uniquement) :
 *   - Recalibrage des offsets (le LLM se trompe souvent).
 *   - Filtrage des suggestions identiques au mot erroné.
 *   - Filtrage des suggestions qui ne respectent pas le nombre
 *     (pluriel "s" manquant).
 *   - Fusion avec les corrections produites par regex locale.
 *
 * Dépendances (chargées dans le même service worker) :
 *   - service-config.js     (loadConfig)
 *   - service-langue.js     (detectLanguage)
 *   - service-prompts.js    (buildPrompt, buildTranslationPrompt)
 *   - service-fallback.js   (selectEffectiveModel, record429, recordSuccess)
 *   - service-rate-limit.js (parseRateLimit429)
 *   - regles-locales.js     (findLocalCorrections, mergeCorrections)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* Délai maximal d'attente d'une réponse de l'API. Sans cette limite, une
   requête acceptée mais jamais servie laisse le badge en chargement
   pendant plusieurs minutes (timeout TCP du navigateur).
   300 s et non 30 : openweight-large dépasse régulièrement 30 s, et la
   valeur s'aligne sur ALBERT_TIMEOUT_SECS de llm-proxy pour que le
   client n'abandonne pas pendant que le proxy attend encore. */
const API_TIMEOUT_MS = 300000;

/* Page d'état publiée par l'équipe Albert (pannes, maintenances). */
const ALBERT_STATUS_URL = "https://albert.status.etalab.gouv.fr/";

const ALBERT_INJOIGNABLE = "Albert est injoignable (panne ou maintenance). "
  + `État du service : ${ALBERT_STATUS_URL}`;

/**
 * Traduit un statut HTTP d'erreur en message affichable.
 *
 * Un 5xx vient d'Albert ou du proxy placé devant lui (llm-proxy répond
 * 500 quand Albert est arrêté) : l'utilisateur n'y peut rien, on le
 * renvoie vers la page d'état. Un 404 vise le modèle demandé.
 *
 * @param {number} status - Statut HTTP de la réponse.
 * @param {string} model  - Modèle demandé.
 * @returns {string} Message destiné à l'utilisateur.
 */
function messageErreurHttp(status, model) {
  if (status === 502 || status === 503 || status === 504) return ALBERT_INJOIGNABLE;
  if (status >= 500) {
    return `Erreur d'Albert (${status}), peut-être une panne ou une maintenance. `
      + `État du service : ${ALBERT_STATUS_URL}`;
  }
  if (status === 404) {
    return `Le modèle ${model} est introuvable ou indisponible. `
      + "Choisissez un autre modèle dans la configuration d'Albert.";
  }
  return `Erreur API (${status}). Voir la console du service worker pour le détail.`;
}

/**
 * Traduit une exception en message affichable par l'utilisateur.
 *
 * @param {Error} err - Exception levée pendant l'appel.
 * @returns {string} Message destiné à l'utilisateur.
 */
function messageErreurReseau(err) {
  if (!err) return "Erreur inconnue.";
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    return "Délai dépassé : l'API Albert n'a pas répondu en "
      + (API_TIMEOUT_MS / 1000) + " secondes.";
  }
  /* fetch signale une panne réseau par une TypeError : réseau coupé,
     ou Albert arrêté (maintenance). */
  if (err.name === "TypeError") return ALBERT_INJOIGNABLE;
  return err.message || "Erreur inconnue.";
}

/**
 * Ramène une suggestion à une chaîne.
 *
 * Les petits modèles renvoient parfois un objet (ex. { text: "..." },
 * { reformulation: "..." }) au lieu d'une chaîne, ce qui produit
 * "[object Object]" côté interface. On essaie d'abord les clés connues,
 * puis on tombe sur la première propriété chaînée non vide trouvée.
 *
 * @param {*} s - Suggestion telle que le modèle l'a renvoyée.
 * @returns {string|null} Suggestion utilisable, ou null.
 */
function coerceSuggestion(s) {
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    const knownKeys = ["text", "suggestion", "content", "value",
      "reformulation", "rephrasing", "rephrased", "output"];
    for (const key of knownKeys) {
      if (typeof s[key] === "string" && s[key].length > 0) return s[key];
    }
    /* Dernier recours : prendre la première propriété chaînée non vide. */
    for (const v of Object.values(s)) {
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return null;
}

/**
 * Nettoie les suggestions d'une liste de corrections.
 *
 * Une suggestion identique au mot erroné ne corrige rien : elle est
 * retirée, et une correction qui n'a plus de suggestion est écartée.
 *
 * Une seconde règle exigeait qu'une suggestion garde le "s" final du mot
 * erroné, pour empêcher un modèle de dépluraliser à tort. Elle partait du
 * principe qu'un mot terminé par "s" est un pluriel et que la forme
 * corrigée finit forcément par "s" elle aussi : les deux sont faux. Elle
 * rendait indétectables, sans rien dire ni dans la console ni dans le
 * badge :
 *   - les pluriels en -aux, -eux, -oux : "chevals" pour "chevaux",
 *     "journals" pour "journaux", "travails" pour "travaux" ;
 *   - les composés à second élément invariable : "timbres-postes" pour
 *     "timbres-poste", "pommes de terres" ;
 *   - les mots invariables mal orthographiés : "parmis", "malgrés",
 *     "beaucoups".
 * Une suggestion douteuse s'ignore d'un clic, une faute jamais signalée ne
 * se rattrape pas.
 *
 * @param {Array<Object>} corrections - Corrections renvoyées par l'API.
 * @returns {Array<Object>} Corrections dont les suggestions sont utilisables.
 */
function nettoyerSuggestions(corrections) {
  return corrections.map((c) => {
    if (Array.isArray(c.suggestions)) {
      c.suggestions = c.suggestions
        .map(coerceSuggestion)
        .filter((s) => s !== null);
    }
    if (c.suggestions && c.word) {
      c.suggestions = c.suggestions.filter((s) => s !== c.word);
    }
    return c;
  }).filter((c) => !c.suggestions || c.suggestions.length > 0);
}

/**
 * Construit les en-têtes d'un appel à l'API.
 *
 * L'en-tête Authorization n'est posé que si une clé est configurée : un
 * endpoint local (llm-proxy, Ollama, LM Studio) n'en demande pas, et un
 * "Bearer " vide lui ferait refuser la requête.
 *
 * @param {{apiKey: string}} config - Configuration chargée.
 * @returns {Object} En-têtes de la requête.
 */
function enteteApi(config) {
  const entetes = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) entetes.Authorization = `Bearer ${config.apiKey}`;
  return entetes;
}

/**
 * Envoie un texte à l'API Albert pour correction ou reformulation.
 *
 * @param {string} text       - Texte à vérifier.
 * @param {string} mode       - Mode : "correction" ou "reformulation".
 * @param {string} [personaId] - Id de persona (mode reformulation
 *                               uniquement, défaut : "neutre").
 * @param {?string} [langue]   - Langue imposée pour ce champ (fr, en, es,
 *                               de) ; absente : langue des paramètres.
 * @returns {Promise<{corrections?: Array, lang?: string, error?: string}>}
 */
async function checkText(text, mode, personaId, langue) {
  const config = await loadConfig();
  /* La clé est facultative (un endpoint local n'en demande pas), mais
     un modèle enregistré prouve que la configuration a été faite. */
  if (!config.model) {
    return {
      error: "Albert n'est pas configuré. "
        + "Cliquez sur l'icône Albert pour le configurer."
    };
  }

  /* Priorité : langue choisie dans la popup pour ce champ, puis langue
     par défaut des paramètres, puis détection. Sur un texte court,
     detectLanguage retombe sur "fr" et le modèle traduit les suggestions
     au lieu de corriger, d'où ces deux surcharges. */
  const langueChoisie = LANG_NAMES[langue] ? langue : config.langue;
  const lang = langueChoisie === "auto" ? detectLanguage(text) : langueChoisie;

  try {
    /* Dans le try : le chargement du prompt échoue si le fichier est
       absent, et l'erreur doit remonter à l'utilisateur plutôt que de
       partir en rejet non géré du service worker. */
    const systemPrompt = await buildPrompt(mode, lang, config.model, personaId);
    const effectiveModel = selectEffectiveModel(config.model);
    const body = {
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    };
    /* gpt-oss-120b raisonne avant de répondre : à l'effort par défaut,
       une correction prend 20 s et plus. Une correction n'a pas besoin
       d'un long raisonnement. */
    if (effectiveModel === "openweight-large") body.reasoning_effort = "low";

    const envoyer = () => fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: enteteApi(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const debut = Date.now();
    let response = await envoyer();

    /* Paramètre refusé par le serveur : retenter sans, plutôt que de
       priver l'utilisateur de correction. */
    if ((response.status === 400 || response.status === 422)
      && body.reasoning_effort) {
      AlbertLog.warn("checkText: reasoning_effort refusé (" + response.status + "), nouvel essai sans");
      delete body.reasoning_effort;
      response = await envoyer();
    }

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        record429(config.model);
        const { retryAfter, limitType, message } = parseRateLimit429(response, detail);
        AlbertLog.warn("checkText:", mode, "429 (" + (limitType || "rate") + "), pause", retryAfter + "s");
        return { error: message, retryAfter };
      }
      if (response.status === 401 || response.status === 403) {
        AlbertLog.error("checkText:", mode, "API", response.status, "-", detail.slice(0, 500));
        return { error: `Clé API invalide ou non autorisée (${response.status}). Cliquez sur l'icône Albert pour vérifier la clé.` };
      }
      AlbertLog.error("checkText:", mode, "API", response.status, "-", detail.slice(0, 500));
      return { error: messageErreurHttp(response.status, effectiveModel) };
    }

    recordSuccess(config.model);
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      AlbertLog.error("checkText:", mode, "réponse API sans contenu, data=", data);
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      AlbertLog.error("checkText:", mode, "JSON malformé:", err && err.message,
        "rawContent=", rawContent.slice(0, 500));
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (!Array.isArray(parsed.corrections)) {
      AlbertLog.error("checkText:", mode, "corrections manquantes, parsed=", parsed);
      return { error: "Réponse API invalide : corrections manquantes." };
    }
    /* Recalibrer les offsets : certains modèles retournent un offset
       ou un length qui ne correspond pas exactement au champ "word".
       Comparaison et recherche sur des copies normalisées : le texte
       vient de innerText et garde ses espaces insécables, que le modèle
       rend en espaces ordinaires. La substitution valant un caractère
       pour un, les offsets obtenus valent pour text (util/blancs.js). */
    const texteNorme = normaliserBlancs(text);
    for (const c of parsed.corrections) {
      if (!c.word || typeof c.offset !== "number") continue;
      const mot = normaliserBlancs(c.word);
      const atOffset = texteNorme.slice(c.offset, c.offset + mot.length);
      if (atOffset === mot) {
        /* Le word est bien à l'offset indiqué : fiabiliser le length */
        c.length = c.word.length;
      } else {
        /* Chercher le word dans le texte, occurrence la plus proche */
        let bestIdx = -1;
        let from = 0;
        while (from < texteNorme.length) {
          const idx = texteNorme.indexOf(mot, from);
          if (idx === -1) break;
          if (bestIdx === -1
            || Math.abs(idx - c.offset) < Math.abs(bestIdx - c.offset)) {
            bestIdx = idx;
          }
          from = idx + 1;
        }
        if (bestIdx !== -1) {
          c.offset = bestIdx;
          c.length = c.word.length;
        }
      }
    }

    const apiCorrections = nettoyerSuggestions(parsed.corrections);

    /* Fusionner avec les corrections détectées localement par regex
       (filet de sécurité pour les patterns mécaniques que les petits
       modèles ratent parfois, cf. regles-locales.js). */
    const localCorrections = (mode === "correction")
      ? findLocalCorrections(text)
      : [];
    const corrections = mergeCorrections(apiCorrections, localCorrections);
    /* Durée de l'appel, affichée dans l'infobulle du badge : l'attente
       vient presque toujours du modèle, pas de l'extension. */
    return { corrections, lang, duree: Date.now() - debut };
  } catch (err) {
    AlbertLog.error("checkText:", mode, "exception:", err);
    return { error: messageErreurReseau(err) };
  }
}

/**
 * Traduit un texte via l'API Albert.
 *
 * @param {string} text       - Texte à traduire.
 * @param {string} targetLang - Code langue cible (fr, en, es, de).
 * @returns {Promise<{translation?: string, langSource?: string, error?: string}>}
 */
async function translateText(text, targetLang) {
  const config = await loadConfig();
  if (!config.model) {
    return { error: "Albert n'est pas configuré." };
  }

  /* null sous le seuil : le "fr" par défaut ferait passer un texte
     court non reconnu pour déjà traduit vers le français. */
  const langSource = detectLanguage(text, null);

  /* Texte déjà dans la langue cible : le prompt, rédigé en français,
     poussait les petits modèles à le traduire en français. */
  if (langSource === targetLang) {
    return { translation: text, langSource, langCible: targetLang };
  }

  try {
    const systemPrompt = await buildTranslationPrompt(langSource, targetLang);
    const effectiveModel = selectEffectiveModel(config.model);
    const body = {
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    };

    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: enteteApi(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        record429(config.model);
        const { retryAfter, limitType, message } = parseRateLimit429(response, detail);
        AlbertLog.warn("translateText: 429 (" + (limitType || "rate") + "), pause", retryAfter + "s");
        return { error: message, retryAfter };
      }
      if (response.status === 401 || response.status === 403) {
        AlbertLog.error("translateText: API", response.status, "-", detail.slice(0, 500));
        return { error: `Clé API invalide ou non autorisée (${response.status}). Cliquez sur l'icône Albert pour vérifier la clé.` };
      }
      AlbertLog.error("translateText: API", response.status, "-", detail.slice(0, 500));
      return { error: messageErreurHttp(response.status, effectiveModel) };
    }

    recordSuccess(config.model);
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      AlbertLog.error("translateText: réponse API sans contenu, data=", data);
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      AlbertLog.error("translateText: JSON malformé:", err && err.message,
        "rawContent=", rawContent.slice(0, 500));
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (typeof parsed.translation !== "string") {
      AlbertLog.error("translateText: traduction manquante, parsed=", parsed);
      return { error: "Réponse API invalide : traduction manquante." };
    }
    return {
      translation: parsed.translation,
      langSource,
      langCible: targetLang
    };
  } catch (err) {
    AlbertLog.error("translateText: exception:", err);
    return { error: messageErreurReseau(err) };
  }
}

/* Export pour les tests Node. Le service worker charge ce fichier comme
   un script classique, où module est indéfini. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { coerceSuggestion, nettoyerSuggestions, messageErreurHttp, messageErreurReseau };
}
