/*
 * message-affichage.js - Traduction dans un message lu.
 *
 * Injecté dans le document du message affiché par
 * service-message-scripts.js. Trois rôles :
 *   - charger le thème des popups et suivre ses changements ;
 *   - mémoriser la sélection et le point du clic droit, dont
 *     positionPopupAtClick a besoin pour ouvrir la popup à cet endroit ;
 *   - ouvrir la popup de traduction à la demande du menu contextuel.
 *
 * Le pendant de ce fichier côté rédaction est compose-popup-messages.js.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

window.Albert = window.Albert || {};

/* Drapeau lu par service-message-scripts.js avant de réinjecter : il
   disparaît avec le document quand un autre message est affiché. */
window.albertTraductionPrete = true;

browser.storage.local.get("popupTheme").then((r) => {
  Albert.popupTheme = r.popupTheme || "dark";
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
});

/* Le point du clic droit sert à ouvrir la popup sous la sélection.
   Un message affiché n'est pas modifiable : seul le cas d'une
   sélection de texte est à couvrir, contrairement à Firefox qui gère
   aussi les champs de saisie. */
Albert.savedSelection = null;

document.addEventListener("contextmenu", (e) => {
  const selection = window.getSelection();
  if (selection.rangeCount > 0 && !selection.isCollapsed) {
    Albert.savedSelection = {
      type: "range",
      text: selection.toString(),
      clickPos: { x: e.clientX, y: e.clientY },
    };
  } else {
    Albert.savedSelection = null;
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "translateSelection") {
    Albert.showTranslationPopup(message.selectionText);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeTranslationPopup();
});
