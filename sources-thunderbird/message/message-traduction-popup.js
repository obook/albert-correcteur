// message-traduction-popup.js --- Logique de la popup de traduction (lecture de mail).

"use strict";

(async () => {
  const params = new URLSearchParams(window.location.search);
  const text = params.get("text") || "";

  const resultDiv = document.getElementById("result");
  const langSelect = document.getElementById("lang");
  const langInfo = document.getElementById("lang-info");
  const copyBtn = document.getElementById("copy");
  const closeBtn = document.getElementById("close");

  // Langue par défaut depuis le storage
  const stored = await browser.storage.local.get("lastTranslationLang");
  if (stored.lastTranslationLang) {
    langSelect.value = stored.lastTranslationLang;
  }

  async function doTranslate(targetLang) {
    resultDiv.textContent = "Traduction en cours...";
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
        const langNames = { fr: "français", en: "anglais", es: "espagnol", de: "allemand" };
        langInfo.textContent = "Langue détectée : " + (langNames[result.langSource] || result.langSource);
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

  // Traduction automatique au lancement
  doTranslate(langSelect.value);
})();
