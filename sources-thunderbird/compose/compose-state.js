/*
 * compose-state.js - État partagé et constantes pour le compose Thunderbird.
 *
 * Déclare l'objet global "Albert" pour la fenêtre de composition.
 * Contrairement à Firefox (où Albert est attaché à window et partagé
 * entre tous les champs d'une page), Thunderbird n'a qu'un seul
 * champ éditable par fenêtre de composition.
 *
 * Ce module charge également le dictionnaire personnel et le thème
 * depuis browser.storage.local, et synchronise les changements.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

const Albert = {
  /* Drapeaux */
  applyingCorrection: false,

  /* État du champ de composition (un seul champ par fenêtre) */
  composeState: null,

  /* Mots ignorés (dictionnaire personnel) */
  ignoredWords: new Set(),

  /* Thème courant */
  popupTheme: "dark",

  /* Limites API côté client */
  limits: null,
  requestTimestamps: [],

  /* Debounce */
  DEBOUNCE_SHORT: 1500,
  DEBOUNCE_MAX: 4000,

  /* Seuils badge */
  BADGE_MIN_LENGTH: 3,

  /* État courant du badge (null | "loading" | "ok" | "has-errors" | "error") */
  badgeState: null,

  /* Dernière erreur connue : { message, retryAfter, timestamp } ou null */
  lastError: null,
};

/* Helpers de log uniformes - préfixés [Albert] pour grep facile dans la console */
Albert.log = function () {
  console.log("[Albert]", ...arguments);
};
Albert.warn = function () {
  console.warn("[Albert]", ...arguments);
};
Albert.error = function () {
  console.error("[Albert]", ...arguments);
};

/* Charger les mots ignorés et le thème au démarrage */
(async () => {
  const data = await browser.storage.local.get(["ignoredWords", "popupTheme"]);
  if (data.ignoredWords) {
    Albert.ignoredWords = new Set(data.ignoredWords);
  }
  Albert.popupTheme = data.popupTheme || "dark";
})();

/* Synchroniser les changements de storage */
browser.storage.onChanged.addListener((changes) => {
  if (changes.ignoredWords) {
    Albert.ignoredWords = new Set(changes.ignoredWords.newValue || []);
  }
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
});
