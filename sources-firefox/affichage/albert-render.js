/* albert-render.js - Orchestration du rendu et contenteditable simple. */

"use strict";

/* Affiche les corrections sur un champ (choisit la bonne methode). */
Albert.renderCorrections = function (el) {
  const state = Albert.getOrCreateState(el);
  const tag = el.tagName.toLowerCase();

  if (tag === "textarea" || tag === "input" || el.isContentEditable) {
    Albert.renderOverlay(el, state);
  }

  if (state.badge) {
    const hasErrors = state.corrections.length > 0;
    const langLabel = { fr: "FR", en: "EN", es: "ES", de: "DE" }[state.lang] || "";
    const langSuffix = langLabel ? ` [${langLabel}]` : "";
    state.badge.classList.toggle("albert-has-errors", hasErrors);
    state.badge.classList.toggle("albert-no-errors", !hasErrors);
    const img = state.badge.querySelector("img");
    if (img) img.src = hasErrors ? Albert.ICON_ERROR_URL : Albert.ICON_URL;
    const title = hasErrors
      ? `${state.corrections.length} erreur${state.corrections.length > 1 ? "s" : ""}`
        + ` trouvee${state.corrections.length > 1 ? "s" : ""}${langSuffix}`
      : `Albert Correcteur - Aucune erreur${langSuffix}`;
    state.badge.title = title;
    state.badge.setAttribute("aria-label", title);
  }

  /* Annoncer aux lecteurs d'ecran (RGAA) */
  Albert._announceErrors(state.corrections.length, state.lang);
};

/* Rendu pour les contenteditable simples (pas d'editeur riche).
   Entoure les mots errones de <span> cliquables directement dans le DOM. */
Albert.renderContentEditable = function (el, state) {
  el.querySelectorAll(".albert-error").forEach((mark) => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });

  if (state.corrections.length === 0) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  let globalOffset = 0;
  const nodeRanges = textNodes.map((n) => {
    const start = globalOffset;
    globalOffset += n.textContent.length;
    return { node: n, start, end: globalOffset };
  });

  const sorted = state.corrections
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => b.offset - a.offset);

  for (const c of sorted) {
    const cEnd = c.offset + c.length;
    const nr = nodeRanges.find((r) => c.offset >= r.start && c.offset < r.end);
    if (!nr || cEnd > nr.end) continue;

    const localStart = c.offset - nr.start;
    const localEnd = cEnd - nr.start;
    const range = document.createRange();
    range.setStart(nr.node, localStart);
    range.setEnd(nr.node, localEnd);

    const mark = document.createElement("span");
    mark.className = `albert-error albert-error-${c.type || "grammar"}`;
    mark.dataset.idx = c.idx;
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.showPopup(el, state.corrections[c.idx], mark);
    });

    range.surroundContents(mark);
  }
};
