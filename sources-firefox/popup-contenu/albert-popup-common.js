/*
 * albert-popup-common.js - Fonctions partagées par toutes les popups.
 *
 * Ce module fournit les services communs aux popups de correction,
 * reformulation et traduction :
 *   - Thème : détection du thème (sombre, clair, système).
 *   - Fermeture : closePopup() avec restauration du focus.
 *   - Piège de focus et restauration : délégués à
 *     util/popup-focus.js, partagé entre les cibles.
 *   - Fermeture par Échap ou clic en dehors de la popup.
 *   - Sauvegarde de la sélection avant le menu contextuel
 *     (nécessaire pour la reformulation et la traduction).
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Thème --- */

Albert.getPopupThemeClass = function () {
  const theme = Albert.popupTheme || "dark";
  if (theme === "dark") return "";
  if (theme === "light") return "albert-theme-light";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "albert-theme-light" : "";
};

Albert.loadPopupTheme = async function () {
  const result = await browser.storage.local.get("popupTheme");
  Albert.popupTheme = result.popupTheme || "dark";
};
Albert.loadPopupTheme();

browser.storage.onChanged.addListener((changes) => {
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
});

/* --- Fermeture --- */

Albert.popupPosition = null;

Albert.closePopup = function () {
  if (Albert.activePopup) {
    if (Albert.activePopup._focusTrapHandler) {
      Albert.activePopup.removeEventListener("keydown", Albert.activePopup._focusTrapHandler);
      Albert.activePopup._focusTrapHandler = null;
    }
    Albert.activePopup.remove();
    Albert.activePopup = null;
    Albert.activePopupIdx = -1;
    Albert.popupPosition = null;
  }
  Albert.restoreFocus();
};

/* --- Fermeture par Échap ou clic en dehors --- */

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && Albert.activePopup) {
    Albert.closePopup();
  }
});

document.addEventListener("mousedown", (e) => {
  if (Albert.activePopup && !Albert.activePopup.contains(e.target)) {
    Albert.closePopup();
  }
});

/* --- Sauvegarde de la sélection avant le menu contextuel --- */

Albert.savedSelection = null;

document.addEventListener("contextmenu", (e) => {
  const activeEl = document.activeElement;
  const sel = window.getSelection();
  const clickPos = { x: e.clientX, y: e.clientY };

  if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")) {
    Albert.savedSelection = {
      type: "input",
      el: activeEl,
      start: activeEl.selectionStart,
      end: activeEl.selectionEnd,
      text: activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd),
      clickPos,
    };
  } else if (sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    /* Mémoriser l'élément éditable qui contient la sélection : le
       remplacement doit lui adresser la chaîne d'événements
       (beforeinput, textInput) attendue par les éditeurs riches. */
    const ancestor = range.commonAncestorContainer;
    const startEl = ancestor.nodeType === Node.ELEMENT_NODE
      ? ancestor
      : ancestor.parentElement;
    Albert.savedSelection = {
      type: "range",
      range: range.cloneRange(),
      host: startEl ? startEl.closest("[contenteditable]") : null,
      text: sel.toString(),
      clickPos,
    };
  } else {
    Albert.savedSelection = null;
  }
  Albert.log("contextmenu:",
    Albert.savedSelection ? Albert.savedSelection.type : "null",
    Albert.savedSelection ? "len=" + Albert.savedSelection.text.length : "",
    window.top !== window ? "(iframe " + location.href + ")" : "");
});
