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
 * Licence : MIT
 */

"use strict";

Albert.showReformulationPopup = function (originalText, suggestions, personaLabel) {
  Albert.log("showReformulationPopup:", suggestions.length, "suggestions",
    "persona=" + (personaLabel || "(aucun)"),
    "originalText.length=" + originalText.length);
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
  title.textContent = personaLabel
    ? "Reformuler : " + personaLabel
    : "Reformuler";
  title.style.cursor = "default";
  headerLeft.appendChild(title);

  /* Corps */
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  /* Compter les boutons réellement générés : un block sans suggestion
     chaînée valide ne doit pas masquer le message "aucune
     proposition". */
  let totalSuggestions = 0;

  suggestions.forEach((s) => {
    const sugList = (s.suggestions || []).filter((sug) => typeof sug === "string" && sug.length > 0);
    if (sugList.length === 0 && !s.message) return;

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

    sugList.forEach((sug) => {
      const btn = document.createElement("button");
      btn.className = "albert-popup-suggestion";
      btn.textContent = sug;
      btn.addEventListener("click", () => {
        Albert.applyReformulation(originalText, sug);
        Albert.closePopup();
      });
      sugBox.appendChild(btn);
      totalSuggestions++;
    });
    block.appendChild(sugBox);
    body.appendChild(block);
  });

  if (totalSuggestions === 0) {
    const msg = document.createElement("div");
    msg.className = "albert-popup-message";
    msg.textContent = "Aucune reformulation proposée. Le modèle a "
      + "estimé que le texte ne nécessitait pas de modification, ou "
      + "n'a pas su l'adapter au persona choisi.";
    body.appendChild(msg);
  }

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
  Albert.log("applyReformulation:",
    saved ? "savedSelection." + saved.type : "savedSelection=null",
    "replacement.length=" + replacement.length);
  if (!saved) {
    Albert.warn("applyReformulation: aucune sélection sauvegardée, "
      + "remplacement impossible. L'éditeur a peut-être perdu le focus "
      + "entre le contextmenu et le clic dans la popup.");
    return;
  }

  /* Éviter le double point final */
  const punctuation = [".", "!", "?", ";", ":"];
  const origEnds = punctuation.includes(originalText.trim().slice(-1));
  const replEnds = punctuation.includes(replacement.trim().slice(-1));
  if (!origEnds && replEnds) {
    replacement = replacement.trim().slice(0, -1);
  }

  if (saved && saved.type === "input") {
    const el = saved.el;
    /* La position sauvegardée fait foi : un indexOf prioritaire
       remplacerait la mauvaise occurrence quand le même texte apparaît
       plusieurs fois dans le champ (formules de politesse, listes). */
    let idx = saved.start;
    if (el.value.slice(saved.start, saved.start + originalText.length) !== originalText) {
      const trouve = el.value.indexOf(originalText, saved.start);
      idx = (trouve !== -1) ? trouve : -1;
    }
    if (idx !== -1) {
      el.value = el.value.slice(0, idx) + replacement
        + el.value.slice(idx + originalText.length);
      el.selectionStart = el.selectionEnd = idx + replacement.length;
    } else {
      el.value = el.value.slice(0, saved.start) + replacement + el.value.slice(saved.end);
      el.selectionStart = el.selectionEnd = saved.start + replacement.length;
    }
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (saved && saved.type === "range") {
    const host = saved.host;
    const sel = window.getSelection();
    if (host) host.focus();
    sel.removeAllRanges();
    sel.addRange(saved.range);
    /* Passer par la chaîne d'événements complète (beforeinput,
       textInput, execCommand, repli paste). Une manipulation DOM
       directe laisse le modèle interne de Draft.js, Lexical, CKEditor
       ou ProseMirror désynchronisé : l'éditeur restaure alors l'ancien
       texte au rendu suivant. */
    if (host) {
      Albert._insertTextInEditor(host, replacement);
    } else {
      const range = saved.range;
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));
      sel.collapseToEnd();
    }
  }

  Albert.savedSelection = null;
};
