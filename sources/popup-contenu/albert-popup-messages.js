// albert-popup-messages.js — Écoute des messages du background script.
// Dispatche vers la bonne popup selon le type de message.

"use strict";

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateResult") {
    if (message.result.error) {
      Albert.showToast(message.result.error, 5);
      return;
    }
    const suggestions = message.result.corrections || [];
    Albert.showReformulationPopup(message.originalText, suggestions);
  }

  if (message.type === "translateGetSelection") {
    const saved = Albert.savedSelection;
    const fullText = saved ? saved.text : window.getSelection().toString();
    if (!fullText || fullText.trim().length < 3) {
      Albert.showToast("Sélectionnez du texte à traduire.", 3);
      return;
    }
    const textToTranslate = fullText.length > 2000 ? fullText.slice(0, 2000) : fullText;
    Albert.showTranslationPopup(textToTranslate);
  }
});
