/*
 * albert-paragraphes.js - Découpage du texte en paragraphes.
 *
 * Permet la vérification incrémentale (albert-check.js) : on ne renvoie
 * à l'API que le paragraphe modifié quand un seul a changé, plutôt que
 * de re-vérifier tout le texte.
 *
 * Dépendances :
 *   - albert-state.js (objet global Albert)
 *
 * Auteur : O. Booklage
 * Date : mai 2026
 * Licence : MIT
 */

"use strict";

/**
 * Découpe un texte en paragraphes avec leurs offsets.
 *
 * Chaque paragraphe non vide est retourné avec son offset dans le
 * texte complet, ce qui permet la vérification incrémentale : seul le
 * paragraphe modifié est renvoyé à l'API.
 *
 * @param {string} text - Texte complet à découper.
 * @returns {Array<{text: string, offset: number}>} Paragraphes et leurs offsets.
 */
Albert.splitParagraphs = function (text) {
  const paragraphs = [];
  const lines = text.split("\n");
  let offset = 0;
  for (const line of lines) {
    if (line.trim().length > 0) {
      paragraphs.push({ text: line, offset: offset });
    }
    offset += line.length + 1; /* +1 pour le \n */
  }
  return paragraphs;
};

/**
 * Trouve le paragraphe modifié entre deux versions du texte.
 *
 * @param {Array} oldParagraphs - Paragraphes de l'ancien texte.
 * @param {Array} newParagraphs - Paragraphes du nouveau texte.
 * @returns {number} Index du paragraphe modifié, ou -1 dans deux cas
 *                   indistincts par l'appelant : le nombre de
 *                   paragraphes a changé, ou plus d'un paragraphe a
 *                   été modifié. Dans les deux cas, la vérification
 *                   incrémentale n'est plus sûre et l'appelant doit
 *                   tomber en mode complet.
 */
Albert.findModifiedParagraph = function (oldParagraphs, newParagraphs) {
  if (oldParagraphs.length !== newParagraphs.length) return -1;
  let modifiedIdx = -1;
  for (let i = 0; i < newParagraphs.length; i++) {
    if (oldParagraphs[i].text !== newParagraphs[i].text) {
      if (modifiedIdx !== -1) return -1; /* plusieurs paragraphes modifiés */
      modifiedIdx = i;
    }
  }
  return modifiedIdx;
};
