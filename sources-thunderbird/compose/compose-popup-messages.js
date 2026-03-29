/* compose-popup-messages.js --- Réception des messages du background script dans le compose. */

"use strict";

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateResult") {
    Albert.showReformulationPopup(message.originalText, message.result);
  }

  if (message.type === "translateGetSelection") {
    const selection = document.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (text.length >= 3) {
      Albert.showTranslationPopup(text);
    }
  }
});
