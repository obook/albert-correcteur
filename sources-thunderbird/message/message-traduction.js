// message-traduction.js --- Popup de traduction dans la lecture de mail Thunderbird.

"use strict";

if (!window._albertTraductionLoaded) {
  window._albertTraductionLoaded = true;

  let translationPopup = null;
  let lastLang = "fr";

  function getThemeClass() {
    // Récupérer le thème depuis le storage
    return ""; // par défaut sombre (popup-dark.css)
  }

  function closePopup() {
    if (translationPopup) {
      translationPopup.remove();
      translationPopup = null;
    }
  }

  function showTranslationPopup(text) {
    closePopup();

    const popup = document.createElement("div");
    popup.className = "albert-popup " + getThemeClass();
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Traduction");

    // En-tête
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
      if (code === lastLang) opt.selected = true;
      langSelect.appendChild(opt);
    }
    header.appendChild(langSelect);

    const closeBtn = document.createElement("button");
    closeBtn.className = "albert-popup-close";
    closeBtn.textContent = "\u00D7";
    closeBtn.setAttribute("aria-label", "Fermer");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopup();
    });
    header.appendChild(closeBtn);
    popup.appendChild(header);

    // Résultat
    const resultDiv = document.createElement("div");
    resultDiv.className = "albert-popup-translation-result";
    resultDiv.textContent = "Traduction en cours...";
    popup.appendChild(resultDiv);

    // Info langue source
    const langInfo = document.createElement("div");
    langInfo.className = "albert-popup-lang-info";
    popup.appendChild(langInfo);

    // Bouton copier
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

    // Positionnement fixe au centre
    document.body.appendChild(popup);
    popup.style.position = "fixed";
    popup.style.left = "50%";
    popup.style.top = "30%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.zIndex = "2147483647";

    translationPopup = popup;

    // Fonction de traduction
    const doTranslate = async (targetLang) => {
      lastLang = targetLang;
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
    doTranslate(lastLang);
  }

  // Fermeture par Escape ou clic en dehors
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
  });
  document.addEventListener("mousedown", (e) => {
    if (translationPopup && !translationPopup.contains(e.target)) {
      closePopup();
    }
  });

  // Écouter les messages du background
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "translateInMessage") {
      showTranslationPopup(message.text);
    }
  });
}
