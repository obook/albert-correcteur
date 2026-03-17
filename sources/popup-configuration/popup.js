// popup.js — Initialisation, chargement de la config et enregistrement.

"use strict";

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

const form = document.getElementById("config-form");
const apiKeyInput = document.getElementById("api-key");
const apiBaseInput = document.getElementById("api-base");

// ── Charger la config existante ──

browser.storage.local.get(["apiKey", "apiBase", "model"]).then((result) => {
  if (result.apiKey) apiKeyInput.value = result.apiKey;
  apiBaseInput.value = result.apiBase || DEFAULT_API_BASE;

  if (result.apiKey) {
    fetchModels();
    fetchAndShowLimits();
  }
});

// ── Enregistrer ──

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;

  if (!apiKey) {
    showStatus("La clé API est obligatoire.", "err");
    return;
  }
  if (!model) {
    showStatus("Sélectionnez un modèle.", "err");
    return;
  }

  await browser.storage.local.set({ apiKey, model, apiBase });
  showStatus("Configuration enregistrée.", "ok");
  fetchAndShowLimits();
});

// ── Paramètres ──

document.getElementById("open-settings").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "popup-settings.html";
});
