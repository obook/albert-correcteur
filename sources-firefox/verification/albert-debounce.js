/*
 * albert-debounce.js - Double debounce adaptatif pour la vérification.
 *
 * Mécanisme de temporisation à deux niveaux :
 *   - Timer court : réinitialisé à chaque frappe. Déclenche la
 *     vérification quand l'utilisateur arrête de taper.
 *   - Timer long : lancé une seule fois à la première frappe.
 *     Garantit une vérification même si l'utilisateur tape sans
 *     pause (frappe continue).
 *
 * Adaptation automatique :
 *   Si le nombre de requêtes récentes atteint 80 % du quota rpm,
 *   les délais sont allongés pour éviter de dépasser la limite.
 *
 * Annulation :
 *   Si une requête API est déjà en cours (AbortController), elle
 *   est annulée avant de programmer la suivante.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/**
 * Programme une vérification différée pour un champ.
 *
 * @param {HTMLElement} el - Champ de saisie à vérifier.
 */
Albert.scheduleCheck = function (el) {
  const state = Albert.getOrCreateState(el);

  /* Annuler la requête API en cours si l'utilisateur continue de taper */
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }

  /* Choisir les délais : normaux ou ralentis si on approche de la limite */
  let delay = Albert.DEBOUNCE_MS;
  let maxDelay = Albert.MAX_DEBOUNCE_MS;
  const limits = Albert.limits;
  if (limits && limits.rpm) {
    const now = Date.now();
    const recentCount = Albert.requestTimestamps.filter(t => now - t < 60000).length;
    if (recentCount >= limits.rpm * 0.8) {
      delay = Albert.THROTTLE_DEBOUNCE_MS;
      maxDelay = Albert.THROTTLE_MAX_DEBOUNCE_MS;
    }
  }

  /* Timer court : réinitialisé à chaque frappe */
  clearTimeout(state.timer);
  state.timer = setTimeout(() => Albert.triggerCheck(el), delay);

  /* Timer long : lancé une seule fois (première frappe de la séquence),
     garantit une vérification même si l'utilisateur tape sans pause */
  if (!state.maxTimer) {
    state.maxTimer = setTimeout(() => {
      clearTimeout(state.timer);
      state.timer = null;
      Albert.triggerCheck(el);
    }, maxDelay);
  }
};
