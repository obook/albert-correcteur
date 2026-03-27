// service-config.js --- Configuration (clé API, modèle, URL).

"use strict";

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

async function loadConfig() {
  const result = await browser.storage.local.get(["apiKey", "apiBase", "model"]);
  return {
    apiKey: result.apiKey || "",
    apiBase: (result.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: result.model || "",
  };
}
