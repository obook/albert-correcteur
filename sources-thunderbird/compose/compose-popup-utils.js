/* compose-popup-utils.js - Utilitaires partagés par les popups Thunderbird.
   Piège de focus, restauration du focus, fermeture et écouteurs globaux. */

"use strict";

Albert.correctionPopup = null;
Albert.activePopupIdx = 0;
Albert._previousFocus = null;

Albert.trapFocus = function (popup) {
  if (!Albert._previousFocus) {
    const prev = document.activeElement;
    Albert._previousFocus = (prev && prev !== document.body) ? prev : null;
  }
  const focusables = popup.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  focusables[0].focus();
  popup._focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const current = popup.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const f = current[0];
    const l = current[current.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === f) { e.preventDefault(); l.focus(); }
    } else {
      if (document.activeElement === l) { e.preventDefault(); f.focus(); }
    }
  };
  popup.addEventListener("keydown", popup._focusTrapHandler);
};

Albert.restoreFocus = function () {
  if (Albert._previousFocus && Albert._previousFocus.focus) {
    Albert._previousFocus.focus();
    Albert._previousFocus = null;
  }
};

Albert.closeCorrectionPopup = function () {
  if (Albert.correctionPopup) {
    if (Albert.correctionPopup._focusTrapHandler) {
      Albert.correctionPopup.removeEventListener(
        "keydown",
        Albert.correctionPopup._focusTrapHandler
      );
      Albert.correctionPopup._focusTrapHandler = null;
    }
    Albert.correctionPopup.remove();
    Albert.correctionPopup = null;
  }
  Albert.restoreFocus();
};

/* Fermeture par Escape ou clic en dehors */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeCorrectionPopup();
});
document.addEventListener("mousedown", (e) => {
  if (
    Albert.correctionPopup
    && !Albert.correctionPopup.contains(e.target)
    && !e.target.closest(".albert-error")
  ) {
    Albert.closeCorrectionPopup();
  }
});
