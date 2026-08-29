/*
 * blancs.js - Normalisation des espaces particuliers.
 *
 * Le texte envoyé au modèle vient de innerText, qui conserve les
 * espaces insécables du DOM. Le modèle, lui, rend presque toujours un
 * espace ordinaire dans le mot qu'il signale. Toute comparaison ou
 * recherche exacte entre les deux échoue alors sur ce seul caractère.
 * Le cas est fréquent en français, où l'insécable précède ; : ! ? et
 * habite les guillemets comme les séparateurs de milliers : la
 * correction était refusée avec "le texte a changé".
 *
 * La substitution est de un caractère pour un caractère. Un offset
 * trouvé dans la chaîne normalisée reste donc valable dans la chaîne
 * d'origine, ce qui permet de chercher sur une copie normalisée et de
 * découper l'originale au résultat.
 *
 * Utilisé par :
 *   - Firefox     : albert-offsets.js, albert-apply.js, albert-apply-rich.js
 *   - Thunderbird : compose-utils.js, compose-apply.js
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

/* Insécable, insécable étroite, insécable des chiffres, fine. Ces quatre
   caractères sont invisibles à la relecture : le test test-blancs.js
   vérifie que la classe les couvre bien tous les quatre. */
const ESPACES_PARTICULIERS = /[    ]/g;

/**
 * Ramène les espaces particuliers d'un texte à l'espace ordinaire.
 *
 * @param {string} texte - Texte à normaliser.
 * @returns {string} Texte de même longueur, sans espace particulier.
 */
function normaliserBlancs(texte) {
  if (typeof texte !== "string") return texte;
  return texte.replace(ESPACES_PARTICULIERS, " ");
}

/**
 * Compare deux textes en ignorant la nature de leurs espaces.
 *
 * @param {string} a - Premier texte.
 * @param {string} b - Second texte.
 * @returns {boolean} true si les deux textes ne diffèrent que par la
 *          nature de leurs espaces, ou pas du tout.
 */
function memeTexte(a, b) {
  return normaliserBlancs(a) === normaliserBlancs(b);
}

/* Publication sur self et non window : le module sert aussi au service
   worker, qui recalibre les offsets du modèle et n'a pas de window. */
if (typeof self !== "undefined") {
  self.Albert = self.Albert || {};
  self.Albert.normaliserBlancs = normaliserBlancs;
  self.Albert.memeTexte = memeTexte;
}

/* Export pour les tests Node. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { normaliserBlancs, memeTexte };
}
