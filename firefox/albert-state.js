// albert-state.js — État partagé et configuration.
// Toutes les constantes et variables globales utilisées par les autres modules.

"use strict";

window.Albert = {
  // ── Configuration ──
  DEBOUNCE_MS: 3000,
  MIN_TEXT_LENGTH: 10,
  CYCLE_INTERVAL_MS: 30000,
  SCAN_DEBOUNCE_MS: 500,

  // URL du logo embarqué dans l'extension
  ICON_URL: browser.runtime.getURL("icons/icon.svg"),

  // ── État global ──
  fieldStates: new WeakMap(),
  trackedFields: new Set(),
  activePopup: null,
  checkInProgress: false,
  rateLimited: false,
};
