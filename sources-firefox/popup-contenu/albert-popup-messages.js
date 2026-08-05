/*
 * albert-popup-messages.js - Réception des messages du service worker.
 *
 * Écoute les messages envoyés par le service worker (service-menus.js)
 * via browser.runtime.onMessage et les dispatche vers la bonne popup :
 *   - reformulateLoading  → toast « Reformulation en cours… »
 *   - reformulateResult   → showReformulationPopup()
 *   - translateGetSelection → showTranslationPopup()
 *
 * Ces messages sont déclenchés par les menus contextuels
 * "Reformuler avec Albert" et "Traduire avec Albert".
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

browser.runtime.onMessage.addListener((message) => {
  Albert.log("onMessage:", message.type,
    window.top !== window ? "(iframe " + location.href + ")" : "");

  if (message.type === "reformulateLoading") {
    Albert.showToast("Reformulation en cours\u2026", 30000);
    return;
  }

  if (message.type === "reformulateResult") {
    if (message.result.error) {
      Albert.warn("reformulateResult avec erreur :", message.result.error);
      Albert.showToast(message.result.error, 5000);
      return;
    }
    const suggestions = message.result.corrections || [];
    Albert.log("reformulateResult OK,", suggestions.length, "suggestions",
      "savedSelection=" + (Albert.savedSelection ? Albert.savedSelection.type : "null"));
    if (!Albert.savedSelection) {
      Albert.warn("reformulateResult : aucune s\u00e9lection sauvegard\u00e9e, "
        + "le clic sur une suggestion ne pourra pas remplacer le texte. "
        + "L'\u00e9v\u00e9nement contextmenu n'a peut-\u00eatre pas \u00e9t\u00e9 capt\u00e9 dans ce cadre.");
    }
    Albert.showReformulationPopup(message.originalText, suggestions, message.personaLabel);
  }

  if (message.type === "translateGetSelection") {
    const saved = Albert.savedSelection;
    const fullText = saved ? saved.text : window.getSelection().toString();
    if (!fullText || fullText.trim().length < 3) {
      Albert.showToast("Sélectionnez du texte à traduire.", 3000);
      return;
    }
    const textToTranslate = fullText.length > 2000 ? fullText.slice(0, 2000) : fullText;
    Albert.showTranslationPopup(textToTranslate);
  }
});
