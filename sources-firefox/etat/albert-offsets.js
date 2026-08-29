/*
 * albert-offsets.js - Manipulation des offsets de corrections.
 *
 * Trois fonctions transversales utilisées après réception ou affichage
 * de corrections :
 *
 *   - migrateCorrections(corrections, oldText, newText) :
 *     ajuste les offsets après une frappe utilisateur, sans relancer
 *     d'appel API. Les corrections chevauchant la zone éditée sont
 *     invalidées.
 *
 *   - recalibrateOffsets(corrections, text) :
 *     corrige les offsets renvoyés par le LLM, qui se trompe souvent
 *     de quelques caractères, en cherchant l'occurrence la plus proche
 *     du mot erroné dans le texte réel.
 *
 *   - filterIgnoredCorrections(corrections, text) :
 *     supprime les corrections portant sur un mot présent dans le
 *     dictionnaire personnel (Albert.ignoredWords).
 *
 * Dépendances :
 *   - albert-state.js (objet global Albert)
 *   - albert-utils.js (Albert.ignoredWords, alimenté par le dictionnaire)
 *
 * Auteur : O. Booklage
 * Date : mai 2026
 * Licence : MIT
 */

"use strict";

/**
 * Migre les offsets des corrections existantes après une frappe.
 *
 * Compare l'ancien et le nouveau texte pour localiser la zone éditée,
 * puis applique trois règles :
 * - Correction avant l'édition : inchangée.
 * - Correction chevauchant la zone éditée : invalidée (null -> filtrée).
 * - Correction après l'édition : décalée du delta de longueur.
 *
 * @param {Array} corrections - Tableau de corrections existantes.
 * @param {string} oldText    - Texte avant la frappe.
 * @param {string} newText    - Texte après la frappe.
 * @returns {Array} Corrections avec offsets ajustés (sans les invalidées).
 */
Albert.migrateCorrections = function (corrections, oldText, newText) {
  const delta = newText.length - oldText.length;
  if (delta === 0 || !corrections || corrections.length === 0) return corrections;

  /* Trouver la position de divergence depuis le début */
  let editStart = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (editStart < minLen && oldText[editStart] === newText[editStart]) {
    editStart++;
  }
  /* Fin de la zone éditée dans l'ancien texte. Pour une insertion pure
     (delta > 0), la zone est ponctuelle (editEndOld == editStart). Pour
     une suppression (delta < 0), la zone couvre |delta| caractères. */
  const editEndOld = editStart + Math.max(0, -delta);

  /* Trois zones disjointes dans l'ancien texte :
       [0, editStart[           : avant l'édition  -> inchangé
       [editStart, editEndOld[  : zone éditée      -> invalider
       [editEndOld, ...[        : après l'édition  -> décaler de delta */
  return corrections.map((c) => {
    const cEnd = c.offset + c.length;
    if (cEnd <= editStart) return c;
    if (c.offset >= editEndOld) {
      return Object.assign({}, c, { offset: c.offset + delta });
    }
    return null;
  }).filter(Boolean);
};

/**
 * Recalibre les offsets renvoyés par le LLM en cherchant le mot
 * erroné dans le texte réel.
 *
 * Le LLM se trompe souvent de quelques caractères, surtout en présence
 * d'accents ou de ponctuation. On garde l'offset original si le mot y
 * est bien, sinon on cherche l'occurrence la plus proche.
 *
 * Note : service-api.js applique déjà une recalibration équivalente
 * côté worker pour fiabiliser les corrections renvoyées via
 * runtime.sendMessage (utile à Thunderbird qui ne dispose pas de cette
 * fonction). Le double passage est volontaire car cette version ajoute
 * un filtre des corrections hors-limites du texte (filter à la fin).
 *
 * @param {Array} corrections - Corrections brutes du LLM.
 * @param {string} text       - Texte original envoyé au LLM.
 * @returns {Array} Corrections avec offsets recalibrés.
 */
Albert.recalibrateOffsets = function (corrections, text) {
  /* Recherche sur des copies normalisées : innerText garde les espaces
     insécables du DOM là où le modèle rend un espace ordinaire. La
     substitution est de un caractère pour un, les offsets obtenus
     valent donc pour text (cf. util/blancs.js). */
  const texteNorme = Albert.normaliserBlancs(text);

  return corrections.map((c) => {
    const word = c.word || text.slice(c.offset, c.offset + c.length);
    const mot = Albert.normaliserBlancs(word);
    const atOffset = texteNorme.slice(c.offset, c.offset + mot.length);

    /* L'offset est déjà correct */
    if (atOffset === mot) {
      return { ...c, offset: c.offset, length: word.length };
    }

    /* Chercher l'occurrence la plus proche de l'offset du LLM */
    let bestIdx = -1;
    let searchFrom = 0;
    while (searchFrom < texteNorme.length) {
      const idx = texteNorme.indexOf(mot, searchFrom);
      if (idx === -1) break;
      if (bestIdx === -1 || Math.abs(idx - c.offset) < Math.abs(bestIdx - c.offset)) {
        bestIdx = idx;
      }
      searchFrom = idx + 1;
    }

    if (bestIdx !== -1) {
      return { ...c, offset: bestIdx, length: word.length };
    }

    /* Mot introuvable : garder l'offset original */
    return c;
  }).filter((c) => c.offset >= 0 && c.offset + c.length <= text.length);
};

/**
 * Filtre les corrections en excluant les mots du dictionnaire personnel.
 *
 * @param {Array} corrections - Corrections à filtrer.
 * @param {string} text       - Texte complet (pour extraire les mots).
 * @returns {Array} Corrections sans les mots ignorés.
 */
Albert.filterIgnoredCorrections = function (corrections, text) {
  return corrections.filter((c) => {
    const word = text.slice(c.offset, c.offset + c.length).toLowerCase();
    return !Albert.ignoredWords.has(word);
  });
};
