// albert-popup-correction.js — Popup de correction orthographique et grammaticale.
// Affiche les suggestions, la navigation entre erreurs et le dictionnaire personnel.

"use strict";

Albert.showPopup = function (el, correction, markEl) {
  // Sauvegarder la position si le popup existe (navigation entre erreurs)
  if (Albert.activePopup) {
    const rect = Albert.activePopup.getBoundingClientRect();
    Albert.popupPosition = { top: rect.top, left: rect.left };
  }
  Albert.closePopup();

  const state = Albert.getOrCreateState(el);
  Albert.activePopupEl = el;
  Albert.activePopupIdx = correction.idx !== undefined ? correction.idx : state.corrections.indexOf(correction);

  const themeClass = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup" + (themeClass ? " " + themeClass : "");
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Correction orthographique");
  popup.setAttribute("aria-modal", "false");

  // --- Header ---
  const { headerLeft, handle } = Albert.createPopupHeader(popup);

  // Menu déroulant mode (Correcteur / Reformuler)
  const modeWrap = document.createElement("div");
  modeWrap.className = "albert-popup-mode-wrap";

  const modeBtn = document.createElement("button");
  modeBtn.className = "albert-popup-mode-btn";
  modeBtn.textContent = Albert.mode === "correction" ? "Correcteur" : "Reformuler";
  const chevron = document.createElement("span");
  chevron.className = "albert-popup-chevron";
  chevron.textContent = "▾";
  modeBtn.appendChild(document.createTextNode(" "));
  modeBtn.appendChild(chevron);

  const modeMenu = document.createElement("div");
  modeMenu.className = "albert-popup-mode-menu";
  modeMenu.style.display = "none";

  const modes = [
    { id: "correction", label: "Correcteur" },
    { id: "reformulation", label: "Reformuler" },
  ];
  modes.forEach((m) => {
    const item = document.createElement("div");
    item.className = "albert-popup-mode-item";
    item.textContent = m.label;
    if (m.id === Albert.mode) {
      const check = document.createElement("span");
      check.className = "albert-popup-check";
      check.textContent = "✓";
      item.appendChild(document.createTextNode(" "));
      item.appendChild(check);
      item.classList.add("active");
    }
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.mode = m.id;
      modeMenu.style.display = "none";
      modeBtn.textContent = m.label + " ";
      const chev = document.createElement("span");
      chev.className = "albert-popup-chevron";
      chev.textContent = "▾";
      modeBtn.appendChild(chev);
      const st = Albert.getOrCreateState(el);
      st.lastCheckedText = "";
      Albert.closePopup();
      Albert.triggerCheck(el);
    });
    modeMenu.appendChild(item);
  });

  modeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    modeMenu.style.display = modeMenu.style.display === "none" ? "block" : "none";
  });

  modeWrap.appendChild(modeBtn);
  modeWrap.appendChild(modeMenu);
  headerLeft.appendChild(modeWrap);

  // --- Corps ---
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  // Message + bouton ignorer
  const msgRow = document.createElement("div");
  msgRow.className = "albert-popup-msg-row";

  const msg = document.createElement("div");
  msg.className = "albert-popup-message";
  msg.textContent = correction.message || "Erreur détectée";
  msgRow.appendChild(msg);

  const ignoreBtn = document.createElement("button");
  ignoreBtn.className = "albert-popup-ignore-rule";
  ignoreBtn.title = "Désactiver la règle partout";
  ignoreBtn.textContent = "⊘";
  ignoreBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const text = Albert.getTextContent(el);
    const word = text.slice(correction.offset, correction.offset + correction.length);
    await Albert.ignoreWord(word);
    const st = Albert.getOrCreateState(el);
    st.corrections = Albert.filterIgnoredCorrections(st.corrections, text);
    Albert.closePopup();
    Albert.renderCorrections(el);
  });
  msgRow.appendChild(ignoreBtn);
  body.appendChild(msgRow);

  // Extrait
  const text = Albert.getTextContent(el);
  const original = text.slice(correction.offset, correction.offset + correction.length);
  const extract = document.createElement("div");
  extract.className = "albert-popup-extract";
  extract.textContent = `Essayez « ${(correction.suggestions && correction.suggestions[0]) || original} »`;
  body.appendChild(extract);

  // Boutons de suggestion
  const sugBox = document.createElement("div");
  sugBox.className = "albert-popup-suggestions";

  (correction.suggestions || []).forEach((sug) => {
    const btn = document.createElement("button");
    btn.className = "albert-popup-suggestion";
    btn.textContent = sug;
    btn.addEventListener("click", () => {
      Albert.applySuggestion(el, correction, sug);
      Albert.closePopup();
    });
    sugBox.appendChild(btn);
  });

  const dismiss = document.createElement("button");
  dismiss.className = "albert-popup-dismiss";
  dismiss.textContent = "Ignorer";
  dismiss.addEventListener("click", () => Albert.closePopup());
  sugBox.appendChild(dismiss);

  body.appendChild(sugBox);
  popup.appendChild(body);

  // --- Footer : navigation ---
  if (state.corrections.length > 1) {
    const footer = document.createElement("div");
    footer.className = "albert-popup-footer";

    const prevBtn = document.createElement("button");
    prevBtn.className = "albert-popup-nav albert-popup-nav-prev";
    prevBtn.textContent = "← Précédent";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(el, -1);
    });
    footer.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.className = "albert-popup-nav albert-popup-nav-next";
    nextBtn.textContent = "Suivant →";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(el, 1);
    });
    footer.appendChild(nextBtn);

    popup.appendChild(footer);
  }

  document.body.appendChild(popup);

  // --- Positionnement ---
  if (Albert.popupPosition) {
    popup.style.top = Albert.popupPosition.top + "px";
    popup.style.left = Albert.popupPosition.left + "px";
  } else {
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
  }

  Albert.initPopupDrag(popup, handle);
  Albert.activePopup = popup;
};

// Navigation entre erreurs.
Albert.navigateError = function (el, direction) {
  const state = Albert.getOrCreateState(el);
  if (state.corrections.length === 0) return;

  let newIdx = Albert.activePopupIdx + direction;
  if (newIdx < 0) newIdx = state.corrections.length - 1;
  if (newIdx >= state.corrections.length) newIdx = 0;

  const container = state.overlay || el;
  const mark = container.querySelector(`.albert-error[data-idx="${newIdx}"]`);
  if (mark) {
    mark.scrollIntoView({ block: "nearest", behavior: "smooth" });
    Albert.showPopup(el, state.corrections[newIdx], mark);
  }
};
