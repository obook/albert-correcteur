/*
 * service-limites.js - Cache et récupération des limites du compte API.
 *
 * Interroge l'endpoint /v1/me/info pour obtenir les quotas du compte
 * (rpm, rpd, tpm, tpd). Les résultats sont mis en cache pendant
 * 10 minutes pour éviter les appels répétés.
 *
 * Si plusieurs limites du même type existent (cas multi-modèle),
 * la valeur la plus restrictive (minimum) est conservée.
 *
 * Le cache est invalidé automatiquement quand la configuration
 * change (clé API, modèle, URL de base).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

"use strict";

let cachedLimits = null;
let limitsExpiry = 0;

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
    limitsExpiry = now + 10 * 60 * 1000;
    return limits;
  } catch {
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
