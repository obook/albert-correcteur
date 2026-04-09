/*
 * compose-debounce.js - Double debounce adaptatif (Thunderbird).
 *
 * Même principe que le debounce Firefox (albert-debounce.js) :
 * timer court réinitialisé à chaque frappe + timer long qui garantit
 * une vérification même en frappe continue.
 *
 * Les délais sont ajustés par compose-limites.js en fonction du rpm.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.debounceTimer = null;
Albert.debounceMaxTimer = null;

Albert.scheduleCheck = function () {
  const text = Albert.getBodyText();
  if (text.trim().length < Albert.BADGE_MIN_LENGTH) {
    Albert.clearUnderlines();
    Albert.setBadgeState(null);
    return;
  }

  if (Albert.debounceTimer) clearTimeout(Albert.debounceTimer);

  Albert.debounceTimer = setTimeout(() => {
    Albert.requestCheck(text);
  }, Albert.DEBOUNCE_SHORT);

  if (!Albert.debounceMaxTimer) {
    Albert.debounceMaxTimer = setTimeout(() => {
      Albert.debounceMaxTimer = null;
      if (Albert.debounceTimer) {
        clearTimeout(Albert.debounceTimer);
        Albert.debounceTimer = null;
      }
      const currentText = Albert.getBodyText();
      if (currentText.trim().length >= Albert.BADGE_MIN_LENGTH) {
        Albert.requestCheck(currentText);
      }
    }, Albert.DEBOUNCE_MAX);
  }
};
