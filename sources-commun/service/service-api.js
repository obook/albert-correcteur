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
 * Gestion des erreurs :
 *   - 429 (rate limit) : extraction du type de limite (rpm, rpd, tpm,
 *     tpd) depuis la réponse, lecture du Retry-After dans l'en-tête
 *     puis dans le corps (message Albert "Limit exceeded: 50 requests
 *     per minute") avec calcul d'un délai sûr en cas d'absence.
 *   - Auto-fallback de modèle : deux 429 consécutifs sur le modèle
 *     principal basculent automatiquement vers un modèle plus petit
 *     (large -> medium -> small) pendant 60 s.
 *   - Réponse invalide : message d'erreur explicite.
 *   - Erreur réseau : message avec err.message.
 *
 * Post-traitement des corrections :
 *   - Recalibrage des offsets (le LLM se trompe souvent).
 *   - Filtrage des suggestions identiques au mot erroné.
 *   - Filtrage des suggestions qui ne respectent pas le nombre
 *     (pluriel "s" manquant).
 *
 * Dépendances (chargées dans le même service worker) :
 *   - service-config.js   (loadConfig)
 *   - service-langue.js   (detectLanguage)
 *   - service-prompts.js  (buildPrompt, buildTranslationPrompt)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/*
 * --- Auto-fallback de modèle après 429 répétés ---
 *
 * Si le modèle principal renvoie deux 429 d'affilée, on bascule
 * automatiquement vers un modèle plus petit pendant 60 s avant de
 * retenter le principal. Inspiré de la stratégie d'AlbertCode, ça
 * évite à l'utilisateur de subir des erreurs en chaîne quand le
 * modèle large est saturé.
 */

const FALLBACK_TRIGGER_429 = 2;       // 429 consécutifs déclenchant le fallback
const FALLBACK_DURATION_MS = 60000;   // durée pendant laquelle le fallback reste actif

const FALLBACK_CHAIN = {
  "openweight-large": "openweight-medium",
  "openweight-medium": "openweight-small",
  "openai/gpt-oss-120b": "openweight-medium",
  "mistralai/mistral-small-3.2-24b-instruct-2506": "openweight-small",
};

const consecutive429 = new Map();
const fallbackUntil = new Map();

/**
 * Renvoie le modèle effectif à utiliser pour un appel.
 * Si le primaire est en fallback actif, retourne son fallback.
 *
 * @param {string} primary - Modèle configuré par l'utilisateur.
 * @returns {string}
 */
function selectEffectiveModel(primary) {
  const until = fallbackUntil.get(primary);
  if (until && until > Date.now()) {
    return FALLBACK_CHAIN[primary] || primary;
  }
  return primary;
}

/**
 * À appeler après un 429. Incrémente le compteur consécutif et,
 * si le seuil est atteint et qu'un fallback est connu, ouvre la
 * fenêtre de bascule.
 *
 * @param {string} primary - Modèle qui a échoué.
 */
function record429(primary) {
  if (!primary) return;
  const next = (consecutive429.get(primary) || 0) + 1;
  consecutive429.set(primary, next);
  const fallback = FALLBACK_CHAIN[primary];
  if (next >= FALLBACK_TRIGGER_429 && fallback) {
    fallbackUntil.set(primary, Date.now() + FALLBACK_DURATION_MS);
    consecutive429.set(primary, 0);
    console.info(
      `[Albert] Fallback ${primary} -> ${fallback} pendant `
      + `${FALLBACK_DURATION_MS / 1000}s (deux 429 consécutifs)`
    );
  }
}

/**
 * À appeler après un succès. Reset le compteur consécutif pour
 * que la prochaine série de 429 reparte de zéro.
 *
 * @param {string} primary - Modèle qui a réussi.
 */
function recordSuccess(primary) {
  if (!primary) return;
  consecutive429.delete(primary);
}

/**
 * Analyse une réponse 429 d'Albert et en extrait un délai de retry
 * exploitable.
 *
 * Trois sources, dans l'ordre de priorité :
 *   1. En-tête HTTP Retry-After (en secondes).
 *   2. Champ retry_after du corps JSON s'il existe (variantes Albert).
 *   3. Calcul depuis le message texte du type "Limit exceeded:
 *      50 requests per minute". Si on connaît la limite par minute,
 *      un délai sûr de 60 / N secondes (au moins 2 s) est calculé.
 *
 * Renvoie aussi le type de limite (rpm, rpd, tpm, tpd) repéré dans
 * le message, pour un libellé d'erreur plus précis.
 *
 * @param {Response} response - Réponse fetch ayant le statut 429.
 * @param {string}   detail   - Corps de la réponse, déjà lu en texte.
 * @returns {{retryAfter: number, limitType: string}}
 */
function parseRateLimit429(response, detail) {
  /* 1. Source la plus fiable : l'en-tête HTTP. */
  const headerValue = parseInt(response.headers.get("Retry-After"), 10);
  let retryAfter = headerValue > 0 ? headerValue : 0;

  /* 2/3. Parsing du corps JSON ou texte. */
  let limitType = "";
  let bodyMessage = "";
  try {
    const err = JSON.parse(detail);
    bodyMessage = (err.detail || err.message || "").toString();
    /* Albert peut renvoyer un retry_after explicite dans certaines variantes */
    if (!retryAfter && typeof err.retry_after === "number"
      && err.retry_after > 0) {
      retryAfter = Math.ceil(err.retry_after);
    }
  } catch {
    /* Réponse non-JSON : on garde le texte brut */
    bodyMessage = detail || "";
  }

  const lower = bodyMessage.toLowerCase();
  if (lower.includes("rpm") || lower.includes("requests per minute")) {
    limitType = "requêtes/minute (rpm)";
  } else if (lower.includes("rpd") || lower.includes("requests per day")) {
    limitType = "requêtes/jour (rpd)";
  } else if (lower.includes("tpm") || lower.includes("tokens per minute")) {
    limitType = "tokens/minute (tpm)";
  } else if (lower.includes("tpd") || lower.includes("tokens per day")) {
    limitType = "tokens/jour (tpd)";
  }

  /* 3. Pas d'en-tête : tenter d'extraire la limite documentée du message
        ("50 requests per minute") pour calculer un délai raisonnable. */
  if (!retryAfter) {
    const match = lower.match(
      /(\d+)\s+(?:requests|tokens)\s+per\s+(minute|day)/
    );
    if (match) {
      const limit = parseInt(match[1], 10);
      const window = match[2] === "minute" ? 60 : 86400;
      /* Délai sûr : un slot complet de la fenêtre, borné à [2s, fenêtre] */
      if (limit > 0) {
        retryAfter = Math.min(window, Math.max(2, Math.ceil(window / limit)));
      }
    }
  }

  /* Filet de sécurité : 30 s si rien n'a marché. */
  if (!retryAfter) retryAfter = 30;

  return { retryAfter, limitType };
}

/**
 * Envoie un texte à l'API Albert pour correction ou reformulation.
 *
 * @param {string} text - Texte à vérifier.
 * @param {string} mode - Mode : "correction" ou "reformulation".
 * @returns {Promise<{corrections?: Array, lang?: string, error?: string}>}
 */
async function checkText(text, mode) {
  const config = await loadConfig();
  if (!config.apiKey) {
    return {
      error: "Clé API non configurée. "
        + "Cliquez sur l'icône Albert pour la configurer."
    };
  }

  const lang = detectLanguage(text);
  const systemPrompt = await buildPrompt(mode, lang);

  try {
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
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        record429(config.model);
        const { retryAfter, limitType } = parseRateLimit429(response, detail);
        const desc = limitType
          ? `Limite ${limitType} dépassée.`
          : "Limite de débit dépassée.";
        return {
          error: `${desc} Pause de ${retryAfter}s.`,
          retryAfter
        };
      }
      return { error: `Erreur API (${response.status}) : ${detail}` };
    }

    recordSuccess(config.model);
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (!Array.isArray(parsed.corrections)) {
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

    /* Filtrer les suggestions incorrectes */
    const corrections = (parsed.corrections || []).map((c) => {
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
    return { corrections, lang };
  } catch (err) {
    return { error: `Erreur réseau : ${err.message}` };
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
  const systemPrompt =
    await buildTranslationPrompt(langSource, targetLang);

  try {
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
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        record429(config.model);
        const { retryAfter, limitType } = parseRateLimit429(response, detail);
        const desc = limitType
          ? `Limite ${limitType} dépassée.`
          : "Limite de débit dépassée.";
        return {
          error: `${desc} Pause de ${retryAfter}s.`,
          retryAfter
        };
      }
      return { error: `Erreur API (${response.status}) : ${detail}` };
    }

    recordSuccess(config.model);
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (typeof parsed.translation !== "string") {
      return { error: "Réponse API invalide : traduction manquante." };
    }
    return {
      translation: parsed.translation,
      langSource,
      langCible: targetLang
    };
  } catch (err) {
    return { error: `Erreur réseau : ${err.message}` };
  }
}
