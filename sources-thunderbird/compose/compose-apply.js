/*
 * compose-apply.js - Application des corrections dans le compose Thunderbird.
 *
 * Applique une suggestion de correction dans le corps du message.
 * Deux stratégies :
 * 1. Via le span souligné (data-correction-index) : sélectionne le
 *    contenu du span et remplace via execCommand("insertText").
 * 2. Fallback par offset : parcourt les nœuds texte du body pour
 *    localiser le mot erroné et le remplacer.
 *
 * Contient également triggerManualCheck() pour le clic sur le badge.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.applySuggestion = function (correction, suggestion) {
  Albert.applyingCorrection = true;

  try {
    const body = Albert.getComposeBody();
    if (!body) return;

    const mark = document.querySelector('[data-correction-index="' + correction.index + '"]');
    if (mark) {
      /* Redonner le focus au body éditable avant la manipulation */
      const body = Albert.getComposeBody();
      body.focus();

      const range = document.createRange();
      range.selectNodeContents(mark);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      /* insertText peut échouer en designMode, fallback sur DOM direct */
      if (!document.execCommand("insertText", false, suggestion)) {
        range.deleteContents();
        range.insertNode(document.createTextNode(suggestion));
        body.normalize();
      }
    } else {
      const text = body.innerText;
      const realOffset = Albert.findRealOffset(text, correction.word, correction.offset);
      if (realOffset === -1) return;

      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
      let node;
      let offset = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;

      while ((node = walker.nextNode())) {
        const nodeEnd = offset + node.textContent.length;
        if (!startNode && realOffset < nodeEnd) {
          startNode = node;
          startOffset = realOffset - offset;
        }
        if (startNode && realOffset + correction.word.length <= nodeEnd) {
          endNode = node;
          endOffset = realOffset + correction.word.length - offset;
          break;
        }
        offset = nodeEnd;
      }

      if (startNode && endNode) {
        body.focus();
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        if (!document.execCommand("insertText", false, suggestion)) {
          range.deleteContents();
          range.insertNode(document.createTextNode(suggestion));
          body.normalize();
        }
      }
    }

    const state = Albert.composeState;
    if (state && state.corrections) {
      state.corrections = state.corrections.filter((c) => c !== correction);
      state.checkedText = null;
    }
  } finally {
    Albert.applyingCorrection = false;
  }
};

Albert.triggerManualCheck = function () {
  const text = Albert.getBodyText();
  const state = Albert.badgeState;
  Albert.log("triggerManualCheck : clic badge (state=", state, ", ", text.trim().length, "car.)");

  if (text.trim().length < Albert.BADGE_MIN_LENGTH) {
    Albert.showToast("Texte trop court pour être vérifié (" + Albert.BADGE_MIN_LENGTH + " caractères minimum).");
    return;
  }

  if (state === "loading") {
    Albert.showToast("Vérification déjà en cours…");
    return;
  }

  if (state === "error") {
    const last = Albert.lastError;
    if (last && last.message) {
      Albert.showToast("Dernière erreur : " + last.message + " — nouvelle tentative…");
    } else {
      Albert.showToast("Nouvelle tentative de vérification…");
    }
    /* Forcer une nouvelle requête même si le texte n'a pas changé */
    if (Albert.composeState) Albert.composeState.checkedText = null;
    Albert.requestCheck(text);
    return;
  }

  /* États ok / has-errors / null : relance manuelle */
  Albert.showToast("Vérification en cours…", 3000);
  if (Albert.composeState) Albert.composeState.checkedText = null;
  Albert.requestCheck(text);
};
