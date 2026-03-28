// albert-apply-segments.js — Mapping innerText ↔ nœuds texte DOM.
// Convertit un offset de caractère (tel que vu dans innerText) en position
// { nœud texte, offset local } dans l'arbre DOM. Gère les <br> et blocs
// imbriqués qui ajoutent des \n implicites dans innerText.

"use strict";

const BLOCK_TAGS = ["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"];

// Construit un tableau de segments { node, start, end } pour chaque nœud texte.
Albert.buildInnerTextSegments = function (el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL);
  const segments = [];
  let innerOffset = 0;
  let lastNewlineNode = null;
  let current;

  while ((current = walker.nextNode())) {
    if (current.nodeType === Node.TEXT_NODE) {
      const len = current.textContent.length;
      segments.push({ node: current, start: innerOffset, end: innerOffset + len });
      innerOffset += len;
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();
      // innerText ajoute \n pour <br>, <p>, <div>, etc.
      // Pour les blocs imbriqués (<div><p>…), innerText n'ajoute qu'un seul \n :
      // on ne déduplique que si le bloc courant est DANS le nœud précédent (parenté DOM).
      if (tag === "br") {
        innerOffset += 1;
        lastNewlineNode = current;
      } else if (BLOCK_TAGS.includes(tag)) {
        if (innerOffset > 0 && (!lastNewlineNode || !lastNewlineNode.contains(current))) {
          innerOffset += 1;
        }
        lastNewlineNode = current;
      }
    }
  }

  return segments;
};

// À partir d'un tableau de segments et d'un offset global, trouve le nœud texte
// et l'offset local correspondant. Retourne null si introuvable.
Albert.findSegmentAt = function (segments, globalOffset) {
  for (const seg of segments) {
    if (globalOffset >= seg.start && globalOffset <= seg.end) {
      return { node: seg.node, offset: globalOffset - seg.start };
    }
  }
  return null;
};
