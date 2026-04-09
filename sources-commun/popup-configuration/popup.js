/*
 * popup.js - Page de configuration principale de l'extension.
 *
 * Ce script gère la popup de configuration accessible depuis
 * l'icône Albert dans la barre d'outils du navigateur.
 *
 * Fonctionnalités :
 *   - Chargement de la configuration existante (clé API, URL, modèle).
 *   - Validation et enregistrement dans browser.storage.local.
 *   - Chargement de la liste des modèles disponibles.
 *   - Affichage des limites du compte.
 *   - Lien vers la page des paramètres (thème, dictionnaire).
 *
 * Dépendances (scripts chargés dans popup.html) :
 *   - popup-status.js  (showStatus)
 *   - popup-models.js  (fetchModels, modelSelect)
 *   - popup-limits.js  (fetchAndShowLimits)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

const form = document.getElementById("config-form");
const apiKeyInput = document.getElementById("api-key");
const apiBaseInput = document.getElementById("api-base");

/* --- Charger la config existante --- */

browser.storage.local.get(["apiKey", "apiBase", "model"]).then((result) => {
  if (result.apiKey) apiKeyInput.value = result.apiKey;
  apiBaseInput.value = result.apiBase || DEFAULT_API_BASE;

  if (result.apiKey) {
    fetchModels();
    fetchAndShowLimits();
  }
});

/* --- Enregistrer --- */

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

/* --- Paramètres --- */

document.getElementById("open-settings").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "popup-settings.html";
});
