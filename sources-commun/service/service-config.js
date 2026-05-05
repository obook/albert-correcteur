/*
 * service-config.js - Chargement de la configuration depuis le storage.
 *
 * Lit la clé API, l'URL de base et le modèle depuis
 * browser.storage.local. Utilisé par tous les modules du service
 * worker (service-api.js, service-limites.js).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/*
 * --- Logs de diagnostic du service worker ---
 *
 * Activable depuis la console "background" (about:debugging → Inspecter) :
 *   AlbertLog.DEBUG = true
 *
 * log/info ne s'expriment que si DEBUG est vrai.
 * warn et error sont toujours actifs pour ne pas masquer un crash.
 */
const AlbertLog = {
  DEBUG: false,
  log(...args)   { if (this.DEBUG) console.info("[Albert sw]", ...args); },
  info(...args)  { if (this.DEBUG) console.info("[Albert sw]", ...args); },
  warn(...args)  { console.warn("[Albert sw]", ...args); },
  error(...args) { console.error("[Albert sw]", ...args); },
};

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

/** URL par défaut de l'API Albert (DINUM / Etalab). */

/**
 * Charge la configuration de l'extension depuis le storage local.
 *
 * @returns {Promise<{apiKey: string, apiBase: string, model: string}>}
 */
async function loadConfig() {
  const result = await browser.storage.local.get(["apiKey", "apiBase", "model"]);
  return {
    apiKey: result.apiKey || "",
    apiBase: (result.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: result.model || "",
  };
}
