// popup-status.js — Affichage des messages de statut.

"use strict";

const statusDiv = document.getElementById("status");

function showStatus(text, type) {
  statusDiv.textContent = text;
  statusDiv.className = `status ${type}`;
  if (type === "ok") {
    setTimeout(() => { statusDiv.textContent = ""; }, 3000);
  }
}
