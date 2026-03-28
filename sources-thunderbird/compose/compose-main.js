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
    if (composing) return; // IME en cours, ignorer

    Albert.closeCorrectionPopup();
    Albert.clearUnderlines();

    // Recréer le badge s'il a été supprimé (select all + delete efface tout le body)
    if (!document.contains(Albert.badge)) {
      Albert.badge = null;
      Albert.createBadge();
    }

    Albert.setBadgeState(null);
    Albert.scheduleCheck();
  });

  // Gestion IME/composition (langues CJK) : ignorer les événements input
  // pendant la composition pour éviter les vérifications sur du texte partiel
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
