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
 *     tpd) depuis la réponse, retour du délai Retry-After.
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
 * Licence : EUPL-1.2
 */

"use strict";

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
    const body = {
      model: config.model,
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
        const retryAfter =
          parseInt(response.headers.get("Retry-After"), 10) || 30;
        /* Extraire le type de limite depuis la réponse API si disponible */
        let limitType = "";
        try {
          const err = JSON.parse(detail);
          const msg = (err.detail || err.message || "").toLowerCase();
          if (msg.includes("rpm")
            || msg.includes("requests per minute")) {
            limitType = "requêtes/minute (rpm)";
          } else if (msg.includes("rpd")
            || msg.includes("requests per day")) {
            limitType = "requêtes/jour (rpd)";
          } else if (msg.includes("tpm")
            || msg.includes("tokens per minute")) {
            limitType = "tokens/minute (tpm)";
          } else if (msg.includes("tpd")
            || msg.includes("tokens per day")) {
            limitType = "tokens/jour (tpd)";
          }
        } catch { /* réponse non-JSON */ }
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
    const body = {
      model: config.model,
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
        const retryAfter =
          parseInt(response.headers.get("Retry-After"), 10) || 30;
        return {
          error: `Limite de débit dépassée. Pause de ${retryAfter}s.`,
          retryAfter
        };
      }
      return { error: `Erreur API (${response.status}) : ${detail}` };
    }

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
