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
      // Mettre à jour le bouton
      modeBtn.textContent = m.label + " ";
      const chev = document.createElement("span");
      chev.className = "albert-popup-chevron";
      chev.textContent = "▾";
      modeBtn.appendChild(chev);
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
  ignoreBtn.textContent = "⊘";
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
    prevBtn.textContent = "← Précédent";
    prevBtn.title = "Précédent";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(el, -1);
    });
    footer.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.className = "albert-popup-nav albert-popup-nav-next";
    nextBtn.textContent = "Suivant →";
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

// ── Popup de reformulation (résultat du menu contextuel) ──

// Sauvegarde du contexte de la sélection avant que le menu contextuel ne la perde.
Albert.savedSelection = null;

document.addEventListener("contextmenu", (e) => {
  const activeEl = document.activeElement;
  const sel = window.getSelection();
  const clickPos = { x: e.clientX, y: e.clientY };

  if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")) {
    Albert.savedSelection = {
      type: "input",
      el: activeEl,
      start: activeEl.selectionStart,
      end: activeEl.selectionEnd,
      text: activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd),
      clickPos,
    };
  } else if (sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    Albert.savedSelection = {
      type: "range",
      range: range.cloneRange(),
      text: sel.toString(),
      clickPos,
    };
  } else {
    Albert.savedSelection = null;
  }
});

Albert.showReformulationPopup = function (originalText, suggestions) {
  Albert.closePopup();

  const themeClass = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup" + (themeClass ? " " + themeClass : "");

  // Header
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "albert-popup-header-left";

  const icon = document.createElement("img");
  icon.src = Albert.ICON_URL;
  icon.alt = "Albert";
  icon.className = "albert-popup-icon";
  headerLeft.appendChild(icon);

  const title = document.createElement("span");
  title.className = "albert-popup-mode-btn";
  title.textContent = "Reformuler";
  title.style.cursor = "default";
  headerLeft.appendChild(title);

  header.appendChild(headerLeft);

  const headerRight = document.createElement("div");
  headerRight.className = "albert-popup-header-right";

  const handle = document.createElement("div");
  handle.className = "albert-popup-handle";
  handle.textContent = "⠿";
  handle.title = "Déplacer";
  headerRight.appendChild(handle);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => Albert.closePopup());
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  popup.appendChild(header);

  // Corps
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  if (suggestions.length === 0) {
    const msg = document.createElement("div");
    msg.className = "albert-popup-message";
    msg.textContent = "Aucune reformulation proposée.";
    body.appendChild(msg);
  }

  suggestions.forEach((s) => {
    const block = document.createElement("div");
    block.style.marginBottom = "8px";

    if (s.message) {
      const msg = document.createElement("div");
      msg.className = "albert-popup-message";
      msg.textContent = s.message;
      block.appendChild(msg);
    }

    const sugBox = document.createElement("div");
    sugBox.className = "albert-popup-suggestions";

    (s.suggestions || []).forEach((sug) => {
      const btn = document.createElement("button");
      btn.className = "albert-popup-suggestion";
      btn.textContent = sug;
      btn.addEventListener("click", () => {
        Albert.applyReformulation(originalText, sug);
        Albert.closePopup();
      });
      sugBox.appendChild(btn);
    });
    block.appendChild(sugBox);
    body.appendChild(block);
  });

  popup.appendChild(body);
  document.body.appendChild(popup);

  // Positionner près du clic droit
  const saved = Albert.savedSelection;
  if (saved && saved.clickPos) {
    popup.style.top = (saved.clickPos.y + 4) + "px";
    popup.style.left = saved.clickPos.x + "px";

    requestAnimationFrame(() => {
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.right > window.innerWidth - 10) {
        popup.style.left = (window.innerWidth - popupRect.width - 10) + "px";
      }
      if (popupRect.bottom > window.innerHeight - 10) {
        popup.style.top = (saved.clickPos.y - popupRect.height - 4) + "px";
      }
    });
  } else {
    popup.style.top = "20%";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
  }

  Albert.initPopupDrag(popup, handle);
  Albert.activePopup = popup;
};

// Applique la reformulation en utilisant la sélection sauvegardée.
Albert.applyReformulation = function (originalText, replacement) {
  const saved = Albert.savedSelection;

  // Éviter le double point final : si l'original ne finit pas par une ponctuation
  // mais que la suggestion en ajoute une, la retirer
  const punctuation = [".", "!", "?", ";", ":"];
  const origEnds = punctuation.includes(originalText.trim().slice(-1));
  const replEnds = punctuation.includes(replacement.trim().slice(-1));
  if (!origEnds && replEnds) {
    replacement = replacement.trim().slice(0, -1);
  }

  if (saved && saved.type === "input") {
    // Textarea / Input : remplacement à la position sauvegardée
    const el = saved.el;
    const idx = el.value.indexOf(originalText, Math.max(0, saved.start - 10));
    if (idx !== -1) {
      el.value = el.value.slice(0, idx) + replacement + el.value.slice(idx + originalText.length);
      el.selectionStart = el.selectionEnd = idx + replacement.length;
    } else {
      // Fallback : remplacement à la position sauvegardée
      el.value = el.value.slice(0, saved.start) + replacement + el.value.slice(saved.end);
      el.selectionStart = el.selectionEnd = saved.start + replacement.length;
    }
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (saved && saved.type === "range") {
    // Contenteditable : remplacement via le range sauvegardé
    const range = saved.range;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    range.deleteContents();
    range.insertNode(document.createTextNode(replacement));
    sel.collapseToEnd();
  }

  Albert.savedSelection = null;
};

// ── Popup de traduction ──

const TRANSLATE_LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "Anglais" },
  { code: "es", label: "Espagnol" },
  { code: "de", label: "Allemand" },
];

// Dernière langue sélectionnée (persistée dans storage)
Albert.lastTranslateLang = "en";
browser.storage.local.get("lastTranslateLang").then((r) => {
  if (r.lastTranslateLang) Albert.lastTranslateLang = r.lastTranslateLang;
});

const LANG_LABELS = { fr: "Français", en: "Anglais", es: "Espagnol", de: "Allemand" };

// Lance la traduction et met à jour la popup.
Albert.doTranslate = async function (originalText, targetLang, resultDiv, copyBtn, loadingMsg, langInfoEl) {
  if (loadingMsg) loadingMsg.textContent = "Traduction en cours…";
  if (langInfoEl) langInfoEl.textContent = "";
  resultDiv.style.display = "none";
  copyBtn.style.display = "none";

  // Sauvegarder la langue choisie
  Albert.lastTranslateLang = targetLang;
  browser.storage.local.set({ lastTranslateLang: targetLang });

  const response = await browser.runtime.sendMessage({
    type: "translate",
    text: originalText,
    targetLang,
  });

  if (response.error) {
    Albert.showToast(response.error, 5);
    if (loadingMsg) loadingMsg.textContent = "";
    return;
  }

  if (loadingMsg) loadingMsg.textContent = "";
  if (langInfoEl && response.langSource) {
    langInfoEl.textContent = (LANG_LABELS[response.langSource] || response.langSource) + " → " + (LANG_LABELS[targetLang] || targetLang);
  }
  resultDiv.textContent = response.translation;
  resultDiv.style.display = "block";
  copyBtn.style.display = "inline-block";
};

Albert.showTranslationPopup = function (originalText) {
  Albert.closePopup();

  const themeClass = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup" + (themeClass ? " " + themeClass : "");

  // ── Header : icône, sélecteur de langue, bouton traduire, poignée, fermer ──
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "albert-popup-header-left";

  const icon = document.createElement("img");
  icon.src = Albert.ICON_URL;
  icon.alt = "Albert";
  icon.className = "albert-popup-icon";
  headerLeft.appendChild(icon);

  // Sélecteur de langue dans le header
  const langSelect = document.createElement("select");
  langSelect.className = "albert-popup-lang-select";

  TRANSLATE_LANGS.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = l.label;
    if (l.code === Albert.lastTranslateLang) opt.selected = true;
    langSelect.appendChild(opt);
  });
  headerLeft.appendChild(langSelect);

  // Bouton traduire dans le header
  const translateBtn = document.createElement("button");
  translateBtn.className = "albert-popup-translate-btn";
  translateBtn.textContent = "Traduire";
  headerLeft.appendChild(translateBtn);

  header.appendChild(headerLeft);

  const headerRight = document.createElement("div");
  headerRight.className = "albert-popup-header-right";

  const handle = document.createElement("div");
  handle.className = "albert-popup-handle";
  handle.textContent = "⠿";
  handle.title = "Déplacer";
  headerRight.appendChild(handle);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => Albert.closePopup());
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  popup.appendChild(header);

  // ── Corps ──
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  // Indication de langue (ex: "Français → Anglais")
  const langInfoEl = document.createElement("div");
  langInfoEl.className = "albert-popup-extract";
  body.appendChild(langInfoEl);

  // Message de chargement
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "albert-popup-message";
  loadingMsg.textContent = "Traduction en cours…";
  body.appendChild(loadingMsg);

  // Zone de résultat
  const resultDiv = document.createElement("div");
  resultDiv.className = "albert-popup-translation-result";
  resultDiv.style.display = "none";
  body.appendChild(resultDiv);

  // Bouton copier
  const copyBtn = document.createElement("button");
  copyBtn.className = "albert-popup-suggestion";
  copyBtn.textContent = "Copier";
  copyBtn.style.display = "none";
  copyBtn.style.marginTop = "8px";
  body.appendChild(copyBtn);

  popup.appendChild(body);
  document.body.appendChild(popup);

  // ── Positionnement ──
  const saved = Albert.savedSelection;
  if (saved && saved.clickPos) {
    popup.style.top = (saved.clickPos.y + 4) + "px";
    popup.style.left = saved.clickPos.x + "px";
    requestAnimationFrame(() => {
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.right > window.innerWidth - 10) {
        popup.style.left = (window.innerWidth - popupRect.width - 10) + "px";
      }
      if (popupRect.bottom > window.innerHeight - 10) {
        popup.style.top = (saved.clickPos.y - popupRect.height - 4) + "px";
      }
    });
  } else {
    popup.style.top = "20%";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
  }

  Albert.initPopupDrag(popup, handle);
  Albert.activePopup = popup;

  // ── Actions ──

  // Bouton traduire (relancer avec la langue choisie)
  translateBtn.addEventListener("click", () => {
    Albert.doTranslate(originalText, langSelect.value, resultDiv, copyBtn, loadingMsg, langInfoEl);
  });

  // Copier
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(resultDiv.textContent).then(() => {
      copyBtn.textContent = "Copié !";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 2000);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = resultDiv.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      copyBtn.textContent = "Copié !";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 2000);
    });
  });

  // Traduction automatique à l'ouverture dans la dernière langue
  Albert.doTranslate(originalText, Albert.lastTranslateLang, resultDiv, copyBtn, loadingMsg, langInfoEl);
};

// Écoute les messages du background script.
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateResult") {
    if (message.result.error) {
      Albert.showToast(message.result.error, 5);
      return;
    }
    const suggestions = message.result.corrections || [];
    Albert.showReformulationPopup(message.originalText, suggestions);
  }

  if (message.type === "translateGetSelection") {
    // Récupérer le texte complet depuis la sélection sauvegardée
    const saved = Albert.savedSelection;
    const fullText = saved ? saved.text : window.getSelection().toString();
    if (!fullText || fullText.trim().length < 3) {
      Albert.showToast("Sélectionnez du texte à traduire.", 3);
      return;
    }
    // Couper le texte s'il est trop long (2000 caractères max)
    const textToTranslate = fullText.length > 2000 ? fullText.slice(0, 2000) : fullText;
    Albert.showTranslationPopup(textToTranslate);
  }
});
