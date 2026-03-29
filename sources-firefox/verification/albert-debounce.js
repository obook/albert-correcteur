/* albert-debounce.js - Double debounce adaptatif pour la vérification.
   Timer court (réinitialisé à chaque frappe) + timer long (garantie de vérification).
   Bascule automatiquement sur des délais plus longs si on approche de la limite rpm. */

"use strict";

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
