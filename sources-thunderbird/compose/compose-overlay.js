/*
 * compose-overlay.js - Soulignements d'erreurs dans le compose Thunderbird.
 *
 * Contrairement à Firefox (overlay transparent par-dessus le champ),
 * Thunderbird permet de modifier directement le DOM du corps du
 * message (designMode). Ce module insère des <span> colorés autour
 * des mots erronés, directement dans le DOM du body éditable.
 *
 * Fonctions principales :
 *   - clearUnderlines()     : supprime tous les spans albert-error.
 *   - createUnderlineSpan() : crée un span accessible pour une erreur.
 *   - buildTextNodeMap()    : construit la correspondance offset ↔ nœud.
 *   - applyUnderlines()     : insère les spans dans le DOM.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* Clés identiques à celles retournées par l'API (champ "type" du JSON) */
Albert.UNDERLINE_CLASSES = {
  spelling: "albert-error-spelling",
  grammar: "albert-error-grammar",
  style: "albert-error-style",
};

Albert.clearUnderlines = function () {
  const marks = document.querySelectorAll("span.albert-error");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  });
};

Albert.createUnderlineSpan = function (correction, index) {
  const span = document.createElement("span");
  span.className = "albert-error " + (Albert.UNDERLINE_CLASSES[correction.type] || "albert-error-spelling");
  span.dataset.correctionIndex = index;
  span.setAttribute("role", "button");
  span.setAttribute("tabindex", "0");
  span.setAttribute("aria-label", correction.message || "Erreur détectée");
  return span;
};

/* Construit une map des text nodes avec un offset "innerText-compatible"
 * en ajoutant les \n que innerText insère pour les éléments block (<p>, <div>, <br>). */
Albert.buildTextNodeMap = function (body) {
  const BLOCK_TAGS = new Set([
    "P", "DIV", "BR", "LI", "TR", "BLOCKQUOTE",
    "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "HR", "UL", "OL",
  ]);
  const map = [];
  let innerOffset = 0;
  let prevNode = null;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ALL, null);
  let current;
  while ((current = walker.nextNode())) {
    /* Quand on rencontre un élément block ou <br>, innerText ajoute un \n */
    if (current.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(current.tagName)) {
      /* <br> ajoute un \n, les blocs ouvrants aussi (sauf le premier enfant du body) */
      if (current.tagName === "BR") {
        innerOffset += 1;
      } else if (prevNode) {
        /* Un bloc ajoute un \n si ce n'est pas le tout premier contenu */
        innerOffset += 1;
      }
    }
    if (current.nodeType === Node.TEXT_NODE && current.textContent.length > 0) {
      map.push({ node: current, start: innerOffset, end: innerOffset + current.textContent.length });
      innerOffset += current.textContent.length;
      prevNode = current;
    }
  }
  return map;
};

Albert.applyUnderlines = function (corrections) {
  Albert.clearUnderlines();
  if (!corrections || !corrections.length) return;

  const body = Albert.getComposeBody();
  if (!body) return;

  const innerText = body.innerText;
  const textNodes = Albert.buildTextNodeMap(body);

  const sorted = corrections
    .map((c, i) => ({ ...c, index: i }))
    .sort((a, b) => b.offset - a.offset);

  for (const correction of sorted) {
    const realOffset = Albert.findRealOffset(innerText, correction.word, correction.offset);
    if (realOffset === -1) continue;

    const startInfo = textNodes.find((n) => n.start <= realOffset && n.end > realOffset);
    if (!startInfo) continue;

    const localStart = realOffset - startInfo.start;
    const localEnd = Math.min(localStart + correction.word.length, startInfo.node.textContent.length);

    const range = document.createRange();
    range.setStart(startInfo.node, localStart);
    range.setEnd(startInfo.node, localEnd);

    const span = Albert.createUnderlineSpan(correction, correction.index);
    range.surroundContents(span);

    span.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.showCorrectionPopup(correction, span);
    });
    span.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        Albert.showCorrectionPopup(correction, span);
      }
    });
  }
};
