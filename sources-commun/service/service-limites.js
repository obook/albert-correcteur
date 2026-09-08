/*
 * service-limites.js - Cache et récupération des limites du compte API.
 *
 * Une seule fonction exposée au reste du service worker :
 *
 *   - fetchLimits()
 *       Interroge /v1/me/info pour obtenir les quotas (rpm, rpd, tpm,
 *       tpd) du modèle configuré, rattachés par [[limitsForModel]].
 *       Quand le rattachement échoue, la valeur la plus restrictive
 *       tous routeurs confondus est conservée. Cache 10 minutes.
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
 * Liste des modèles servis, vide si l'appel échoue.
 *
 * @param {Object} config - Configuration chargée (apiBase, apiKey).
 * @returns {Promise<Array>}
 */
async function fetchModels(config) {
  try {
    const response = await fetch(`${config.apiBase}/v1/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch {
    /* Sans la liste des modèles, le rattachement est impossible et
       l'appelant retombe sur le minimum. */
    return [];
  }
}

/**
 * Récupère les limites du modèle configuré (avec cache de 10 minutes).
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
    const rawLimits = data.limits || [];

    /* Les plafonds du modèle appelé plutôt que le plus bas du compte :
       le minimum est celui d'un modèle que l'extension n'appelle
       jamais ; il divisait le débit de frappe par deux. */
    const models = await fetchModels(config);
    const limits = limitsForModel(rawLimits, models, config.model)
      || limitsMinimum(rawLimits);

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
