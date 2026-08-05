/*
 * compose-utils.js - Fonctions utilitaires pour le compose Thunderbird.
 *
 * Fonctions courantes utilisées par les autres modules compose :
 *   - getComposeBody()          : accès au body éditable.
 *   - getBodyText()             : texte brut du corps.
 *   - filterIgnoredCorrections() : filtre par dictionnaire personnel.
 *   - getPopupThemeClass()      : classe CSS du thème actif.
 *   - findRealOffset()          : recherche d'un mot dans le texte.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/**
 * Renvoie l'élément éditable du message en cours de composition.
 *
 * Le compose script est injecté directement dans le document de
 * l'éditeur : son corps est la zone éditable. L'accès passe malgré tout
 * par cet accesseur, seul point à reprendre si Thunderbird venait à
 * placer l'éditeur dans un cadre imbriqué, comme le font certaines
 * versions en mode texte brut.
 *
 * @returns {HTMLElement} Corps du message.
 */
Albert.getComposeBody = function () {
  return document.body;
};

/**
 * Renvoie le texte brut du message en cours de composition.
 *
 * @returns {string} Contenu textuel, tel que innerText le restitue.
 */
Albert.getBodyText = function () {
  return Albert.getComposeBody().innerText;
};

Albert.filterIgnoredCorrections = function (corrections) {
  if (!corrections || !corrections.length) return corrections;
  return corrections.filter(
    (c) => !Albert.ignoredWords.has(c.word.toLowerCase())
  );
};

Albert.getPopupThemeClass = function () {
  return Albert.popupTheme === "light" ? "albert-theme-light" : "";
};

Albert.findRealOffset = function (text, word, apiOffset) {
  const idx = text.indexOf(word, Math.max(0, apiOffset - 10));
  if (idx !== -1) return idx;
  return text.indexOf(word);
};
