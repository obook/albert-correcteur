// albert-render.js — Rendu des corrections (overlay et contenteditable).
// Affiche les soulignements colorés sur les erreurs détectées.

"use strict";

// Supprime toutes les corrections visuelles d'un champ.
Albert.clearCorrections = function (el) {
  const state = Albert.getOrCreateState(el);
  state.corrections = [];
  if (state.overlay) {
    state.overlay.remove();
    state.overlay = null;
  }
  if (state.scrollHandler) {
    el.removeEventListener("scroll", state.scrollHandler);
    state.scrollHandler = null;
  }
  if (state.badge) {
    state.badge.classList.remove("albert-has-errors");
  }
  if (el.isContentEditable && !Albert.isRichEditor(el)) {
    el.querySelectorAll(".albert-error").forEach((mark) => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }
};

// Affiche les corrections sur un champ (choisit la bonne méthode).
Albert.renderCorrections = function (el) {
  const state = Albert.getOrCreateState(el);
  const tag = el.tagName.toLowerCase();

  if (tag === "textarea" || tag === "input" || Albert.isRichEditor(el)) {
    Albert.renderOverlay(el, state);
  } else if (el.isContentEditable) {
    Albert.renderContentEditable(el, state);
  }

  if (state.badge) {
    const hasErrors = state.corrections.length > 0;
    const langLabel = { fr: "FR", en: "EN", es: "ES", de: "DE" }[state.lang] || "";
    const langSuffix = langLabel ? ` [${langLabel}]` : "";
    state.badge.classList.toggle("albert-has-errors", hasErrors);
    state.badge.classList.toggle("albert-no-errors", !hasErrors);
    // Changer l'icône selon l'état : rouge si erreurs, normal (rouge/bleu) si OK
    const img = state.badge.querySelector("img");
    if (img) img.src = hasErrors ? Albert.ICON_ERROR_URL : Albert.ICON_URL;
    state.badge.title = hasErrors
      ? `${state.corrections.length} erreur${state.corrections.length > 1 ? "s" : ""} trouvée${state.corrections.length > 1 ? "s" : ""}${langSuffix}`
      : `Albert Correcteur — Aucune erreur${langSuffix}`;
  }
};

// ── Overlay transparent pour textarea, input et éditeurs riches ──

Albert.renderOverlay = function (el, state) {
  if (state.overlay) state.overlay.remove();
  if (state.scrollHandler) {
    el.removeEventListener("scroll", state.scrollHandler);
    state.scrollHandler = null;
  }

  if (state.corrections.length === 0) {
    state.overlay = null;
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "albert-overlay";
  Albert.syncOverlayStyle(el, overlay);

  const text = Albert.getTextContent(el);
  Albert.buildHighlightedDOM(overlay, text, state.corrections);

  const parent = el.offsetParent || document.body;
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.appendChild(overlay);
  state.overlay = overlay;

  // Synchroniser le scroll
  overlay.scrollTop = el.scrollTop;
  overlay.scrollLeft = el.scrollLeft;
  state.scrollHandler = () => {
    overlay.scrollTop = el.scrollTop;
    overlay.scrollLeft = el.scrollLeft;
  };
  el.addEventListener("scroll", state.scrollHandler, { passive: true });

  // Rendre les erreurs cliquables
  overlay.querySelectorAll(".albert-error").forEach((mark) => {
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(mark.dataset.idx, 10);
      Albert.showPopup(el, state.corrections[idx], mark);
    });
  });
};

// Copie le style du champ sur l'overlay pour un alignement parfait.
Albert.syncOverlayStyle = function (el, overlay) {
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const parentRect = (el.offsetParent || document.body).getBoundingClientRect();

  overlay.style.top = (rect.top - parentRect.top) + "px";
  overlay.style.left = (rect.left - parentRect.left) + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";

  const props = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "wordSpacing", "lineHeight", "textTransform", "textIndent",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "boxSizing", "textAlign", "direction",
  ];
  props.forEach((p) => { overlay.style[p] = cs[p]; });
  overlay.style.overflowWrap = cs.overflowWrap || "break-word";
};

// Construit les nœuds DOM avec les erreurs soulignées dans le container.
Albert.buildHighlightedDOM = function (container, text, corrections) {
  container.textContent = "";
  const sorted = corrections
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => a.offset - b.offset);

  let cursor = 0;

  for (const c of sorted) {
    if (c.offset < cursor) continue;
    if (c.offset > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, c.offset)));
    }
    const span = document.createElement("span");
    span.className = `albert-error albert-error-${c.type || "grammar"}`;
    span.dataset.idx = c.idx;
    span.textContent = text.slice(c.offset, c.offset + c.length);
    container.appendChild(span);
    cursor = c.offset + c.length;
  }

  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }
};

// ── Contenteditable simple (pas d'éditeur riche) ──

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
