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

/*
 * Table de correspondance id canonique -> alias serveur.
 *
 * Albert API expose chaque modèle sous deux formes : un id canonique
 * (ex. "mistralai/Mistral-Small-3.2-24B-Instruct-2506") et un alias
 * stable (ex. "openweight-medium"). Le projet utilise systématiquement
 * l'alias en interne pour rester indépendant des renommages côté
 * fournisseur. Cette table sert à normaliser une configuration
 * potentiellement ancienne (où l'id canonique aurait été enregistré).
 *
 * Clés en minuscules pour permettre une recherche insensible à la casse.
 */
const CANONICAL_TO_ALIAS = {
  "openai/gpt-oss-120b": "openweight-large",
  "mistralai/mistral-small-3.2-24b-instruct-2506": "openweight-medium",
  "mistralai/ministral-3-8b-instruct-2512": "openweight-small",
  "qwen/qwen3-coder-30b-a3b-instruct": "openweight-code",
};

/**
 * Normalise un identifiant de modèle vers son alias serveur stable.
 *
 * - Un id canonique connu (toute casse) est converti en alias.
 * - Un alias déjà reconnu est renvoyé en minuscules.
 * - Tout autre identifiant est renvoyé tel quel.
 *
 * @param {string} id - Alias ou id canonique du modèle.
 * @returns {string}
 */
function normalizeModelId(id) {
  if (!id) return id;
  const lower = id.toLowerCase();
  if (lower in CANONICAL_TO_ALIAS) return CANONICAL_TO_ALIAS[lower];
  if (lower.startsWith("openweight-")) return lower;
  return id;
}

/**
 * Charge la configuration de l'extension depuis le storage local.
 *
 * Le modèle est normalisé en alias serveur ([[normalizeModelId]]) pour
 * que tous les consommateurs (fallback chain, paliers documentés)
 * manipulent une clé stable.
 *
 * @returns {Promise<{apiKey: string, apiBase: string, model: string}>}
 */
async function loadConfig() {
  const result = await browser.storage.local.get(["apiKey", "apiBase", "model"]);
  return {
    apiKey: result.apiKey || "",
    apiBase: (result.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: normalizeModelId(result.model || ""),
  };
}
