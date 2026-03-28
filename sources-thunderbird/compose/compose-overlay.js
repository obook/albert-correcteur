// compose-overlay.js --- Soulignements d'erreurs dans le compose Thunderbird.

"use strict";

Albert.UNDERLINE_CLASSES = {
  orthographe: "albert-error-spelling",
  grammaire: "albert-error-grammar",
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

Albert.applyUnderlines = function (corrections) {
  Albert.clearUnderlines();
  if (!corrections || !corrections.length) return;

  const body = Albert.getComposeBody();
  if (!body) return;

  const textNodes = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
  let node;
  let offset = 0;
  while ((node = walker.nextNode())) {
    textNodes.push({ node, start: offset, end: offset + node.textContent.length });
    offset += node.textContent.length;
  }

  const sorted = corrections
    .map((c, i) => ({ ...c, index: i }))
    .sort((a, b) => b.offset - a.offset);

  for (const correction of sorted) {
    const realOffset = Albert.findRealOffset(body.innerText, correction.word, correction.offset);
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
