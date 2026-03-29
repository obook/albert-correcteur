/* compose-debounce.js --- Double debounce adaptatif pour le compose Thunderbird. */

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
