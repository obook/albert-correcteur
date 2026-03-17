// albert-state.js — État partagé et configuration.
// Toutes les constantes et variables globales utilisées par les autres modules.

"use strict";

window.Albert = {
  // ── Configuration ──
  DEBOUNCE_MS: 3000,
  MIN_TEXT_LENGTH: 10,
  CYCLE_INTERVAL_MS: 30000,
  SCAN_DEBOUNCE_MS: 500,

  // URLs des logos embarqués dans l'extension
  ICON_URL: browser.runtime.getURL("icons/icon.svg"),
  ICON_OK_URL: browser.runtime.getURL("icons/icon-ok.svg"),

  // ── État global ──
  fieldStates: new WeakMap(),
  trackedFields: new Set(),
  activePopup: null,
  activePopupEl: null,       // champ associé au popup actif
  activePopupIdx: -1,        // index de la correction affichée dans le popup
  checkInProgress: false,
  rateLimited: false,
  mode: "correction",        // "correction" ou "reformulation"
  ignoredWords: new Set(),   // dictionnaire personnel (mots à ignorer)

  // ── Limites API ──
  limits: null,            // { rpm, rpd, tpm, tpd } depuis /v1/me/info
  requestTimestamps: [],   // timestamps des requêtes récentes (pour compter rpm)
  requestCountToday: 0,    // compteur de requêtes du jour
  requestDayStart: 0,      // début de la journée courante (timestamp ms)
};
