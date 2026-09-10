/*
 * popup-status.js - Affichage des messages de statut dans la popup.
 *
 * Fournit la fonction showStatus() utilisée par popup.js,
 * popup-models.js et popup-limits.js pour afficher des messages
 * de confirmation ("ok") ou d'erreur ("err") à l'utilisateur.
 * Les messages "ok" disparaissent automatiquement après 3 secondes.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

const statusDiv = document.getElementById("status");

/* Minuterie d'effacement du dernier message "ok". Sans cette référence,
   le message de succès affiché trois secondes plus tôt effaçait l'erreur
   qui venait de le remplacer. */
let effacement = null;

/**
 * Affiche un message de statut dans la popup de configuration.
 *
 * @param {string} text - Message à afficher.
 * @param {string} type - Type de message : "ok" (succès) ou "err" (erreur).
 */
function showStatus(text, type) {
  statusDiv.textContent = text;
  statusDiv.className = `status ${type}`;
  clearTimeout(effacement);
  effacement = null;
  if (type === "ok") {
    effacement = setTimeout(() => { statusDiv.textContent = ""; }, 3000);
  }
}
