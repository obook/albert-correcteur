/* albert-state.js - État partagé et configuration.
   Toutes les constantes et variables globales utilisées par les autres modules. */

"use strict";

window.Albert = {
  /* --- Configuration ---
     Les délais de debounce sont calculés automatiquement par updateDebounceFromRpm()
     en fonction du rpm du compte. Valeurs par défaut prudentes (rpm inconnu). */
  DEBOUNCE_MS: 3000,
  MAX_DEBOUNCE_MS: 10000,
  THROTTLE_DEBOUNCE_MS: 8000,     /* délai quand on approche de la limite rpm */
  THROTTLE_MAX_DEBOUNCE_MS: 20000,
  STOPPED_TYPING_MS: 2000,
  MIN_TEXT_LENGTH: 10,
  CYCLE_INTERVAL_MS: 30000,
  SCAN_DEBOUNCE_MS: 500,

  /* URLs des logos embarqués dans l'extension */
  ICON_URL: browser.runtime.getURL("icons/icon.svg"),
  ICON_ERROR_URL: browser.runtime.getURL("icons/icon-error.svg"),

  /* --- État global --- */
  fieldStates: new WeakMap(),
  trackedFields: new Set(),
  activePopup: null,
  activePopupIdx: -1,        /* index de la correction affichée dans le popup */
  checkInProgress: false,
  rateLimited: false,
  mode: "correction",        /* "correction" ou "reformulation" */
  ignoredWords: new Set(),   /* dictionnaire personnel (mots à ignorer) */

  /* --- Limites API --- */
  limits: null,            /* { rpm, rpd, tpm, tpd } depuis /v1/me/info */
  requestTimestamps: [],   /* timestamps des requêtes récentes (pour compter rpm) */
  requestCountToday: 0,    /* compteur de requêtes du jour */
  requestDayStart: 0,      /* début de la journée courante (timestamp ms) */
};
