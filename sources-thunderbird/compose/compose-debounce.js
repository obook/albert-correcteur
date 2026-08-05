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
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.debounceTimer = null;
Albert.debounceMaxTimer = null;

/**
 * Annule les deux temporisateurs de vérification en attente.
 *
 * Les identifiants de timer appartiennent à ce module : les effacer
 * depuis un autre fichier revenait à toucher son état interne, au
 * risque de supprimer une vérification programmée entre-temps.
 */
Albert.cancelDebounce = function () {
  if (Albert.debounceTimer) {
    clearTimeout(Albert.debounceTimer);
    Albert.debounceTimer = null;
  }
  if (Albert.debounceMaxTimer) {
    clearTimeout(Albert.debounceMaxTimer);
    Albert.debounceMaxTimer = null;
  }
};

Albert.scheduleCheck = function () {
  const text = Albert.getBodyText();
  if (text.trim().length < Albert.BADGE_MIN_LENGTH) {
    Albert.log("scheduleCheck : texte trop court (", text.trim().length, "<", Albert.BADGE_MIN_LENGTH, "), réinitialisation badge");
    Albert.clearUnderlines();
    Albert.setBadgeState(null);
    return;
  }

  if (Albert.debounceTimer) clearTimeout(Albert.debounceTimer);

  Albert.debounceTimer = setTimeout(() => {
    Albert.log("scheduleCheck : debounce court écoulé (", Albert.DEBOUNCE_SHORT, "ms), déclenchement requestCheck");
    Albert.requestCheck(text);
  }, Albert.DEBOUNCE_SHORT);

  if (!Albert.debounceMaxTimer) {
    Albert.log("scheduleCheck : démarrage timer max (", Albert.DEBOUNCE_MAX, "ms)");
    Albert.debounceMaxTimer = setTimeout(() => {
      Albert.debounceMaxTimer = null;
      if (Albert.debounceTimer) {
        clearTimeout(Albert.debounceTimer);
        Albert.debounceTimer = null;
      }
      const currentText = Albert.getBodyText();
      if (currentText.trim().length >= Albert.BADGE_MIN_LENGTH) {
        Albert.log("scheduleCheck : debounce max écoulé, déclenchement forcé requestCheck");
        Albert.requestCheck(currentText);
      }
    }, Albert.DEBOUNCE_MAX);
  }
};
