/*
 * popup-settings.js - Page des paramètres (thème, langue, dictionnaire personnel).
 *
 * Cette page est accessible depuis le lien "Paramètres" de la popup
 * de configuration principale (popup.html). Elle permet :
 *   - De choisir le thème des popups (sombre, clair, système).
 *   - De fixer la langue de correction par défaut (ou de la laisser deviner).
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

/* --- Langue de correction par défaut --- */

const langueSelect = document.getElementById("langue");

browser.storage.local.get("langue").then((result) => {
  langueSelect.value = result.langue || "auto";
});

langueSelect.addEventListener("change", async () => {
  await browser.storage.local.set({ langue: langueSelect.value });
  showStatus("Langue enregistrée.");
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

/* --- Recherche Grist --- */

/* La case n'apparaît que dans une version qui embarque la lecture de
   Grist : Thunderbird et Brave partagent cette page sans la fonction.
   Firefox rend les chemins du manifeste en URL complètes, d'où endsWith. */
const gristCase = document.getElementById("recherche-grist");
if ((browser.runtime.getManifest().content_scripts || [])
  .some((cs) => (cs.js || []).some((f) => f.endsWith("grist/grist-lecture.js")))) {
  document.getElementById("grist-setting").hidden = false;
  browser.storage.local.get("rechercheGrist").then((result) => {
    gristCase.checked = result.rechercheGrist === true;
  });
  gristCase.addEventListener("change", async () => {
    await browser.storage.local.set({ rechercheGrist: gristCase.checked });
    /* Décocher efface aussi le texte des lignes et leurs vecteurs. */
    if (!gristCase.checked) {
      const tout = await browser.storage.local.get(null);
      await browser.storage.local.remove(Object.keys(tout).filter((k) => k.startsWith("gristVecteurs:")));
    }
    showStatus(gristCase.checked ? "Recherche Grist activée." : "Recherche Grist désactivée.");
  });
}

function showStatus(text) {
  statusDiv.textContent = text;
  statusDiv.className = "status ok";
  setTimeout(() => { statusDiv.textContent = ""; }, 3000);
}
