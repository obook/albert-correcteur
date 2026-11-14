/*
 * compose-popup-messages.js - Réception des messages du service worker (Thunderbird).
 *
 * Écoute les messages envoyés par le service worker (service-menus.js)
 * et les dispatche vers la bonne popup dans la fenêtre de composition :
 *   - reformulateLoading   → toast « Reformulation en cours… »
 *   - reformulateResult    → showReformulationPopup()
 *   - translateGetSelection → showTranslationPopup()
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateLoading") {
    /* S\u00e9lection relev\u00e9e au clic sur le menu : \u00e0 l'arriv\u00e9e du r\u00e9sultat,
       l'utilisateur a pu en s\u00e9lectionner une autre. */
    Albert.captureReformulationRange();
    Albert.showToast("Reformulation en cours\u2026", 300000);
    return;
  }

  if (message.type === "reformulateResult") {
    Albert.showReformulationPopup(message.originalText, message.result, message.personaLabel);
  }

  if (message.type === "translateGetSelection") {
    /* La sélection transmise par le menu contextuel fait foi : la lire
       ici échouerait si Thunderbird l'a déjà réduite à néant en fermant
       le menu, et la popup ne s'ouvrirait pas, sans aucun retour. */
    let text = (message.selectionText || "").trim();
    if (!text) {
      const selection = document.getSelection();
      text = selection ? selection.toString().trim() : "";
    }
    if (text.length >= 3) {
      Albert.showTranslationPopup(text);
    } else {
      Albert.showToast("Sélectionnez au moins trois caractères à traduire.");
    }
  }
});
