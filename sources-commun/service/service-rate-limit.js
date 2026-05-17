/*
 * service-rate-limit.js - Lecture et formatage des réponses 429 Albert.
 *
 * Albert renvoie un 429 quand un quota est dépassé (rpm, rpd, tpm, tpd).
 * Ce module en extrait deux informations :
 *   - retryAfter : combien de secondes attendre avant de retenter.
 *   - message    : un texte d'erreur prêt à afficher à l'utilisateur.
 *
 * Sources du délai, par ordre de priorité :
 *   1. En-tête HTTP Retry-After (en secondes).
 *   2. Champ retry_after du corps JSON (variantes Albert).
 *   3. Pour une limite à la minute, calcul depuis le message texte
 *      ("Limit exceeded: 50 requests per minute") : 60 / N secondes,
 *      borné à [2s, 60s].
 *   4. Pour une limite journalière (rpd, tpd), délai jusqu'au prochain
 *      minuit UTC (instant du reset Albert), plafonné à
 *      DAILY_RETRY_CAP_S pour rester réactif si l'API change de palier.
 *   5. Filet de sécurité : 30 s.
 *
 * API exposée :
 *   - parseRateLimit429(response, detail) : objet
 *     { retryAfter, limitType, message }.
 *
 * Auteur : O. Booklage
 * Date : Mai 2026
 * Licence : MIT
 */

"use strict";

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
 * Analyse une réponse 429 d'Albert et en extrait un délai de retry
 * exploitable ainsi qu'un message d'erreur prêt à afficher.
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

  /* On dérive isDailyLimit directement des marqueurs rpd/tpd plutôt que
     du libellé français, pour rester découplé du wording de limitType. */
  const lower = bodyMessage.toLowerCase();
  const isDailyLimit = lower.includes("rpd")
    || lower.includes("tpd")
    || lower.includes("requests per day")
    || lower.includes("tokens per day");
  if (lower.includes("rpm") || lower.includes("requests per minute")) {
    limitType = "requêtes/minute (rpm)";
  } else if (lower.includes("rpd") || lower.includes("requests per day")) {
    limitType = "requêtes/jour (rpd)";
  } else if (lower.includes("tpm") || lower.includes("tokens per minute")) {
    limitType = "tokens/minute (tpm)";
  } else if (lower.includes("tpd") || lower.includes("tokens per day")) {
    limitType = "tokens/jour (tpd)";
  }

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
