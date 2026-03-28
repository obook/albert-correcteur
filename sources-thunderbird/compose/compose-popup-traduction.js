// compose-popup-traduction.js --- Popup de traduction dans le compose Thunderbird.

"use strict";

Albert.translationPopup = null;
Albert.lastTranslationLang = "en";

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
  const langs = { fr: "Français", en: "Anglais", es: "Espagnol", de: "Allemand" };
  for (const [code, name] of Object.entries(langs)) {
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
  resultDiv.textContent = "Traduction en cours...";
  popup.appendChild(resultDiv);

  const langInfo = document.createElement("div");
  langInfo.className = "albert-popup-lang-info";
  popup.appendChild(langInfo);

  const copyBtn = document.createElement("button");
  copyBtn.className = "albert-popup-suggestion";
  copyBtn.textContent = "Copier";
  copyBtn.style.display = "none";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(resultDiv.textContent);
    copyBtn.textContent = "Copié !";
    setTimeout(() => { copyBtn.textContent = "Copier"; }, 1500);
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
    resultDiv.textContent = "Traduction en cours...";
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
      const langNames = { fr: "français", en: "anglais", es: "espagnol", de: "allemand" };
      langInfo.textContent = "Langue détectée : " + (langNames[result.langSource] || result.langSource);
      copyBtn.style.display = "";
    }
  };

  langSelect.addEventListener("change", () => doTranslate(langSelect.value));
  doTranslate(Albert.lastTranslationLang);
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeTranslationPopup();
});
document.addEventListener("mousedown", (e) => {
  if (Albert.translationPopup && !Albert.translationPopup.contains(e.target)) {
    Albert.closeTranslationPopup();
  }
});
