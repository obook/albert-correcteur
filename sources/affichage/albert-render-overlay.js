// albert-render-overlay.js --- Overlay transparent pour textarea, input et éditeurs riches.
// Positionné par-dessus le champ, affiche les soulignements sans modifier le contenu.

"use strict";

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

  // Synchroniser le scroll (throttlé via requestAnimationFrame)
  overlay.scrollTop = el.scrollTop;
  overlay.scrollLeft = el.scrollLeft;
  let scrollRAF = null;
  state.scrollHandler = () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      overlay.scrollTop = el.scrollTop;
      overlay.scrollLeft = el.scrollLeft;
      scrollRAF = null;
    });
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

// Construit les noeuds DOM avec les erreurs soulignées dans le container.
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
