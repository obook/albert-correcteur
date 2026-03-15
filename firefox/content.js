// Content script — détecte les champs texte, envoie au background pour correction,
// affiche les soulignements et popups de suggestion.

(() => {
  "use strict";

  const DEBOUNCE_MS = 3000;
  const MIN_TEXT_LENGTH = 10;
  const CYCLE_INTERVAL_MS = 30000;
  const SCAN_DEBOUNCE_MS = 500;

  // URL du logo embarqué dans l'extension
  const ICON_URL = browser.runtime.getURL("icons/icon.svg");

  // ── État global ──
  const fieldStates = new WeakMap();
  const trackedFields = new Set();
  let activePopup = null;
  let checkInProgress = false;
  let rateLimited = false;

  // ══════════════════════════════════════════════════════════════════════
  // Utilitaires
  // ══════════════════════════════════════════════════════════════════════

  function isTextField(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = (el.type || "text").toLowerCase();
      return ["text", "search", "url", "email"].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  // Détecte si un contenteditable est géré par un éditeur riche (CKEditor, TinyMCE, etc.)
  // qui ne tolère pas la modification directe du DOM.
  function isRichEditor(el) {
    if (!el.isContentEditable) return false;
    // CKEditor 5 : classe ck-editor__editable ou attribut data-cke
    if (el.classList.contains("ck-editor__editable")) return true;
    if (el.closest(".ck-editor")) return true;
    if (el.hasAttribute("data-cke-enter-mode")) return true;
    // TinyMCE : id contenant "tinymce" ou body dans une iframe tinymce
    if (el.id && el.id.includes("tinymce")) return true;
    if (el.dataset.mceStyle !== undefined) return true;
    // Quill
    if (el.classList.contains("ql-editor")) return true;
    // ProseMirror (utilisé par Tiptap, etc.)
    if (el.classList.contains("ProseMirror")) return true;
    return false;
  }

  function getTextContent(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea" || tag === "input") return el.value;
    return el.innerText || "";
  }

  function getOrCreateState(el) {
    if (!fieldStates.has(el)) {
      fieldStates.set(el, {
        timer: null, corrections: [], overlay: null, badge: null,
        attached: false, lastCheckedText: "", scrollHandler: null,
      });
    }
    return fieldStates.get(el);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ══════════════════════════════════════════════════════════════════════
  // Badge (icône Albert dans le coin du champ)
  // ══════════════════════════════════════════════════════════════════════

  function ensureBadge(el) {
    const state = getOrCreateState(el);
    if (state.badge && document.contains(state.badge)) return state.badge;

    const badge = document.createElement("div");
    badge.className = "albert-badge";
    badge.title = "Albert Correcteur — Cliquez pour vérifier";

    const img = document.createElement("img");
    img.src = ICON_URL;
    img.alt = "Albert";
    badge.appendChild(img);

    const parent = el.offsetParent || document.body;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    parent.appendChild(badge);
    positionBadge(el, badge);

    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerCheck(el);
    });

    state.badge = badge;
    return badge;
  }

  function positionBadge(el, badge) {
    const rect = el.getBoundingClientRect();
    const parentRect = (el.offsetParent || document.body).getBoundingClientRect();
    const cs = getComputedStyle(el);
    const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
    const borderRight = parseFloat(cs.borderRightWidth) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const paddingBottom = parseFloat(cs.paddingBottom) || 0;
    badge.style.top = (rect.bottom - parentRect.top - borderBottom - paddingBottom - 22) + "px";
    badge.style.left = (rect.right - parentRect.left - borderRight - paddingRight - 22) + "px";
  }

  // ══════════════════════════════════════════════════════════════════════
  // Vérification via l'API
  // ══════════════════════════════════════════════════════════════════════

  function scheduleCheck(el) {
    const state = getOrCreateState(el);
    clearTimeout(state.timer);
    state.timer = setTimeout(() => triggerCheck(el), DEBOUNCE_MS);
  }

  async function triggerCheck(el) {
    const text = getTextContent(el);
    if (text.trim().length < MIN_TEXT_LENGTH) {
      clearCorrections(el);
      return;
    }

    const state = getOrCreateState(el);
    if (state.lastCheckedText === text) return;
    if (state.badge) state.badge.classList.add("albert-loading");

    try {
      const response = await browser.runtime.sendMessage({ type: "check", text });
      if (response.error) {
        console.warn("[Albert]", response.error);
        if (response.error.includes("Limite de débit")) {
          rateLimited = true;
          setTimeout(() => { rateLimited = false; }, 30000);
        }
        return;
      }
      state.corrections = response.corrections || [];
      state.lastCheckedText = text;
      renderCorrections(el);
    } catch (err) {
      console.error("[Albert]", err);
    } finally {
      if (state.badge) state.badge.classList.remove("albert-loading");
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Rendu des corrections
  // ══════════════════════════════════════════════════════════════════════

  function clearCorrections(el) {
    const state = getOrCreateState(el);
    state.corrections = [];
    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }
    // Retirer le scroll handler
    if (state.scrollHandler) {
      el.removeEventListener("scroll", state.scrollHandler);
      state.scrollHandler = null;
    }
    if (state.badge) {
      state.badge.classList.remove("albert-has-errors");
    }
    if (el.isContentEditable && !isRichEditor(el)) {
      el.querySelectorAll(".albert-error").forEach((mark) => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      });
    }
  }

  function renderCorrections(el) {
    const state = getOrCreateState(el);
    const tag = el.tagName.toLowerCase();

    if (tag === "textarea" || tag === "input" || isRichEditor(el)) {
      // Overlay pour les textarea, input et éditeurs riches (CKEditor, TinyMCE, etc.)
      renderOverlay(el, state);
    } else if (el.isContentEditable) {
      renderContentEditable(el, state);
    }

    if (state.badge) {
      state.badge.classList.toggle("albert-has-errors", state.corrections.length > 0);
      state.badge.title = state.corrections.length > 0
        ? `${state.corrections.length} erreur${state.corrections.length > 1 ? "s" : ""} trouvée${state.corrections.length > 1 ? "s" : ""}`
        : "Albert Correcteur — Aucune erreur";
    }
  }

  // ── Overlay pour textarea/input ──

  function renderOverlay(el, state) {
    // Nettoyer l'ancien overlay et son scroll handler
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
    syncOverlayStyle(el, overlay);

    const text = getTextContent(el);
    overlay.innerHTML = buildHighlightedHTML(text, state.corrections);

    const parent = el.offsetParent || document.body;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    parent.appendChild(overlay);
    state.overlay = overlay;

    // Sync scroll (un seul handler, référencé pour pouvoir le retirer)
    overlay.scrollTop = el.scrollTop;
    overlay.scrollLeft = el.scrollLeft;
    state.scrollHandler = () => {
      overlay.scrollTop = el.scrollTop;
      overlay.scrollLeft = el.scrollLeft;
    };
    el.addEventListener("scroll", state.scrollHandler, { passive: true });

    // Rendre les marks cliquables
    overlay.querySelectorAll(".albert-error").forEach((mark) => {
      mark.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(mark.dataset.idx, 10);
        showPopup(el, state.corrections[idx], mark);
      });
    });
  }

  function syncOverlayStyle(el, overlay) {
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
  }

  function buildHighlightedHTML(text, corrections) {
    const sorted = corrections
      .map((c, i) => ({ ...c, idx: i }))
      .sort((a, b) => a.offset - b.offset);

    let html = "";
    let cursor = 0;

    for (const c of sorted) {
      if (c.offset < cursor) continue;
      if (c.offset > cursor) {
        html += escapeHTML(text.slice(cursor, c.offset));
      }
      const errorText = text.slice(c.offset, c.offset + c.length);
      const typeClass = `albert-error-${c.type || "grammar"}`;
      html += `<span class="albert-error ${typeClass}" data-idx="${c.idx}">${escapeHTML(errorText)}</span>`;
      cursor = c.offset + c.length;
    }

    if (cursor < text.length) {
      html += escapeHTML(text.slice(cursor));
    }

    return html;
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Contenteditable ──

  function renderContentEditable(el, state) {
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
        showPopup(el, c, mark);
      });

      range.surroundContents(mark);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Popup de suggestion
  // ══════════════════════════════════════════════════════════════════════

  function showPopup(el, correction, markEl) {
    closePopup();

    const popup = document.createElement("div");
    popup.className = "albert-popup";

    const msg = document.createElement("div");
    msg.className = "albert-popup-message";
    msg.textContent = correction.message || "Erreur détectée";
    popup.appendChild(msg);

    const sugBox = document.createElement("div");
    sugBox.className = "albert-popup-suggestions";

    (correction.suggestions || []).forEach((sug) => {
      const btn = document.createElement("button");
      btn.className = "albert-popup-suggestion";
      btn.textContent = sug;
      btn.addEventListener("click", () => {
        applySuggestion(el, correction, sug);
        closePopup();
      });
      sugBox.appendChild(btn);
    });

    const dismiss = document.createElement("button");
    dismiss.className = "albert-popup-dismiss";
    dismiss.textContent = "Ignorer";
    dismiss.addEventListener("click", () => closePopup());
    sugBox.appendChild(dismiss);

    popup.appendChild(sugBox);
    document.body.appendChild(popup);

    const markRect = markEl.getBoundingClientRect();
    popup.style.top = (markRect.bottom + 4) + "px";
    popup.style.left = markRect.left + "px";

    requestAnimationFrame(() => {
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.right > window.innerWidth - 10) {
        popup.style.left = (window.innerWidth - popupRect.width - 10) + "px";
      }
      if (popupRect.bottom > window.innerHeight - 10) {
        popup.style.top = (markRect.top - popupRect.height - 4) + "px";
      }
    });

    activePopup = popup;
  }

  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  document.addEventListener("click", (e) => {
    if (activePopup && !activePopup.contains(e.target) && !e.target.classList.contains("albert-error")) {
      closePopup();
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // Appliquer une suggestion
  // ══════════════════════════════════════════════════════════════════════

  function applySuggestion(el, correction, suggestion) {
    const tag = el.tagName.toLowerCase();

    if (tag === "textarea" || tag === "input") {
      const before = el.value.slice(0, correction.offset);
      const after = el.value.slice(correction.offset + correction.length);
      el.value = before + suggestion + after;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (el.isContentEditable) {
      if (isRichEditor(el)) {
        // Pour les éditeurs riches : sélectionner le texte erroné puis
        // utiliser execCommand pour que l'éditeur détecte le changement.
        applyViaSelection(el, correction, suggestion);
      } else {
        const marks = el.querySelectorAll(`.albert-error[data-idx="${correction.idx}"]`);
        marks.forEach((mark) => {
          const textNode = document.createTextNode(suggestion);
          mark.parentNode.replaceChild(textNode, mark);
          textNode.parentNode.normalize();
        });
      }
    }

    // Invalider le cache pour forcer une revérification
    const state = getOrCreateState(el);
    state.lastCheckedText = "";
    scheduleCheck(el);
  }

  // Applique une correction via Selection + execCommand (compatible éditeurs riches).
  // Construit un mapping innerText ↔ nœuds texte pour gérer les <br> et blocs.
  function applyViaSelection(el, correction, suggestion) {
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
  }

  // ══════════════════════════════════════════════════════════════════════
  // Observation des champs texte
  // ══════════════════════════════════════════════════════════════════════

  function attachField(el) {
    if (!isTextField(el)) return;
    const state = getOrCreateState(el);
    if (state.attached) return;
    state.attached = true;

    trackedFields.add(el);
    ensureBadge(el);

    el.addEventListener("input", () => scheduleCheck(el));
    el.addEventListener("focus", () => {
      const badge = ensureBadge(el);
      positionBadge(el, badge);
    });
  }

  const FIELD_SELECTOR = "textarea, input[type='text'], input:not([type]), [contenteditable='true']";

  function scanFields() {
    document.querySelectorAll(FIELD_SELECTOR).forEach(attachField);
  }

  // MutationObserver avec debounce pour éviter de ralentir la page
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanFields, SCAN_DEBOUNCE_MS);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Vérification cyclique de tous les champs
  // ══════════════════════════════════════════════════════════════════════

  async function cycleCheckAll() {
    if (checkInProgress || rateLimited) return;
    checkInProgress = true;

    try {
      // Nettoyer les champs retirés du DOM
      for (const el of trackedFields) {
        if (!document.contains(el)) {
          trackedFields.delete(el);
        }
      }

      // Le champ actif en premier
      const active = document.activeElement;
      const sorted = [...trackedFields].sort((a, b) => {
        if (a === active) return -1;
        if (b === active) return 1;
        return 0;
      });

      for (const el of sorted) {
        if (rateLimited) break;

        const text = getTextContent(el);
        if (text.trim().length < MIN_TEXT_LENGTH) continue;

        const state = getOrCreateState(el);
        if (state.lastCheckedText === text) continue;

        await triggerCheck(el);
        await sleep(7000);
      }
    } finally {
      checkInProgress = false;
    }
  }

  // Démarrage
  scanFields();
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(cycleCheckAll, CYCLE_INTERVAL_MS);
})();
