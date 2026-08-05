/*
 * compose-popup-traduction.js - Popup de traduction (Thunderbird compose).
 *
 * Affiche une popup de traduction dans la fenêtre de composition.
 * Sélecteur de langue cible (fr, en, es, de), traduction automatique
 * à l'ouverture, bouton "Copier".
 *
 * La dernière langue utilisée est mémorisée dans
 * Albert.lastTranslationLang et persistée sous la clé de storage du
 * même nom, partagée avec la popup de traduction en lecture de message
 * et avec l'extension Firefox.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.translationPopup = null;
Albert.lastTranslationLang = "en";

/* Relire la préférence enregistrée au chargement du compose script. */
browser.storage.local.get("lastTranslationLang").then((r) => {
  if (r.lastTranslationLang) Albert.lastTranslationLang = r.lastTranslationLang;
});

Albert.closeTranslationPopup = function () {
  if (Albert.translationPopup) {
    if (Albert.translationPopup._focusTrapHandler) {
      Albert.translationPopup.removeEventListener("keydown", Albert.translationPopup._focusTrapHandler);
      Albert.translationPopup._focusTrapHandler = null;
    }
    Albert.translationPopup.remove();
    Albert.translationPopup = null;
  }
  Albert.restoreFocus();
};

Albert.showTranslationPopup = function (text) {
  Albert.closeTranslationPopup();
  Albert.closeCorrectionPopup();
  Albert.closeReformulationPopup();

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Traduction");
  popup.setAttribute("aria-modal", "true");
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Traduction";
  popup.appendChild(h2);

  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const title = document.createElement("span");
  title.className = "albert-popup-type";
  title.textContent = "Traduction";
  header.appendChild(title);

  const langSelect = document.createElement("select");
  langSelect.className = "albert-popup-lang-select";
  langSelect.setAttribute("aria-label", "Langue cible");
  for (const [code, name] of Object.entries(Albert.LANG_LABELS)) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    if (code === Albert.lastTranslationLang) opt.selected = true;
    langSelect.appendChild(opt);
  }
  header.appendChild(langSelect);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeTranslationPopup();
  });
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const resultDiv = document.createElement("div");
  resultDiv.className = "albert-popup-translation-result";
  resultDiv.textContent = "Traduction en cours…";
  popup.appendChild(resultDiv);

  const langInfo = document.createElement("div");
  langInfo.className = "albert-popup-lang-info";
  popup.appendChild(langInfo);

  const copyBtn = document.createElement("button");
  copyBtn.className = "albert-popup-suggestion";
  copyBtn.textContent = "Copier";
  copyBtn.style.display = "none";
  copyBtn.addEventListener("click", () => {
    /* Le repli par textarea couvre le cas où l'API presse-papiers est
       refusée : sans lui, l'échec passait inaperçu et le bouton
       annonçait « Copié ! » alors que rien ne l'était. */
    navigator.clipboard.writeText(resultDiv.textContent).then(() => {
      copyBtn.textContent = "Copié !";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 1500);
    }).catch(() => {
      const zone = document.createElement("textarea");
      zone.value = resultDiv.textContent;
      document.body.appendChild(zone);
      zone.select();
      const copie = document.execCommand("copy");
      zone.remove();
      copyBtn.textContent = copie ? "Copié !" : "Copie impossible";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 1500);
    });
  });
  popup.appendChild(copyBtn);

  document.body.appendChild(popup);
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "30%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = "2147483647";

  Albert.trapFocus(popup);
  Albert.translationPopup = popup;

  const doTranslate = async (targetLang) => {
    Albert.lastTranslationLang = targetLang;
    browser.storage.local.set({ lastTranslationLang: targetLang });
    resultDiv.textContent = "Traduction en cours…";
    copyBtn.style.display = "none";
    const result = await browser.runtime.sendMessage({
      type: "translate",
      text: text,
      targetLang: targetLang,
    });
    if (result.error) {
      resultDiv.textContent = result.error;
    } else {
      resultDiv.textContent = result.translation;
      resultDiv.setAttribute("lang", targetLang);
      langInfo.textContent = "Langue détectée : "
        + Albert.nomLangue(result.langSource);
      copyBtn.style.display = "";
    }
  };

  langSelect.addEventListener("change", () => doTranslate(langSelect.value));
  doTranslate(Albert.lastTranslationLang);
};

/* La fermeture par Échap est centralisée dans compose-popup-utils.js. */
document.addEventListener("mousedown", (e) => {
  if (Albert.translationPopup && !Albert.translationPopup.contains(e.target)) {
    Albert.closeTranslationPopup();
  }
});
