/*
 * albert-popup-messages.js - Réception des messages du service worker.
 *
 * Écoute les messages envoyés par le service worker (service-menus.js)
 * via browser.runtime.onMessage et les dispatche vers la bonne popup :
 *   - reformulateLoading  → toast "Reformulation en cours..."
 *   - reformulateResult   → showReformulationPopup()
 *   - translateGetSelection → showTranslationPopup()
 *
 * Ces messages sont déclenchés par les menus contextuels
 * "Reformuler avec Albert" et "Traduire avec Albert".
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateLoading") {
    Albert.showToast("Reformulation en cours\u2026", 30);
    return;
  }

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
