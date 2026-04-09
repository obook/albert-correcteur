/*
 * popup-status.js - Affichage des messages de statut dans la popup.
 *
 * Fournit la fonction showStatus() utilisée par popup.js,
 * popup-models.js et popup-limits.js pour afficher des messages
 * de confirmation ("ok") ou d'erreur ("err") à l'utilisateur.
 * Les messages "ok" disparaissent automatiquement après 3 secondes.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

const statusDiv = document.getElementById("status");

/**
 * Affiche un message de statut dans la popup de configuration.
 *
 * @param {string} text - Message à afficher.
 * @param {string} type - Type de message : "ok" (succès) ou "err" (erreur).
 */
function showStatus(text, type) {
  statusDiv.textContent = text;
  statusDiv.className = `status ${type}`;
  if (type === "ok") {
    setTimeout(() => { statusDiv.textContent = ""; }, 3000);
  }
}
