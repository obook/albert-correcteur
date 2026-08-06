/*
 * compose-main.js - Point d'entrée du compose script Thunderbird.
 *
 * Ce script est injecté dans chaque fenêtre de composition via
 * service-compose-scripts.js. Il initialise l'extension Albert :
 * 1. Crée l'état de composition (composeState).
 * 2. Charge les limites API.
 * 3. Crée le badge Albert dans le corps du message.
 * 4. Attache les écouteurs d'événements (input, paste, IME).
 * 5. Lance une vérification initiale si le corps contient du texte.
 *
 * Dépendances (injectées avant ce fichier) :
 *   - compose-state.js     (objet global Albert, constantes)
 *   - compose-utils.js     (getComposeBody, getBodyText)
 *   - compose-badge.js     (createBadge, setBadgeState)
 *   - compose-debounce.js  (scheduleCheck)
 *   - compose-check.js     (requestCheck)
 *   - compose-overlay.js   (clearUnderlines)
 *   - compose-limites.js   (loadLimits)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

(async () => {
  Albert.composeState = {
    corrections: [],
    checkedText: null,
  };

  await Albert.loadLimits();

  Albert.createBadge();
  Albert.watchBadge();

  const body = Albert.getComposeBody();
  if (!body) return;

  /* Déclaré avant les écouteurs qui le lisent : la saisie au clavier
     asiatique (IME) passe par composition* et ne doit pas déclencher
     de vérification tant qu'elle est en cours. */
  let composing = false;

  body.addEventListener("input", (e) => {
    if (Albert.applyingCorrection) return;
    if (composing) return; /* IME en cours, ignorer */

    Albert.closeCorrectionPopup();
    Albert.clearUnderlines();

    /* La reconstruction du badge supprimé est prise en charge par
       Albert.watchBadge(), quel que soit le chemin de suppression. */
    Albert.setBadgeState(null);
    Albert.scheduleCheck();
  });

  /* Gestion IME/composition (langues CJK) : ignorer les événements input
   * pendant la composition pour éviter les vérifications sur du texte partiel */
  body.addEventListener("compositionstart", () => { composing = true; });
  body.addEventListener("compositionend", () => {
    composing = false;
    Albert.scheduleCheck();
  });

  body.addEventListener("paste", () => {
    setTimeout(() => {
      /* Un collage justifie une vérification immédiate : annuler la
         temporisation en cours plutôt que d'attendre son échéance. */
      Albert.cancelDebounce();
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
