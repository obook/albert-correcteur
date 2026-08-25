/*
 * popup-settings.js - Page des paramètres (thème et dictionnaire personnel).
 *
 * Cette page est accessible depuis le lien "Paramètres" de la popup
 * de configuration principale (popup.html). Elle permet :
 *   - De choisir le thème des popups (sombre, clair, système).
 *   - De consulter et gérer le dictionnaire personnel (mots ignorés
 *     par le correcteur).
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

document.getElementById("back-btn").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "popup.html";
});

const statusDiv = document.getElementById("status");
const ignoredWordsDiv = document.getElementById("ignored-words");
const noWordsMsg = document.getElementById("no-words");

/* --- Thème --- */

const themeRadios = document.querySelectorAll('input[name="theme"]');

browser.storage.local.get("popupTheme").then((result) => {
  const theme = result.popupTheme || "dark";
  const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
  if (radio) radio.checked = true;
});

themeRadios.forEach((radio) => {
  radio.addEventListener("change", async () => {
    await browser.storage.local.set({ popupTheme: radio.value });
    showStatus("Thème enregistré.");
  });
});

/* --- Dictionnaire personnel --- */

async function loadIgnoredWords() {
  const result = await browser.storage.local.get("ignoredWords");
  const words = result.ignoredWords || [];

  ignoredWordsDiv.innerHTML = "";
  if (words.length === 0) {
    noWordsMsg.hidden = false;
    return;
  }
  noWordsMsg.hidden = true;

  for (const word of words.sort()) {
    const tag = document.createElement("span");
    tag.className = "ignored-word";
    tag.textContent = word;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.title = "Retirer du dictionnaire";
    removeBtn.addEventListener("click", async () => {
      const updated = words.filter((w) => w !== word);
      await browser.storage.local.set({ ignoredWords: updated });
      loadIgnoredWords();
      showStatus(`"${word}" retiré du dictionnaire.`);
    });
    tag.appendChild(removeBtn);
    ignoredWordsDiv.appendChild(tag);
  }
}

loadIgnoredWords();

function showStatus(text) {
  statusDiv.textContent = text;
  statusDiv.className = "status ok";
  setTimeout(() => { statusDiv.textContent = ""; }, 3000);
}
