/*
 * albert-popup-common.js - Fonctions partagées par toutes les popups.
 *
 * Ce module fournit les services communs aux popups de correction,
 * reformulation et traduction :
 *   - Thème : détection du thème (sombre, clair, système).
 *   - Fermeture : closePopup() avec restauration du focus.
 *   - Piège de focus : trapFocus() pour l'accessibilité RGAA
 *     (la navigation Tab reste dans la popup).
 *   - Fermeture par Échap ou clic en dehors de la popup.
 *   - Sauvegarde de la sélection avant le menu contextuel
 *     (nécessaire pour la reformulation et la traduction).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
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
Albert._previousFocus = null;

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
  if (Albert._previousFocus && Albert._previousFocus.focus) {
    Albert._previousFocus.focus();
    Albert._previousFocus = null;
  }
};

/* --- Focus trap (accessibilité RGAA) --- */

Albert.trapFocus = function (popup) {
  if (!Albert._previousFocus) {
    const prev = document.activeElement;
    Albert._previousFocus = (prev && prev !== document.body) ? prev : null;
  }
  const focusables = popup.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  first.focus();
  popup._focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const current = popup.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const f = current[0];
    const l = current[current.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === f) {
        e.preventDefault();
        l.focus();
      }
    } else {
      if (document.activeElement === l) {
        e.preventDefault();
        f.focus();
      }
    }
  };
  popup.addEventListener("keydown", popup._focusTrapHandler);
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
    Albert.savedSelection = {
      type: "range",
      range: range.cloneRange(),
      text: sel.toString(),
      clickPos,
    };
  } else {
    Albert.savedSelection = null;
  }
});
