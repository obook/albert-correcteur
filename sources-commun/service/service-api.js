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
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* Délai maximal d'attente d'une réponse de l'API. Sans cette limite, une
   requête acceptée mais jamais servie laisse le badge en chargement
   pendant plusieurs minutes (timeout TCP du navigateur). */
const API_TIMEOUT_MS = 30000;

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
  /* fetch signale une panne réseau par une TypeError. */
  if (err.name === "TypeError") return `Erreur réseau : ${err.message}`;
  return err.message || "Erreur inconnue.";
}

/**
 * Envoie un texte à l'API Albert pour correction ou reformulation.
 *
 * @param {string} text       - Texte à vérifier.
 * @param {string} mode       - Mode : "correction" ou "reformulation".
 * @param {string} [personaId] - Id de persona (mode reformulation
 *                               uniquement, défaut : "neutre").
 * @returns {Promise<{corrections?: Array, lang?: string, error?: string}>}
 */
async function checkText(text, mode, personaId) {
  const config = await loadConfig();
  if (!config.apiKey) {
    return {
      error: "Clé API non configurée. "
        + "Cliquez sur l'icône Albert pour la configurer."
    };
  }

  const lang = detectLanguage(text);

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

    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

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
      return { error: `Erreur API (${response.status}). Voir la console du service worker pour le détail.` };
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
       ou un length qui ne correspond pas exactement au champ "word". */
    for (const c of parsed.corrections) {
      if (!c.word || typeof c.offset !== "number") continue;
      const atOffset = text.slice(c.offset, c.offset + c.word.length);
      if (atOffset === c.word) {
        /* Le word est bien à l'offset indiqué : fiabiliser le length */
        c.length = c.word.length;
      } else {
        /* Chercher le word dans le texte, occurrence la plus proche */
        let bestIdx = -1;
        let from = 0;
        while (from < text.length) {
          const idx = text.indexOf(c.word, from);
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

    /* Coercer chaque suggestion en chaîne. Les petits modèles renvoient
       parfois un objet (ex. { text: "..." }, { reformulation: "..." })
       au lieu d'une chaîne, ce qui produit "[object Object]" côté UI.
       On essaie d'abord les clés connues, puis on tombe sur la
       première propriété chaînée non vide trouvée. */
    const coerceSuggestion = (s) => {
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
    };

    /* Filtrer les suggestions incorrectes */
    const apiCorrections = (parsed.corrections || []).map((c) => {
      if (Array.isArray(c.suggestions)) {
        c.suggestions = c.suggestions
          .map(coerceSuggestion)
          .filter((s) => s !== null);
      }
      if (c.suggestions && c.word) {
        c.suggestions = c.suggestions.filter((s) => {
          /* Supprimer les suggestions identiques au mot erroné */
          if (s === c.word) return false;
          /*
           * Si le mot erroné finit par "s" (pluriel),
           * la suggestion doit aussi finir par "s"
           */
          if (c.word.endsWith("s") && !s.endsWith("s")) return false;
          return true;
        });
      }
      return c;
    }).filter((c) => !c.suggestions || c.suggestions.length > 0);

    /* Fusionner avec les corrections détectées localement par regex
       (filet de sécurité pour les patterns mécaniques que les petits
       modèles ratent parfois, cf. regles-locales.js). */
    const localCorrections = (mode === "correction")
      ? findLocalCorrections(text)
      : [];
    const corrections = mergeCorrections(apiCorrections, localCorrections);
    return { corrections, lang };
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
  if (!config.apiKey) {
    return { error: "Clé API non configurée." };
  }

  const langSource = detectLanguage(text);

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
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
      return { error: `Erreur API (${response.status}). Voir la console du service worker pour le détail.` };
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
