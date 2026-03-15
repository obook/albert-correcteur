// albert-apply.js — Application des corrections dans le texte.
// Gère les textarea/input, les contenteditable simples et les éditeurs riches.

"use strict";

// Applique une suggestion de correction dans le champ.
Albert.applySuggestion = function (el, correction, suggestion) {
  const tag = el.tagName.toLowerCase();

  if (tag === "textarea" || tag === "input") {
    // Textarea / Input : remplacement direct dans la valeur
    const before = el.value.slice(0, correction.offset);
    const after = el.value.slice(correction.offset + correction.length);
    el.value = before + suggestion + after;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (el.isContentEditable) {
    if (Albert.isRichEditor(el)) {
      // Éditeur riche : remplacement via Selection + execCommand
      // TODO: le remplacement ne fonctionne pas toujours correctement
      Albert.applyViaSelection(el, correction, suggestion);
    } else {
      // Contenteditable simple : remplacement direct du DOM
      const marks = el.querySelectorAll(`.albert-error[data-idx="${correction.idx}"]`);
      marks.forEach((mark) => {
        const textNode = document.createTextNode(suggestion);
        mark.parentNode.replaceChild(textNode, mark);
        textNode.parentNode.normalize();
      });
    }
  }

  // Invalider le cache pour forcer une revérification
  const state = Albert.getOrCreateState(el);
  state.lastCheckedText = "";
  Albert.scheduleCheck(el);
};

// Applique une correction via Selection + execCommand.
// Compatible avec les éditeurs riches (CKEditor, TinyMCE, etc.).
// Construit un mapping innerText ↔ nœuds texte pour gérer les <br> et blocs.
Albert.applyViaSelection = function (el, correction, suggestion) {
  el.focus();

  // Construire le mapping entre les offsets innerText et les nœuds texte
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL);
  const segments = []; // { node, start, end } pour chaque nœud texte
  let innerOffset = 0;
  let current;

  while ((current = walker.nextNode())) {
    if (current.nodeType === Node.TEXT_NODE) {
      const len = current.textContent.length;
      segments.push({ node: current, start: innerOffset, end: innerOffset + len });
      innerOffset += len;
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();
      // innerText ajoute \n pour <br>, <p>, <div>, etc.
      if (tag === "br") {
        innerOffset += 1;
      } else if (["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        if (innerOffset > 0) innerOffset += 1;
      }
    }
  }

  // Trouver le(s) nœud(s) texte couvrant l'erreur
  const errStart = correction.offset;
  const errEnd = correction.offset + correction.length;

  let startNode = null, startOffset = 0;
  let endNode = null, endOffset = 0;

  for (const seg of segments) {
    if (!startNode && errStart >= seg.start && errStart <= seg.end) {
      startNode = seg.node;
      startOffset = errStart - seg.start;
    }
    if (errEnd >= seg.start && errEnd <= seg.end) {
      endNode = seg.node;
      endOffset = errEnd - seg.start;
      break;
    }
  }

  if (!startNode || !endNode) return;

  // Sélectionner le texte erroné
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // Petit délai pour que l'éditeur prenne en compte la sélection
  setTimeout(() => {
    document.execCommand("insertText", false, suggestion);
  }, 10);
};
