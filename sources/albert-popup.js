// albert-popup.js — Popup de suggestion avec navigation, modes et dictionnaire.

"use strict";

// Détermine la classe de thème à appliquer au popup.
Albert.getPopupThemeClass = function () {
  const theme = Albert.popupTheme || "dark";
  if (theme === "dark") return "";
  if (theme === "light") return "albert-theme-light";
  // auto : suivre la préférence système
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "albert-theme-light" : "";
};

// Charge le thème depuis le storage.
Albert.loadPopupTheme = async function () {
  const result = await browser.storage.local.get("popupTheme");
  Albert.popupTheme = result.popupTheme || "dark";
};
Albert.loadPopupTheme();

// Écoute les changements de thème en temps réel.
browser.storage.onChanged.addListener((changes) => {
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
});

// Position sauvegardée quand le popup a été déplacé manuellement.
Albert.popupPosition = null;

// Affiche le popup de suggestion pour une correction donnée.
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

  // ── Header : icône, menu mode, poignée, fermer ──
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "albert-popup-header-left";

  const icon = document.createElement("img");
  icon.src = Albert.ICON_URL;
  icon.alt = "Albert";
  icon.className = "albert-popup-icon";
  headerLeft.appendChild(icon);

  // Menu déroulant mode
  const modeWrap = document.createElement("div");
  modeWrap.className = "albert-popup-mode-wrap";

  const modeBtn = document.createElement("button");
  modeBtn.className = "albert-popup-mode-btn";
  modeBtn.textContent = Albert.mode === "correction" ? "Correcteur" : "Reformuler";
  modeBtn.innerHTML += ' <span class="albert-popup-chevron">▾</span>';

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
      item.innerHTML += ' <span class="albert-popup-check">✓</span>';
      item.classList.add("active");
    }
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.mode = m.id;
      modeMenu.style.display = "none";
      // Mettre à jour le bouton
      modeBtn.innerHTML = m.label + ' <span class="albert-popup-chevron">▾</span>';
      // Relancer la vérification si on change de mode
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
  header.appendChild(headerLeft);

  const headerRight = document.createElement("div");
  headerRight.className = "albert-popup-header-right";

  // Poignée de déplacement
  const handle = document.createElement("div");
  handle.className = "albert-popup-handle";
  handle.textContent = "⠿";
  handle.title = "Déplacer";
  headerRight.appendChild(handle);

  // Bouton fermer
  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "✕";
  closeBtn.title = "Fermer";
  closeBtn.addEventListener("click", () => Albert.closePopup());
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  popup.appendChild(header);

  // ── Corps : message + "Désactiver la règle" ──
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  const msgRow = document.createElement("div");
  msgRow.className = "albert-popup-msg-row";

  const msg = document.createElement("div");
  msg.className = "albert-popup-message";
  msg.textContent = correction.message || "Erreur détectée";
  msgRow.appendChild(msg);

  // Bouton "Désactiver la règle partout"
  const ignoreBtn = document.createElement("button");
  ignoreBtn.className = "albert-popup-ignore-rule";
  ignoreBtn.title = "Désactiver la règle partout";
  ignoreBtn.innerHTML = "⊘";
  ignoreBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const text = Albert.getTextContent(el);
    const word = text.slice(correction.offset, correction.offset + correction.length);
    await Albert.ignoreWord(word);
    // Retirer cette correction et les identiques
    const st = Albert.getOrCreateState(el);
    st.corrections = Albert.filterIgnoredCorrections(st.corrections, text);
    Albert.closePopup();
    Albert.renderCorrections(el);
  });
  msgRow.appendChild(ignoreBtn);

  body.appendChild(msgRow);

  // Extrait original
  const text = Albert.getTextContent(el);
  const original = text.slice(correction.offset, correction.offset + correction.length);
  const extract = document.createElement("div");
  extract.className = "albert-popup-extract";
  extract.textContent = `Essayez « ${(correction.suggestions && correction.suggestions[0]) || original} »`;
  body.appendChild(extract);

  // Boutons de suggestion + ignorer
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

  // ── Footer : navigation entre erreurs ──
  if (state.corrections.length > 1) {
    const footer = document.createElement("div");
    footer.className = "albert-popup-footer";

    const prevBtn = document.createElement("button");
    prevBtn.className = "albert-popup-nav albert-popup-nav-prev";
    prevBtn.innerHTML = "← Précédent";
    prevBtn.title = "Précédent";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(el, -1);
    });
    footer.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.className = "albert-popup-nav albert-popup-nav-next";
    nextBtn.innerHTML = "Suivant →";
    nextBtn.title = "Suivant";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(el, 1);
    });
    footer.appendChild(nextBtn);

    popup.appendChild(footer);
  }

  document.body.appendChild(popup);

  // ── Positionnement : réutiliser la position précédente si elle existe ──
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

  // ── Drag (poignée) ──
  Albert.initPopupDrag(popup, handle);

  Albert.activePopup = popup;
};

// Navigation vers l'erreur précédente/suivante.
Albert.navigateError = function (el, direction) {
  const state = Albert.getOrCreateState(el);
  if (state.corrections.length === 0) return;

  let newIdx = Albert.activePopupIdx + direction;
  if (newIdx < 0) newIdx = state.corrections.length - 1;
  if (newIdx >= state.corrections.length) newIdx = 0;

  // Trouver le markEl correspondant
  const container = state.overlay || el;
  const mark = container.querySelector(`.albert-error[data-idx="${newIdx}"]`);
  if (mark) {
    mark.scrollIntoView({ block: "nearest", behavior: "smooth" });
    Albert.showPopup(el, { ...state.corrections[newIdx], idx: newIdx }, mark);
  }
};

// Rend le popup déplaçable via la poignée.
Albert.initPopupDrag = function (popup, handle) {
  let isDragging = false;
  let startX, startY, origLeft, origTop;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = popup.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    handle.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    popup.style.left = (origLeft + e.clientX - startX) + "px";
    popup.style.top = (origTop + e.clientY - startY) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
    }
  });
};

// Ferme le popup actif et réinitialise la position sauvegardée.
Albert.closePopup = function () {
  if (Albert.activePopup) {
    Albert.activePopup.remove();
    Albert.activePopup = null;
    Albert.activePopupEl = null;
    Albert.activePopupIdx = -1;
    Albert.popupPosition = null;
  }
};

// Le popup ne se ferme que via le bouton fermer (croix).
