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

/*
 * Chaîne de fallback exprimée en alias serveur uniquement.
 *
 * Les ids canoniques (openai/gpt-oss-120b, etc.) sont normalisés en
 * alias par [[normalizeModelId]] dans service-config.js avant d'arriver
 * ici, donc cette table n'a besoin de couvrir que les alias.
 */
const FALLBACK_CHAIN = {
  "openweight-large": "openweight-medium",
  "openweight-medium": "openweight-small",
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

/* Plafond du délai pour une limite journalière : on retente au plus
   tard au bout d'une heure même si minuit UTC est plus éloigné, pour
   rester réactif si l'API a basculé le compte sur un autre palier. */
const DAILY_RETRY_CAP_S = 3600;

/**
 * Renvoie le nombre de secondes restant jusqu'au prochain minuit UTC.
 *
 * @returns {number}
 */
function secondsUntilNextUtcMidnight() {
  const now = Date.now();
  const d = new Date();
  const nextMidnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1
  );
  return Math.max(1, Math.ceil((nextMidnight - now) / 1000));
}

/**
 * Analyse une réponse 429 d'Albert et en extrait un délai de retry
 * exploitable ainsi qu'un message d'erreur prêt à afficher.
 *
 * Sources du délai, par ordre de priorité :
 *   1. En-tête HTTP Retry-After (en secondes).
 *   2. Champ retry_after du corps JSON (variantes Albert).
 *   3. Pour une limite à la minute, calcul depuis le message texte
 *      ("Limit exceeded: 50 requests per minute") : 60 / N secondes,
 *      borné à [2s, 60s].
 *   4. Pour une limite journalière (rpd, tpd), délai jusqu'au prochain
 *      minuit UTC (Albert réinitialise le quota à cet instant), plafonné
 *      à [[DAILY_RETRY_CAP_S]] pour rester réactif.
 *   5. Filet de sécurité : 30 s.
 *
 * @param {Response} response - Réponse fetch ayant le statut 429.
 * @param {string}   detail   - Corps de la réponse, déjà lu en texte.
 * @returns {{retryAfter: number, limitType: string, message: string}}
 */
function parseRateLimit429(response, detail) {
  const headerValue = parseInt(response.headers.get("Retry-After"), 10);
  let retryAfter = headerValue > 0 ? headerValue : 0;

  let limitType = "";
  let bodyMessage = "";
  try {
    const err = JSON.parse(detail);
    bodyMessage = (err.detail || err.message || "").toString();
    if (!retryAfter && typeof err.retry_after === "number"
      && err.retry_after > 0) {
      retryAfter = Math.ceil(err.retry_after);
    }
  } catch {
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

  const isDailyLimit = limitType.startsWith("requêtes/jour")
    || limitType.startsWith("tokens/jour");

  /* Limite à la minute : extraire le débit autorisé pour un délai sûr. */
  if (!retryAfter && !isDailyLimit) {
    const match = lower.match(
      /(\d+)\s+(?:requests|tokens)\s+per\s+minute/
    );
    if (match) {
      const limit = parseInt(match[1], 10);
      if (limit > 0) {
        retryAfter = Math.min(60, Math.max(2, Math.ceil(60 / limit)));
      }
    }
  }

  /* Limite journalière : aligner sur le reset minuit UTC, plafonné. */
  if (!retryAfter && isDailyLimit) {
    retryAfter = Math.min(secondsUntilNextUtcMidnight(), DAILY_RETRY_CAP_S);
  }

  if (!retryAfter) retryAfter = 30;

  const message = formatRateLimitMessage(limitType, retryAfter, isDailyLimit);
  return { retryAfter, limitType, message };
}

/**
 * Construit un message d'erreur lisible pour un 429.
 *
 * - Limite journalière : indique l'attente jusqu'au reset minuit UTC,
 *   avec l'heure locale approximative, plutôt qu'un compteur en secondes.
 * - Limite à la minute : indique la pause en secondes.
 * - Limite inconnue : message générique avec la pause en secondes.
 *
 * @param {string}  limitType    - Type de limite ou chaîne vide.
 * @param {number}  retryAfter   - Délai retenu, en secondes.
 * @param {boolean} isDailyLimit - Vrai si la limite est journalière.
 * @returns {string}
 */
function formatRateLimitMessage(limitType, retryAfter, isDailyLimit) {
  if (isDailyLimit) {
    const reset = new Date(Date.now() + secondsUntilNextUtcMidnight() * 1000);
    const hh = reset.getHours().toString().padStart(2, "0");
    const mm = reset.getMinutes().toString().padStart(2, "0");
    return `Quota ${limitType} épuisé. Réinitialisation à minuit UTC `
      + `(≈ ${hh}:${mm} heure locale).`;
  }
  if (limitType) {
    return `Limite ${limitType} dépassée. Pause de ${retryAfter}s.`;
  }
  return `Limite de débit dépassée. Pause de ${retryAfter}s.`;
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
  const systemPrompt = await buildPrompt(mode, lang, config.model);

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
        const { retryAfter, limitType, message } = parseRateLimit429(response, detail);
        AlbertLog.warn("checkText:", mode, "429 (" + (limitType || "rate") + "), pause", retryAfter + "s");
        return { error: message, retryAfter };
      }
      AlbertLog.error("checkText:", mode, "API", response.status, "-", detail.slice(0, 500));
      return { error: `Erreur API (${response.status}) : ${detail}` };
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

    /* Filtrer les suggestions incorrectes */
    const apiCorrections = (parsed.corrections || []).map((c) => {
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
        const { retryAfter, limitType, message } = parseRateLimit429(response, detail);
        AlbertLog.warn("translateText: 429 (" + (limitType || "rate") + "), pause", retryAfter + "s");
        return { error: message, retryAfter };
      }
      AlbertLog.error("translateText: API", response.status, "-", detail.slice(0, 500));
      return { error: `Erreur API (${response.status}) : ${detail}` };
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
    return { error: `Erreur réseau : ${err.message}` };
  }
}
