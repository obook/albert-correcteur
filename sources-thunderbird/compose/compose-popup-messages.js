/*
 * compose-popup-messages.js - Réception des messages du service worker (Thunderbird).
 *
 * Écoute les messages envoyés par le service worker (service-menus.js)
 * et les dispatche vers la bonne popup dans la fenêtre de composition :
 *   - reformulateLoading   → toast "Reformulation en cours..."
 *   - reformulateResult    → showReformulationPopup()
 *   - translateGetSelection → showTranslationPopup()
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

"use strict";

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateLoading") {
    Albert.showToast("Reformulation en cours\u2026", 30000);
    return;
  }

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
