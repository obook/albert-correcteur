// compose-main.js --- Point d'entrée du compose script Thunderbird.

"use strict";

(async () => {
  Albert.composeState = {
    corrections: [],
    checkedText: null,
  };

  await Albert.loadLimits();

  Albert.createBadge();

  const body = Albert.getComposeBody();
  if (!body) return;

  body.addEventListener("input", (e) => {
    if (Albert.applyingCorrection) return;

    Albert.closeCorrectionPopup();
    Albert.clearUnderlines();
    Albert.setBadgeState(null);
    Albert.scheduleCheck();
  });

  let composing = false;
  body.addEventListener("compositionstart", () => { composing = true; });
  body.addEventListener("compositionend", () => {
    composing = false;
    Albert.scheduleCheck();
  });

  body.addEventListener("paste", () => {
    setTimeout(() => {
      if (Albert.debounceTimer) clearTimeout(Albert.debounceTimer);
      if (Albert.debounceMaxTimer) { clearTimeout(Albert.debounceMaxTimer); Albert.debounceMaxTimer = null; }
      const text = Albert.getBodyText();
      if (text.trim().length >= Albert.BADGE_MIN_LENGTH) {
        Albert.requestCheck(text);
      }
    }, 100);
  });

  const initialText = Albert.getBodyText();
  if (initialText.trim().length >= Albert.BADGE_MIN_LENGTH) {
    setTimeout(() => Albert.requestCheck(initialText), 500);
  }
})();
