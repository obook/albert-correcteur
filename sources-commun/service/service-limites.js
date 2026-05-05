/*
 * service-limites.js - Cache et récupération des limites du compte API.
 *
 * Trois fonctions exposées au reste du service worker :
 *
 *   - fetchLimits()
 *       Interroge /v1/me/info pour obtenir les quotas du compte
 *       (rpm, rpd, tpm, tpd). Si plusieurs limites du même type
 *       existent (cas multi-modèle), la valeur la plus restrictive
 *       (minimum) est conservée. Cache 10 minutes.
 *
 *   - fetchAliases()
 *       Interroge /v1/models et construit la table
 *       { alias serveur -> id canonique }. Permet par exemple de
 *       résoudre "openweight-large" en "openai/gpt-oss-120b".
 *       Cache 10 minutes.
 *
 *   - fetchDailyUsage(modelName)
 *       Interroge /v1/me/usage et calcule { rpd_used, tpd_used }
 *       pour le modèle indiqué, depuis minuit UTC. L'identifiant
 *       passé peut être un alias ou un id canonique : la résolution
 *       est faite avec la table d'alias avant la comparaison.
 *       Cache 30 secondes (les compteurs changent vite).
 *
 * Tous les caches sont invalidés automatiquement quand la
 * configuration change (clé API, modèle, URL de base).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

let cachedLimits = null;
let limitsExpiry = 0;
let cachedAliases = null;
let aliasesExpiry = 0;
let cachedDailyUsage = null;
let dailyUsageExpiry = 0;
let cachedDailyUsageKey = "";

const CACHE_LIMITS_MS = 10 * 60 * 1000;
const CACHE_ALIASES_MS = 10 * 60 * 1000;
const CACHE_DAILY_MS = 30 * 1000;

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
    AlbertLog.warn("fetchLimits a échoué, on garde le cache:", err && err.message);
    return cachedLimits;
  }
}

/**
 * Récupère la table { alias -> id canonique } depuis /v1/models.
 *
 * Utile pour résoudre un alias serveur (ex. "openweight-large") en
 * son id canonique (ex. "openai/gpt-oss-120b") avant comparaison
 * avec les évènements d'usage qui portent l'id canonique.
 *
 * @returns {Promise<Object|null>} Map alias -> id, ou null en cas d'échec.
 */
async function fetchAliases() {
  const now = Date.now();
  if (cachedAliases && now < aliasesExpiry) return cachedAliases;

  const config = await loadConfig();
  if (!config.apiKey) return null;

  try {
    const response = await fetch(`${config.apiBase}/v1/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return cachedAliases;

    const data = await response.json();
    const aliases = {};
    for (const m of data.data || []) {
      if (!m.id || !Array.isArray(m.aliases)) continue;
      for (const a of m.aliases) {
        if (typeof a === "string" && a) aliases[a] = m.id;
      }
    }
    cachedAliases = aliases;
    aliasesExpiry = now + CACHE_ALIASES_MS;
    return aliases;
  } catch (err) {
    AlbertLog.warn("fetchAliases a échoué, on garde le cache:", err && err.message);
    return cachedAliases;
  }
}

/**
 * Résout un alias en id canonique. Si l'argument n'est pas un
 * alias connu, il est renvoyé tel quel.
 *
 * @param {string} modelName - Alias serveur ou id canonique.
 * @returns {Promise<string>} Id canonique.
 */
async function resolveAlias(modelName) {
  if (!modelName) return modelName;
  const aliases = await fetchAliases();
  if (aliases && modelName in aliases) return aliases[modelName];
  return modelName;
}

/**
 * Calcule l'usage journalier réel pour un modèle, depuis /v1/me/usage.
 *
 * Albert renvoie la liste des appels avec leur nombre de tokens et
 * un horodatage Unix. On somme les requêtes et les prompt_tokens
 * postérieurs à minuit UTC pour obtenir { rpd_used, tpd_used }.
 *
 * Cache 30 secondes : les compteurs évoluent vite.
 *
 * @param {string} modelName - Alias ou id canonique du modèle.
 * @returns {Promise<{rpdUsed: number, tpdUsed: number} | null>}
 */
async function fetchDailyUsage(modelName) {
  if (!modelName) return null;
  const now = Date.now();
  const canonical = await resolveAlias(modelName);

  if (cachedDailyUsage
    && cachedDailyUsageKey === canonical
    && now < dailyUsageExpiry) {
    return cachedDailyUsage;
  }

  const config = await loadConfig();
  if (!config.apiKey) return null;

  try {
    const response = await fetch(`${config.apiBase}/v1/me/usage`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return cachedDailyUsageKey === canonical
      ? cachedDailyUsage : null;

    const data = await response.json();
    const events = Array.isArray(data.data) ? data.data : [];

    /* Minuit UTC en secondes Unix */
    const utcMidnight = Math.floor(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      ) / 1000
    );

    let rpdUsed = 0;
    let tpdUsed = 0;
    for (const ev of events) {
      if (!ev || ev.model !== canonical) continue;
      if (typeof ev.created !== "number" || ev.created < utcMidnight) continue;
      rpdUsed += 1;
      const usage = ev.usage || {};
      const tokens = typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens : 0;
      tpdUsed += tokens;
    }

    cachedDailyUsage = { rpdUsed, tpdUsed };
    cachedDailyUsageKey = canonical;
    dailyUsageExpiry = now + CACHE_DAILY_MS;
    return cachedDailyUsage;
  } catch (err) {
    AlbertLog.warn("fetchDailyUsage a échoué:", err && err.message);
    return cachedDailyUsageKey === canonical ? cachedDailyUsage : null;
  }
}

/* Invalider tous les caches quand la config change (clé API, modèle, URL) */
browser.storage.onChanged.addListener((changes) => {
  if (changes.apiKey || changes.model || changes.apiBase) {
    cachedLimits = null;
    limitsExpiry = 0;
    cachedAliases = null;
    aliasesExpiry = 0;
    cachedDailyUsage = null;
    dailyUsageExpiry = 0;
    cachedDailyUsageKey = "";
  }
});
