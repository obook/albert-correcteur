/*
 * message-traduction-popup.js - Popup de traduction (lecture de mail).
 *
 * Ce script gère la fenêtre popup de traduction ouverte depuis le
 * menu contextuel "Traduire avec Albert" lors de la lecture d'un
 * message (pas dans le compose). La fenêtre est créée par
 * browser.windows.create() dans service-menus.js.
 *
 * Le texte à traduire est passé en paramètre d'URL (?text=...).
 * La langue par défaut est chargée depuis browser.storage.local.
 * La traduction est lancée automatiquement à l'ouverture.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

(async () => {
  const params = new URLSearchParams(window.location.search);
  const text = params.get("text") || "";

  const resultDiv = document.getElementById("result");
  const langSelect = document.getElementById("lang");
  const langInfo = document.getElementById("lang-info");
  const copyBtn = document.getElementById("copy");
  const closeBtn = document.getElementById("close");

  /* Langue par défaut depuis le storage */
  const stored = await browser.storage.local.get("lastTranslationLang");
  if (stored.lastTranslationLang) {
    langSelect.value = stored.lastTranslationLang;
  }

  async function doTranslate(targetLang) {
    resultDiv.textContent = "Traduction en cours…";
    langInfo.textContent = "";
    await browser.storage.local.set({ lastTranslationLang: targetLang });

    try {
      const result = await browser.runtime.sendMessage({
        type: "translate",
        text: text,
        targetLang: targetLang,
      });

      if (result.error) {
        resultDiv.textContent = result.error;
      } else {
        resultDiv.textContent = result.translation;
        langInfo.textContent = "Langue détectée : "
          + Albert.nomLangue(result.langSource);
      }
    } catch (err) {
      resultDiv.textContent = "Erreur : " + err.message;
    }
  }

  langSelect.addEventListener("change", () => doTranslate(langSelect.value));

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(resultDiv.textContent);
    copyBtn.textContent = "Copié !";
    setTimeout(() => { copyBtn.textContent = "Copier"; }, 1500);
  });

  closeBtn.addEventListener("click", () => window.close());

  /* Traduction automatique au lancement */
  doTranslate(langSelect.value);
})();
