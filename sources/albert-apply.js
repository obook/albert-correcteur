// albert-apply.js — Application des corrections dans le texte.
// Gère les textarea/input, les contenteditable simples et les éditeurs riches.

"use strict";

Albert.applyingCorrection = false;

// Retrouve l'offset réel du mot erroné dans le texte actuel.
// L'offset original peut être décalé si une correction précédente a changé la longueur du texte.
Albert.findRealOffset = function (currentText, correction, checkedText) {
  const originalWord = checkedText.slice(correction.offset, correction.offset + correction.length);

  // Vérifier d'abord à l'offset original
  if (currentText.slice(correction.offset, correction.offset + correction.length) === originalWord) {
    return correction.offset;
  }

  // Sinon, chercher le mot dans le texte actuel (première occurrence)
  const idx = currentText.indexOf(originalWord);
  if (idx !== -1) return idx;

  // Dernier recours : chercher autour de l'offset original (±50 chars)
  const searchStart = Math.max(0, correction.offset - 50);
  const searchEnd = Math.min(currentText.length, correction.offset + 50);
  const region = currentText.slice(searchStart, searchEnd);
  const localIdx = region.indexOf(originalWord);
  if (localIdx !== -1) return searchStart + localIdx;

  return -1; // mot introuvable
};

// Applique une suggestion de correction dans le champ.
Albert.applySuggestion = function (el, correction, suggestion) {
  Albert.applyingCorrection = true;
  const tag = el.tagName.toLowerCase();
  const state = Albert.getOrCreateState(el);

  // Garde-fou : si la suggestion inclut du contexte avant l'erreur, le retirer.
  // Ex. : erreur "ortographe" (offset 40), suggestion "d'orthographe" → trimmer le "d'" en trop.
  if (suggestion.length > correction.length) {
    const fullText = Albert.getTextContent(el);
    const maxOverlap = suggestion.length - correction.length;
    for (let len = maxOverlap; len > 0; len--) {
      if (correction.offset >= len) {
        const prefix = fullText.slice(correction.offset - len, correction.offset);
        if (suggestion.startsWith(prefix)) {
          suggestion = suggestion.slice(len);
          break;
        }
      }
    }
  }

  if (tag === "textarea" || tag === "input") {
    // Retrouver l'offset réel dans le texte actuel
    const realOffset = Albert.findRealOffset(el.value, correction, state.checkedText || el.value);
    if (realOffset === -1) {
      Albert.applyingCorrection = false;
      return;
    }
    const before = el.value.slice(0, realOffset);
    const after = el.value.slice(realOffset + correction.length);
    el.value = before + suggestion + after;
    // Synchroniser checkedText pour que les corrections suivantes
    // utilisent les bons offsets dans findRealOffset()
    state.checkedText = el.value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (el.isContentEditable) {
    if (Albert.isRichEditor(el)) {
      // Éditeur riche : remplacement via Selection + execCommand
      Albert.applyViaSelection(el, correction, suggestion);
    } else {
      // Contenteditable simple : remplacement direct du DOM
      const idx = correction.idx !== undefined ? correction.idx : state.corrections.indexOf(correction);
      const marks = el.querySelectorAll(`.albert-error[data-idx="${idx}"]`);
      marks.forEach((mark) => {
        const textNode = document.createTextNode(suggestion);
        mark.parentNode.replaceChild(textNode, mark);
        textNode.parentNode.normalize();
      });
    }
  }

  // Retirer la correction appliquée et ajuster les offsets des suivantes
  const delta = suggestion.length - correction.length;
  state.corrections = state.corrections
    .filter((c) => c !== correction)
    .map((c) => {
      if (c.offset > correction.offset) {
        return Object.assign({}, c, { offset: c.offset + delta });
      }
      return c;
    });

  // Re-rendre l'overlay (avec délai pour les éditeurs riches, après execCommand)
  if (el.isContentEditable && Albert.isRichEditor(el)) {
    setTimeout(() => Albert.renderCorrections(el), 20);
  } else {
    Albert.renderCorrections(el);
  }

  // Invalider le cache pour forcer une revérification
  state.lastCheckedText = "";
  // Remettre le flag après un court délai (pour couvrir le dispatchEvent)
  setTimeout(() => { Albert.applyingCorrection = false; }, 50);
  Albert.scheduleCheck(el);
};

// Applique une correction via Selection + execCommand.
// Compatible avec les éditeurs riches (CKEditor, TinyMCE, etc.).
// Construit un mapping innerText ↔ nœuds texte pour gérer les <br> et blocs.
Albert.applyViaSelection = function (el, correction, suggestion) {
  el.focus();
  const state = Albert.getOrCreateState(el);

  // Construire le mapping entre les offsets innerText et les nœuds texte
  const segments = Albert.buildInnerTextSegments(el);

  // Déterminer l'offset réel (peut être décalé par une correction précédente)
  const currentText = el.innerText || "";
  const checkedText = state.checkedText || currentText;
  const realOffset = Albert.findRealOffset(currentText, correction, checkedText);
  if (realOffset === -1) return;

  // Trouver le(s) nœud(s) texte couvrant l'erreur
  const errStart = realOffset;
  const errEnd = realOffset + correction.length;

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

  // Sélectionner le texte erroné et vérifier la correspondance
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  const expectedWord = checkedText.slice(correction.offset, correction.offset + correction.length);
  if (range.toString() !== expectedWord) return; // mapping incohérent, abandon

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // Petit délai pour que l'éditeur prenne en compte la sélection
  setTimeout(() => {
    document.execCommand("insertText", false, suggestion);
  }, 10);
};

// Construit le mapping innerText ↔ nœuds texte (segments).
// Utilisé par applyViaSelection pour convertir un offset innerText en position DOM.
Albert.buildInnerTextSegments = function (el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL);
  const segments = []; // { node, start, end } pour chaque nœud texte
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
      } else if (["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        if (innerOffset > 0 && (!lastNewlineNode || !lastNewlineNode.contains(current))) {
          innerOffset += 1;
        }
        lastNewlineNode = current;
      }
    }
  }

  return segments;
};
