/*
 * lang-names.js - Noms des langues prises en charge.
 *
 * Source unique pour l'affichage d'un code langue à l'utilisateur.
 * La table était auparavant recopiée en ligne à quatre endroits, avec
 * des casses différentes selon le contexte d'affichage.
 *
 * Deux formes sont fournies :
 *   - Albert.LANG_LABELS : capitalisée, pour un libellé isolé
 *     (options d'un sélecteur, direction de traduction) ;
 *   - Albert.LANG_NAMES_LOWER : en minuscules, pour une insertion au
 *     fil d'une phrase (« Langue détectée : français »).
 *
 * Le service worker dispose de sa propre table LANG_NAMES dans
 * service-langue.js : elle sert à construire les prompts, pas à
 * l'affichage, et n'a pas à suivre les évolutions de présentation.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

/* Le namespace existe déjà dans les content scripts et les compose
   scripts ; il est créé ici pour la popup de traduction en lecture de
   message, qui est une page autonome. */
window.Albert = window.Albert || {};

Albert.LANG_LABELS = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  de: "Allemand",
};

Albert.LANG_NAMES_LOWER = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
  de: "allemand",
};

/**
 * Renvoie le nom affichable d'un code langue.
 *
 * @param {string} code - Code langue (fr, en, es, de).
 * @param {boolean} [capitalise] - Vrai pour la forme capitalisée.
 * @returns {string} Nom de la langue, ou le code lui-même si inconnu.
 */
Albert.nomLangue = function (code, capitalise) {
  const table = capitalise ? Albert.LANG_LABELS : Albert.LANG_NAMES_LOWER;
  return table[code] || code || "";
};
