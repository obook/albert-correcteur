/*
 * albert-apply-segments.js - Recherche d'un nœud texte par offset.
 *
 * La table de correspondance entre les offsets de innerText et les
 * nœuds texte est construite par util/inner-text.js, partagé avec
 * Thunderbird (Albert.buildInnerTextSegments). Ce module ne garde que
 * la recherche d'un offset dans cette table.
 *
 * Utilisé par :
 *   - albert-apply.js      (_applyInSimpleContentEditable)
 *   - albert-apply-rich.js (applyViaSelection)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/*
 * À partir d'un tableau de segments et d'un offset global, trouve le nœud texte
 * et l'offset local correspondant. Retourne null si introuvable.
 */
Albert.findSegmentAt = function (segments, globalOffset) {
  for (const seg of segments) {
    if (globalOffset >= seg.start && globalOffset <= seg.end) {
      /* nodeStart : offset du premier caractère aligné du segment dans
         son nœud, non nul quand des blancs de tête ont été effondrés
         par le rendu (voir util/inner-text.js). */
      return { node: seg.node, offset: globalOffset - seg.start + (seg.nodeStart || 0) };
    }
  }
  return null;
};
