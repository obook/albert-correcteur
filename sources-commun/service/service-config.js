/*
 * service-config.js - Chargement de la configuration depuis le storage.
 *
 * Lit la clé API, l'URL de base et le modèle depuis
 * browser.storage.local. Utilisé par tous les modules du service
 * worker (service-api.js, service-limites.js).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

"use strict";

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
