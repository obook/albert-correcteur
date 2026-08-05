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
 * Date : avril 2026
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

/* Construit la correspondance entre les offsets de innerText et les
 * nœuds texte du corps du message. L'algorithme est partagé avec la
 * version Firefox (util/inner-text.js) : compter un seul saut de ligne
 * par bloc décalait les offsets d'un caractère par paragraphe, si bien
 * que les erreurs des derniers paragraphes d'un long courriel
 * n'étaient plus soulignées. */
Albert.buildTextNodeMap = function (body) {
  return Albert.buildInnerTextSegments(body);
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

    const finErreur = realOffset + correction.word.length;

    /* Un mot peut chevaucher plusieurs nœuds texte, par exemple quand une
       partie est en gras ou dans un lien. Souligner uniquement le premier
       nœud laissait la fin du mot sans marque ni zone cliquable : on
       découpe donc la portion à souligner nœud par nœud. */
    const portions = [];
    for (const info of textNodes) {
      if (info.end <= realOffset || info.start >= finErreur) continue;
      portions.push({
        node: info.node,
        debut: Math.max(realOffset, info.start) - info.start,
        fin: Math.min(finErreur, info.end) - info.start,
      });
    }
    if (portions.length === 0) continue;

    /* De droite à gauche : découper un nœud ne décale pas les portions
       situées avant lui. */
    for (let i = portions.length - 1; i >= 0; i--) {
      const portion = portions[i];
      const range = document.createRange();
      range.setStart(portion.node, portion.debut);
      range.setEnd(portion.node, portion.fin);

      const span = Albert.createUnderlineSpan(correction, correction.index);
      try {
        range.surroundContents(span);
      } catch (err) {
        /* Le nœud a changé depuis la construction de la table :
           passer cette portion sans interrompre les corrections
           suivantes. */
        Albert.log("applyUnderlines : portion ignorée -", err && err.message);
        continue;
      }

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
  }
};
