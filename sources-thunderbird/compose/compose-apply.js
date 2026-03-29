/* compose-apply.js --- Application des corrections dans le compose Thunderbird. */

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
  if (text.trim().length < Albert.BADGE_MIN_LENGTH) return;
  Albert.requestCheck(text);
};
