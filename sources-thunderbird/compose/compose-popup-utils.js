/*
 * compose-popup-utils.js - Utilitaires partagés par les popups Thunderbird.
 *
 * Fournit les fonctions communes aux popups de correction,
 * reformulation et traduction dans la fenêtre de composition :
 *   - Piège de focus et restauration : délégués à
 *     util/popup-focus.js, partagé entre les cibles.
 *   - closeCorrectionPopup() : ferme la popup de correction.
 *   - Écouteurs globaux      : fermeture par Escape ou clic en dehors.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.correctionPopup = null;
Albert.activePopupIdx = 0;

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

/* Fermeture par Escape ou clic en dehors.
 *
 * Un seul écouteur pour les trois popups : chacune avait le sien, tous
 * exécutés à chaque touche frappée dans le compose, et chacun ignorait
 * les deux autres popups. */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  Albert.closeCorrectionPopup();
  if (Albert.closeReformulationPopup) Albert.closeReformulationPopup();
  if (Albert.closeTranslationPopup) Albert.closeTranslationPopup();
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
