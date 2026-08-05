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
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* DEFAULT_API_BASE est déclarée dans util/model-aliases.js, chargé
   avant ce script dans popup.html. */

const form = document.getElementById("config-form");
const apiKeyInput = document.getElementById("api-key");
const apiBaseInput = document.getElementById("api-base");

/* --- Charger la config existante --- */

browser.storage.local.get(["apiKey", "apiBase", "model"]).then(async (result) => {
  if (result.apiKey) apiKeyInput.value = result.apiKey;
  apiBaseInput.value = result.apiBase || DEFAULT_API_BASE;

  if (result.apiKey) {
    /* fetchModels remplit le <select> et sélectionne le modèle sauvegardé.
       Il faut attendre cette étape avant d'afficher les limites, sinon
       modelSelect.value est encore vide et les sections "Usage du jour"
       et "Paliers documentés" sont sautées au premier rendu. */
    await fetchModels();
    fetchAndShowLimits();
  }
});

/* --- Enregistrer --- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;

  if (!apiKey) {
    showStatus("La clé API est obligatoire.", "err");
    return;
  }

  let model = modelSelect.value;

  /* Aucun modèle sélectionné (cas typique après changement de clé : la
     liste chargée avec l'ancienne clé a échoué). Tenter un chargement
     avec la clé saisie avant de renoncer, sinon la nouvelle clé ne
     serait jamais enregistrée. */
  if (!model) {
    await fetchModels();
    model = modelSelect.value;
  }

  if (!model) {
    showStatus(
      "Impossible de charger les modèles avec cette clé. Vérifiez la clé API.",
      "err"
    );
    return;
  }

  await browser.storage.local.set({ apiKey, model, apiBase });
  showStatus("Configuration enregistrée.", "ok");
  fetchAndShowLimits();
});

/* Rafraîchir les paliers documentés quand l'utilisateur change de modèle. */

modelSelect.addEventListener("change", () => {
  if (apiKeyInput.value.trim()) fetchAndShowLimits();
});

/* --- Paramètres --- */

document.getElementById("open-settings").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "popup-settings.html";
});
