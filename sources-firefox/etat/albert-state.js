/*
 * albert-state.js - État partagé et configuration de l'extension Albert.
 *
 * Ce fichier déclare l'objet global "Albert" qui porte toutes les
 * constantes, variables d'état et références partagées entre les
 * modules du content script Firefox.
 *
 * Architecture :
 *   albert-state.js (ce fichier)
 *       ↓ fournit l'objet global Albert à :
 *   albert-main.js          - point d'entrée, scan des champs
 *   albert-check.js         - envoi des textes au service worker
 *   albert-render*.js       - affichage des corrections (overlay, badge)
 *   albert-apply*.js        - application des suggestions
 *   albert-popup-*.js       - popups de correction, reformulation, traduction
 *   albert-debounce.js      - temporisation adaptative des vérifications
 *   albert-limites.js       - suivi des limites API (rpm/rpd)
 *   albert-utils.js         - fonctions utilitaires (détection, migration)
 *
 * Les délais de debounce sont recalculés dynamiquement par
 * updateDebounceFromRpm() (albert-limites.js) dès que les limites
 * du compte sont connues.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

window.Albert = {
  // ===============================================================
  //  LOGS DE DIAGNOSTIC
  // ===============================================================

  /*
   * Activable depuis la console : window.Albert.DEBUG = true
   * Les méthodes log/info ne s'expriment que si DEBUG est vrai.
   * warn et error sont toujours actifs, pour ne pas masquer
   * un crash silencieux.
   */
  DEBUG: false,
  log(...args)   { if (this.DEBUG) console.info("[Albert]", ...args); },
  info(...args)  { if (this.DEBUG) console.info("[Albert]", ...args); },
  warn(...args)  { console.warn("[Albert]", ...args); },
  error(...args) { console.error("[Albert]", ...args); },

  // ===============================================================
  //  CONFIGURATION
  // ===============================================================

  /*
   * Délais de debounce (en ms).
   * Valeurs par défaut prudentes, adaptées à un quota rpm inconnu.
   * Recalculées par updateDebounceFromRpm() une fois les limites chargées.
   */
  DEBOUNCE_MS: 3000,
  MAX_DEBOUNCE_MS: 10000,
  THROTTLE_DEBOUNCE_MS: 8000,     /* délai quand on approche de la limite rpm */
  THROTTLE_MAX_DEBOUNCE_MS: 20000,
  STOPPED_TYPING_MS: 2000,
  MIN_TEXT_LENGTH: 10,
  CYCLE_INTERVAL_MS: 30000,
  SCAN_DEBOUNCE_MS: 500,

  // ===============================================================
  //  ICÔNES
  // ===============================================================

  /* URLs des logos embarqués dans l'extension (résolues par le runtime) */
  ICON_URL: browser.runtime.getURL("icons/icon.svg"),
  ICON_OK_URL: browser.runtime.getURL("icons/icon-ok.svg"),
  ICON_ERROR_URL: browser.runtime.getURL("icons/icon-error.svg"),

  // ===============================================================
  //  ÉTAT GLOBAL
  // ===============================================================

  fieldStates: new WeakMap(),
  trackedFields: new Set(),
  activePopup: null,
  activePopupIdx: -1,        /* index de la correction affichée dans le popup */
  checkInProgress: false,
  rateLimited: false,
  mode: "correction",        /* "correction" ou "reformulation" */
  ignoredWords: new Set(),   /* dictionnaire personnel (mots à ignorer) */
  lastApiError: null,        /* { message, type, at } - dernière erreur API,
                                 affichée dans le tooltip du badge en panne */

  // ===============================================================
  //  LIMITES API
  // ===============================================================

  limits: undefined,            /* { rpm, rpd, tpm, tpd } depuis /v1/me/info */
  requestCountToday: 0,    /* compteur de requêtes du jour */
  requestDayStart: 0,      /* début de la journée courante (timestamp ms) */
};
/* requestWindow (Albert.RollingWindow, fenêtre 60s) est créé dans
   verification/albert-limites.js, après le chargement de
   verification/rolling-window.js. */
