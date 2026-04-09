/*
 * compose-check.js - Envoi de la vérification au service worker (Thunderbird).
 *
 * Envoie le texte du corps du message au service worker pour
 * correction via browser.runtime.sendMessage. Utilise un pattern
 * "discard stale result" : si une nouvelle requête est lancée
 * avant que la précédente ne revienne, le résultat périmé est ignoré.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.pendingAbort = null;

Albert.requestCheck = function (text) {
  const state = Albert.composeState;
  if (!state) return;

  if (state.checkedText === text) return;

  if (!Albert.checkRateLimit()) {
    Albert.showToast("Limite API approchée, vérification reportée.");
    return;
  }

  /* On ne peut pas annuler le sendMessage en cours, mais on marque
   * le contrôleur précédent comme "aborted" pour ignorer son résultat
   * quand il arrivera (pattern "discard stale result"). */
  if (Albert.pendingAbort) Albert.pendingAbort.abort();
  const controller = new AbortController();
  Albert.pendingAbort = controller;

  Albert.setBadgeState("loading");
  Albert.recordRequest();

  browser.runtime.sendMessage({ type: "check", text: text, mode: "correction" }).then((result) => {
    if (controller.signal.aborted) return;
    Albert.pendingAbort = null;

    if (Albert.debounceTimer) { clearTimeout(Albert.debounceTimer); Albert.debounceTimer = null; }
    if (Albert.debounceMaxTimer) { clearTimeout(Albert.debounceMaxTimer); Albert.debounceMaxTimer = null; }

    if (result.error) {
      Albert.setBadgeState("error");
      if (result.retryAfter) {
        Albert.showToast(result.error, result.retryAfter * 1000);
      } else {
        Albert.showToast(result.error);
      }
      return;
    }

    state.checkedText = text;
    const filtered = Albert.filterIgnoredCorrections(result.corrections);
    Albert.renderCorrections(filtered);
  }).catch(() => {
    if (!controller.signal.aborted) {
      Albert.setBadgeState("error");
    }
  });
};
