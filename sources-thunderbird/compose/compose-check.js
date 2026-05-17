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

  if (state.checkedText === text) {
    Albert.log("requestCheck ignoré : texte identique au dernier vérifié (", text.length, "car.)");
    return;
  }

  if (!Albert.checkRateLimit()) {
    Albert.warn("requestCheck reporté : rate-limit local atteint (", Albert.requestWindow.total(), "/", Albert.limits && Albert.limits.rpm, "rpm)");
    Albert.lastError = { message: "Limite API approchée, vérification reportée.", retryAfter: null, timestamp: Date.now() };
    Albert.showToast("Limite API approchée, vérification reportée.");
    return;
  }

  /* On ne peut pas annuler le sendMessage en cours, mais on marque
   * le contrôleur précédent comme "aborted" pour ignorer son résultat
   * quand il arrivera (pattern "discard stale result"). */
  if (Albert.pendingAbort) {
    Albert.log("requestCheck : abandon de la requête précédente (stale)");
    Albert.pendingAbort.abort();
  }
  const controller = new AbortController();
  Albert.pendingAbort = controller;

  Albert.setBadgeState("loading");
  Albert.recordRequest();
  Albert.log("requestCheck : envoi au service worker (", text.length, "car.)");

  browser.runtime.sendMessage({ type: "check", text: text, mode: "correction" }).then((result) => {
    if (controller.signal.aborted) {
      Albert.log("requestCheck : résultat ignoré (requête abandonnée)");
      return;
    }
    Albert.pendingAbort = null;

    if (Albert.debounceTimer) { clearTimeout(Albert.debounceTimer); Albert.debounceTimer = null; }
    if (Albert.debounceMaxTimer) { clearTimeout(Albert.debounceMaxTimer); Albert.debounceMaxTimer = null; }

    if (!result) {
      Albert.error("requestCheck : réponse vide du service worker");
      Albert.lastError = { message: "Réponse vide du service worker.", retryAfter: null, timestamp: Date.now() };
      Albert.setBadgeState("error");
      Albert.showToast("Réponse vide du service worker.");
      return;
    }

    if (result.error) {
      Albert.warn("requestCheck : erreur API :", result.error, result.retryAfter ? "(retryAfter=" + result.retryAfter + "s)" : "");
      Albert.lastError = { message: result.error, retryAfter: result.retryAfter || null, timestamp: Date.now() };
      Albert.setBadgeState("error");
      if (result.retryAfter) {
        Albert.showToast(result.error, result.retryAfter * 1000);
      } else {
        Albert.showToast(result.error);
      }
      return;
    }

    Albert.lastError = null;
    state.checkedText = text;
    const filtered = Albert.filterIgnoredCorrections(result.corrections);
    Albert.log("requestCheck : OK,", filtered.length, "correction(s) après filtrage (", (result.corrections || []).length, "brutes)");
    Albert.renderCorrections(filtered);
  }).catch((err) => {
    if (controller.signal.aborted) {
      Albert.log("requestCheck : exception sur requête abandonnée - ignorée");
      return;
    }
    Albert.error("requestCheck : exception sendMessage :", err);
    const msg = (err && err.message) ? err.message : "Erreur réseau ou service worker indisponible.";
    Albert.lastError = { message: msg, retryAfter: null, timestamp: Date.now() };
    Albert.setBadgeState("error");
    Albert.showToast("Erreur : " + msg);
  });
};
