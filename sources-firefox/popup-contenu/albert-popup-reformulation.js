/*
 * albert-popup-reformulation.js - Popup de reformulation.
 *
 * Affiche les propositions de reformulation renvoyées par l'API
 * après un clic sur "Reformuler avec Albert" dans le menu
 * contextuel. Chaque suggestion est un bouton cliquable qui
 * remplace le texte sélectionné dans le champ d'origine.
 *
 * Le remplacement utilise la sélection sauvegardée par
 * albert-popup-common.js (événement contextmenu) pour retrouver
 * la position exacte du texte à remplacer.
 *
 * Dépendances :
 *   - albert-popup-common.js  (savedSelection, closePopup, trapFocus)
 *   - albert-popup-layout.js  (positionPopupAtClick, initPopupDrag,
 *                               createPopupHeader)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

"use strict";

Albert.showReformulationPopup = function (originalText, suggestions) {
  Albert.closePopup();
  const loadingToast = document.querySelector(".albert-toast");
  if (loadingToast) loadingToast.remove();

  const themeClass = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup" + (themeClass ? " " + themeClass : "");
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Reformulation");
  popup.setAttribute("aria-modal", "true");
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Reformulation";
  popup.appendChild(h2);

  /* Header */
  const { headerLeft, handle } = Albert.createPopupHeader(popup);

  const title = document.createElement("span");
  title.className = "albert-popup-mode-btn";
  title.textContent = "Reformuler";
  title.style.cursor = "default";
  headerLeft.appendChild(title);

  /* Corps */
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

  Albert.positionPopupAtClick(popup);
  Albert.initPopupDrag(popup, handle);
  Albert.trapFocus(popup);
  Albert.activePopup = popup;
};

/* Applique la reformulation en utilisant la sélection sauvegardée. */
Albert.applyReformulation = function (originalText, replacement) {
  const saved = Albert.savedSelection;

  /* Éviter le double point final */
  const punctuation = [".", "!", "?", ";", ":"];
  const origEnds = punctuation.includes(originalText.trim().slice(-1));
  const replEnds = punctuation.includes(replacement.trim().slice(-1));
  if (!origEnds && replEnds) {
    replacement = replacement.trim().slice(0, -1);
  }

  if (saved && saved.type === "input") {
    const el = saved.el;
    const idx = el.value.indexOf(originalText, Math.max(0, saved.start - 10));
    if (idx !== -1) {
      el.value = el.value.slice(0, idx) + replacement + el.value.slice(idx + originalText.length);
      el.selectionStart = el.selectionEnd = idx + replacement.length;
    } else {
      el.value = el.value.slice(0, saved.start) + replacement + el.value.slice(saved.end);
      el.selectionStart = el.selectionEnd = saved.start + replacement.length;
    }
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (saved && saved.type === "range") {
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
