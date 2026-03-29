/* compose-state.js --- Constantes et état global pour la fenêtre de composition Thunderbird. */

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
