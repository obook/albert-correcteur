/*
 * albert-popup-common.js - Fonctions partagées par toutes les popups.
 *
 * Ce module fournit les services communs aux popups de correction,
 * reformulation et traduction :
 *   - Thème : détection du thème (sombre, clair, système).
 *   - Fermeture : closePopup() avec restauration du focus.
 *   - Piège de focus et restauration : délégués à
 *     util/popup-focus.js, partagé entre les cibles.
 *   - Fermeture par Échap ou clic en dehors de la popup.
 *   - Sauvegarde de la sélection avant le menu contextuel
 *     (nécessaire pour la reformulation et la traduction).
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Thème --- */

/* getPopupThemeClass vit dans util/popup-base.js, partagé avec
   Thunderbird. */

/* Langue de correction par défaut (paramètres) : "auto" ou un code de
   util/lang-names.js. Sert au libellé de la première entrée du
   sélecteur de langue de la popup de correction. */
Albert.langueDefaut = "auto";

Albert.loadPopupTheme = async function () {
  const result = await browser.storage.local.get(["popupTheme", "langue"]);
  Albert.popupTheme = result.popupTheme || "dark";
  Albert.langueDefaut = result.langue || "auto";
};
Albert.loadPopupTheme();

browser.storage.onChanged.addListener((changes) => {
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
  if (changes.langue) {
    Albert.langueDefaut = changes.langue.newValue || "auto";
  }
});

/* --- Fermeture --- */

Albert.popupPosition = null;

Albert.closePopup = function () {
  if (Albert.activePopup) {
    if (Albert.activePopup._focusTrapHandler) {
      Albert.activePopup.removeEventListener("keydown", Albert.activePopup._focusTrapHandler);
      Albert.activePopup._focusTrapHandler = null;
    }
    Albert.activePopup.remove();
    Albert.activePopup = null;
    Albert.activePopupIdx = -1;
    Albert.popupPosition = null;
  }
  Albert.restoreFocus();
};

/* --- Fenêtre d'accueil --- */

/**
 * Fenêtre où afficher une popup ouverte depuis ce cadre, et décalage
 * du cadre dans cette fenêtre.
 *
 * Dans une iframe d'éditeur (TinyMCE de Pronote, 106 px de haut), la
 * popup était rognée par le cadre, boutons de suggestion compris. On
 * remonte donc les cadres de même origine : frameElement vaut null
 * sous un parent d'une autre origine.
 *
 * @param {Window} [depart=window] - Fenêtre du champ.
 * @returns {{win: Window, dx: number, dy: number}}
 */
Albert.fenetreHote = function (depart = window) {
  let win = depart;
  let dx = 0;
  let dy = 0;
  try {
    while (win.frameElement) {
      const cadre = win.frameElement;
      const rect = cadre.getBoundingClientRect();
      /* ponytail: padding de l'iframe ignoré, nul sur les éditeurs
         connus ; l'ajouter si un site en met un. */
      dx += rect.left + cadre.clientLeft;
      dy += rect.top + cadre.clientTop;
      win = win.parent;
    }
  } catch (e) {
    /* Parent inaccessible : garder le dernier cadre atteint. */
  }
  return { win, dx, dy };
};

/* --- Fermeture par Échap ou clic en dehors --- */

function fermerSurEchap(e) {
  if (e.key === "Escape" && Albert.activePopup) {
    Albert.closePopup();
  }
}

function surMousedown(e) {
  if (!Albert.activePopup) return;
  /* composedPath et non contains : la popup vit dans un shadow DOM, la
     cible vue depuis le document est le conteneur hôte, jamais la
     popup, et tout clic dedans passait pour un clic dehors. */
  if (!e.composedPath().includes(Albert.activePopup)) {
    Albert.closePopup();
    return;
  }
  /* Clic dans la popup : garder le focus dans le champ corrigé. Sans
     cela, un champ qui s'agrandit au focus se replie au moment même où
     l'utilisateur clique sur la suggestion. Les champs de saisie de la
     popup gardent leur comportement normal. */
  const cible = e.composedPath()[0];
  if (cible && cible.closest
    && !cible.closest("input, textarea, select, [contenteditable=\"true\"]")) {
    e.preventDefault();
  }
}

/*
 * Tab hors de la popup ouverte : y entrer. Les popups laissent le focus
 * au champ à l'ouverture (voir showPopup), le clavier y accède ainsi.
 * Phase de capture : passer avant la page, qui peut traiter Tab dans
 * son champ (Pronote valide alors la case et passe à la suivante).
 */
function entrerDansPopupSurTab(e) {
  if (e.key !== "Tab" || !Albert.activePopup) {
    return;
  }
  if (e.composedPath().includes(Albert.activePopup)) {
    return;
  }
  const premier = Albert.activePopup.querySelector(SELECTEUR_FOCUSABLES);
  if (premier) {
    e.preventDefault();
    premier.focus();
  }
}

/* Documents écoutés, pour retirer les écouteurs à la fermeture du cadre. */
const documentsEcoutes = new Set();

/**
 * Pose Échap, Tab et clic en dehors sur un document. Le document d'un
 * cadre parent qui accueille la popup en a besoin aussi : clics et
 * touches dans la popup n'arrivent pas au document du champ.
 * addEventListener ignore un écouteur déjà posé, l'appel répété est
 * donc sans effet.
 *
 * @param {Document} doc - Document à écouter.
 */
Albert.ecouterFermeture = function (doc) {
  documentsEcoutes.add(doc);
  doc.addEventListener("keydown", fermerSurEchap);
  doc.addEventListener("keydown", entrerDansPopupSurTab, true);
  doc.addEventListener("mousedown", surMousedown);
};
Albert.ecouterFermeture(document);

/*
 * Cadre qui se ferme (iframe d'éditeur retirée par la page) : sa popup
 * et ses écouteurs vivent peut-être dans le cadre parent, et plus rien
 * ne les retirerait. Le document propre au cadre n'est pas touché : il
 * disparaît avec lui, ou revient tel quel depuis le cache de navigation.
 */
window.addEventListener("pagehide", () => {
  if (Albert.activePopup) {
    Albert.activePopup.remove();
    Albert.activePopup = null;
  }
  for (const doc of documentsEcoutes) {
    if (doc !== document) {
      doc.removeEventListener("keydown", fermerSurEchap);
      doc.removeEventListener("keydown", entrerDansPopupSurTab, true);
      doc.removeEventListener("mousedown", surMousedown);
      documentsEcoutes.delete(doc);
    }
  }
});

/* --- Sauvegarde de la sélection avant le menu contextuel --- */

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
    /* Mémoriser l'élément éditable qui contient la sélection : le
       remplacement doit lui adresser la chaîne d'événements
       (beforeinput, textInput) attendue par les éditeurs riches. */
    const ancestor = range.commonAncestorContainer;
    const startEl = ancestor.nodeType === Node.ELEMENT_NODE
      ? ancestor
      : ancestor.parentElement;
    Albert.savedSelection = {
      type: "range",
      range: range.cloneRange(),
      host: startEl ? startEl.closest("[contenteditable]") : null,
      text: sel.toString(),
      clickPos,
    };
  } else {
    Albert.savedSelection = null;
  }
  Albert.log("contextmenu:",
    Albert.savedSelection ? Albert.savedSelection.type : "null",
    Albert.savedSelection ? "len=" + Albert.savedSelection.text.length : "",
    window.top !== window ? "(iframe " + location.href + ")" : "");
});
