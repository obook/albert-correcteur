/*
 * service-limites.js - Cache et récupération des limites du compte API.
 *
 * Une seule fonction exposée au reste du service worker :
 *
 *   - fetchLimits()
 *       Interroge /v1/me/info pour obtenir les quotas du compte
 *       (rpm, rpd, tpm, tpd). Si plusieurs limites du même type
 *       existent (cas multi-modèle), la valeur la plus restrictive
 *       (minimum) est conservée. Cache 10 minutes.
 *
 * Le cache est invalidé automatiquement quand la configuration change
 * (clé API, modèle, URL de base).
 *
 * L'usage journalier (rpd et tpd consommés) est calculé côté popup de
 * configuration, dans popup-limits.js, qui interroge /v1/me/usage
 * directement : c'est le seul endroit où cette information est affichée,
 * et le service worker n'a pas à la relayer.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

let cachedLimits = null;
let limitsExpiry = 0;

const CACHE_LIMITS_MS = 10 * 60 * 1000;

/**
 * Récupère les limites du compte API (avec cache de 10 minutes).
 *
 * @returns {Promise<Object|null>} Objet { rpm, rpd, tpm, tpd } ou null.
 */
async function fetchLimits() {
  const now = Date.now();
  if (cachedLimits && now < limitsExpiry) return cachedLimits;

  const config = await loadConfig();
  if (!config.apiKey) return null;

  try {
    const response = await fetch(`${config.apiBase}/v1/me/info`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return cachedLimits;

    const data = await response.json();
    const limits = {};
    for (const l of data.limits || []) {
      if (l.value === null) continue;
      if (!(l.type in limits) || l.value < limits[l.type]) {
        limits[l.type] = l.value;
      }
    }
    cachedLimits = limits;
    limitsExpiry = now + CACHE_LIMITS_MS;
    return limits;
  } catch (err) {
    AlbertLog.warn("fetchLimits a échoué, on garde le cache :", err && err.message);
    return cachedLimits;
  }
}

/* Invalider le cache quand la config change (clé API, modèle, URL) */
browser.storage.onChanged.addListener((changes) => {
  if (changes.apiKey || changes.model || changes.apiBase) {
    cachedLimits = null;
    limitsExpiry = 0;
  }
});
