/*
 * popup.js - Page de configuration principale de l'extension.
 *
 * Ce script gère la popup de configuration accessible depuis
 * l'icône Albert dans la barre d'outils du navigateur.
 *
 * Fonctionnalités :
 *   - Chargement de la configuration existante (clé API, URL, modèle).
 *   - Validation et enregistrement dans browser.storage.local. La clé est
 *     facultative : un endpoint local en sert sans authentification.
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

/* Numéro de version à côté du nom, lu dans le manifest de la cible. */
document.getElementById("titre").textContent +=
  " " + browser.runtime.getManifest().version;

const form = document.getElementById("config-form");
const apiKeyInput = document.getElementById("api-key");
const apiBaseInput = document.getElementById("api-base");

/* --- Charger la config existante --- */

browser.storage.local.get(["apiKey", "apiBase", "model"]).then(async (result) => {
  if (result.apiKey) apiKeyInput.value = result.apiKey;
  apiBaseInput.value = result.apiBase || DEFAULT_API_BASE;

  /* Une configuration existe dès qu'une clé ou une URL a été enregistrée :
     un endpoint local se passe de clé, mais ses modèles doivent quand même
     être chargés à l'ouverture. */
  if (result.apiKey || result.apiBase) {
    /* fetchModels remplit le <select> et sélectionne le modèle sauvegardé.
       Il faut attendre cette étape avant d'afficher les limites, sinon
       modelSelect.value est encore vide et la section "Usage du jour"
       est sautée au premier rendu. */
    await fetchModels();
    fetchAndShowLimits();
  }
});

/* --- Enregistrer --- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;

  let model = modelSelect.value;

  /* Aucun modèle sélectionné (cas typique après changement de clé : la
     liste chargée avec l'ancienne clé a échoué). Tenter un chargement
     avec la clé saisie avant de renoncer, sinon la nouvelle clé ne
     serait jamais enregistrée.

     En cas d'échec, fetchModels a déjà affiché le motif exact (clé
     refusée, erreur réseau, liste vide) : le remplacer par un message
     générique mettait la clé en cause à tort et rendait le vrai
     problème invisible. */
  if (!model) {
    if (!(await fetchModels())) return;
    model = modelSelect.value;
  }

  if (!model) {
    showStatus("Aucun modèle sélectionné.", "err");
    return;
  }

  await browser.storage.local.set({ apiKey, model, apiBase });
  showStatus("Configuration enregistrée.", "ok");
  fetchAndShowLimits();
});

/* Rafraîchir plafonds et usage quand l'utilisateur change de modèle. */

modelSelect.addEventListener("change", fetchAndShowLimits);

/* --- Paramètres --- */

document.getElementById("open-settings").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "popup-settings.html";
});
