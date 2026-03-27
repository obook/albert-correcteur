// albert-apply-rich.js — Remplacement de texte dans les éditeurs riches.
// Gère la sélection via Range + simulation souris, l'insertion via la chaîne
// d'événements complète (beforeinput → textInput → execCommand) et le
// fallback paste pour les éditeurs qui n'acceptent pas execCommand.

"use strict";

// Applique une correction dans un éditeur riche (CKEditor, TinyMCE, etc.)
// via Selection + chaîne d'événements complète.
// Retourne true si la correction a pu être appliquée, false sinon.
Albert.applyViaSelection = function (el, correction, suggestion) {
  el.focus();
  const state = Albert.getOrCreateState(el);

  const segments = Albert.buildInnerTextSegments(el);

  const currentText = el.innerText || "";
  const checkedText = state.checkedText || currentText;
  const realOffset = Albert.findRealOffset(currentText, correction, checkedText);
  if (realOffset === -1) return false;

  const errEnd = realOffset + correction.length;

  // Localiser les nœuds texte de début et fin
  const startPos = Albert.findSegmentAt(segments, realOffset);
  const endPos = Albert.findSegmentAt(segments, errEnd);
  if (!startPos || !endPos) return false;

  // Créer le Range couvrant le texte erroné
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  // Vérifier que le Range couvre bien le mot attendu
  const expectedWord = checkedText.slice(correction.offset, correction.offset + correction.length);
  if (range.toString() !== expectedWord) return false;

  // Simuler mousedown (certains éditeurs riches n'acceptent les sélections
  // que via des interactions souris)
  const startRect = range.getBoundingClientRect();
  Albert._simulateMouseEvent(startPos.node.parentElement || el, "mousedown", startRect);

  // Appliquer la sélection
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // Simuler mouseup pour finaliser la sélection côté éditeur
  Albert._simulateMouseEvent(endPos.node.parentElement || el, "mouseup", startRect);

  // Délai pour que l'éditeur enregistre la sélection,
  // puis insertion via chaîne d'événements complète
  setTimeout(() => {
    Albert._insertTextInEditor(el, suggestion);
    state.checkedText = el.innerText || "";
  }, 30);

  return true;
};

// --- Simulation d'événements ---

// Simule un événement souris sur un élément avec les coordonnées d'un DOMRect.
Albert._simulateMouseEvent = function (target, type, rect) {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true, cancelable: true, view: window,
    clientX: x, clientY: y, button: 0
  }));
};

// --- Insertion de texte ---

// Insère du texte via la chaîne d'événements complète :
// beforeinput → textInput → execCommand, avec fallback paste si échec.
Albert._insertTextInEditor = function (el, text) {
  // Étape 1 : beforeinput (CKEditor 5, ProseMirror, Lexical)
  const beforeInputOpts = {
    bubbles: true, cancelable: true,
    inputType: "insertText", data: text
  };
  if ("StaticRange" in window && "getTargetRanges" in InputEvent.prototype) {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        beforeInputOpts.targetRanges = [new StaticRange(sel.getRangeAt(0))];
      }
    } catch (_) { /* pas critique */ }
  }
  const beforeOK = el.dispatchEvent(new InputEvent("beforeinput", beforeInputOpts));

  // Étape 2 : textInput (éditeurs legacy)
  let textInputOK = true;
  if ("TextEvent" in window) {
    try {
      const textEvt = new InputEvent("textInput", {
        bubbles: true, cancelable: true,
        inputType: "insertText", data: text
      });
      textInputOK = el.dispatchEvent(textEvt);
    } catch (_) { /* non supporté, on continue */ }
  }

  // Étape 3 : execCommand si les événements n'ont pas été annulés
  if (beforeOK && textInputOK) {
    const ok = document.execCommand("insertText", false, text);

    // Étape 4 : fallback paste si execCommand a échoué
    if (!ok) {
      Albert._insertViaPaste(el, text);
    }
  }
};

// Fallback : simule un paste pour les éditeurs qui n'acceptent pas execCommand.
Albert._insertViaPaste = function (el, text) {
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const pasteEvt = new ClipboardEvent("paste", {
      clipboardData: dt, cancelable: true, bubbles: true
    });
    const pasteHandled = !el.dispatchEvent(pasteEvt);
    if (!pasteHandled) {
      document.execCommand("insertText", false, text);
    }
  } catch (_) {
    document.execCommand("insertText", false, text);
  }
};
