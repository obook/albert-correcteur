/*
 * compose-popup-reformulation.js - Popup de reformulation (Thunderbird).
 *
 * Affiche les propositions de reformulation renvoyées par l'API
 * après un clic sur "Reformuler avec Albert" dans le menu
 * contextuel du compose. Centrée à l'ouverture, fermable par Escape
 * ou clic en dehors. Le bandeau, la poignée de déplacement et le
 * bornage à la fenêtre viennent de popup-contenu/popup-layout.js.
 *
 * Le remplacement du texte sélectionné utilise
 * document.execCommand("insertText") pour préserver l'undo natif.
 *
 * Dépendances (injectées avant ce fichier) :
 *   - util/popup-base.js            (getPopupThemeClass)
 *   - util/popup-focus.js           (trapFocus, restoreFocus)
 *   - popup-contenu/popup-layout.js (createPopupHeader, initPopupDrag)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.reformulationPopup = null;
/* Range cloné au clic sur le menu, pour restaurer la sélection
   d'origine dans le corps du compose avant d'appliquer une suggestion.
   La popup vole le focus dès son ouverture, ce qui collapserait la
   sélection sinon. reformulationSavedText est son texte à ce moment. */
Albert.reformulationSavedRange = null;
Albert.reformulationSavedText = "";

Albert.captureReformulationRange = function () {
  const sel = window.getSelection();
  const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
  Albert.reformulationSavedRange = range;
  Albert.reformulationSavedText = range ? range.toString() : "";
};

Albert.closeReformulationPopup = function () {
  if (Albert.reformulationPopup) {
    if (Albert.reformulationPopup._focusTrapHandler) {
      Albert.reformulationPopup.removeEventListener("keydown", Albert.reformulationPopup._focusTrapHandler);
      Albert.reformulationPopup._focusTrapHandler = null;
    }
    Albert.reformulationPopup.remove();
    Albert.reformulationPopup = null;
    Albert.reformulationSavedRange = null;
  }
  Albert.restoreFocus();
};

Albert.showReformulationPopup = function (originalText, result, personaLabel) {
  /* La plage relevée au clic survit à la fermeture d'une popup
     précédente : la fermeture la remettrait à null. */
  const range = Albert.reformulationSavedRange;
  Albert.closeReformulationPopup();
  Albert.reformulationSavedRange = range;
  Albert.closeCorrectionPopup();
  /* La popup de traduction est un script à part : garder l'ouverture
     possible si son injection a échoué. */
  if (Albert.closeTranslationPopup) Albert.closeTranslationPopup();
  const loadingToast = document.querySelector(".albert-toast");
  if (loadingToast) loadingToast.remove();

  /* Repli si la plage n'a pas été relevée au clic, ou si Thunderbird
     l'avait déjà réduite en fermant le menu : la sélection courante,
     avant que la popup ne prenne le focus. */
  if (!range || range.collapsed) Albert.captureReformulationRange();

  const theme = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup" + (theme ? " " + theme : "");
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Reformulation");
  popup.setAttribute("aria-modal", "true");
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Reformulation";
  popup.appendChild(h2);

  /* Bandeau commun : même icône, même poignée et même croix que les
     popups de correction et de traduction, et un déplacement borné
     aux limites de la fenêtre. */
  const { headerLeft, handle } =
    Albert.createPopupHeader(popup, Albert.closeReformulationPopup);

  const title = document.createElement("span");
  title.className = "albert-popup-type";
  title.textContent = personaLabel ? "Reformulation : " + personaLabel : "Reformulation";
  headerLeft.appendChild(title);

  const origDiv = document.createElement("div");
  origDiv.className = "albert-popup-message";
  origDiv.textContent = "Original : " + originalText;
  popup.appendChild(origDiv);

  const corrections = (result && result.corrections) || [];

  /* Calculer le nombre réel de boutons générés : un block sans
     suggestion (peut arriver si la conversion côté worker a vidé le
     tableau) ne doit pas masquer le message "aucune proposition". */
  let totalSuggestions = 0;

  if (corrections.length) {
    for (const c of corrections) {
      const sugList = (c.suggestions || []).filter((s) => typeof s === "string" && s.length > 0);
      if (sugList.length === 0 && !c.message) continue;

      const block = document.createElement("div");
      block.style.marginBottom = "8px";

      if (c.message) {
        const msg = document.createElement("div");
        msg.className = "albert-popup-message";
        msg.textContent = c.message;
        block.appendChild(msg);
      }

      const sugDiv = document.createElement("div");
      sugDiv.className = "albert-popup-suggestions";
      for (const sug of sugList) {
        const btn = document.createElement("button");
        btn.className = "albert-popup-suggestion";
        btn.textContent = sug;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          Albert.replaceSelection(sug);
          Albert.closeReformulationPopup();
        });
        sugDiv.appendChild(btn);
        totalSuggestions++;
      }
      block.appendChild(sugDiv);
      popup.appendChild(block);
    }
  }

  if (result && result.error) {
    const errDiv = document.createElement("div");
    errDiv.className = "albert-popup-message";
    errDiv.textContent = result.error;
    popup.appendChild(errDiv);
  } else if (totalSuggestions === 0) {
    /* Le modèle a renvoyé un tableau vide ou des objets non
       coercibles : afficher un message clair plutôt qu'une popup avec
       seulement le texte d'origine. */
    const noneDiv = document.createElement("div");
    noneDiv.className = "albert-popup-message";
    noneDiv.textContent = "Aucune reformulation proposée. Le modèle "
      + "a estimé que le texte ne nécessitait pas de modification, "
      + "ou n'a pas su l'adapter au persona choisi.";
    popup.appendChild(noneDiv);
  }

  Albert.uiRoot().appendChild(popup);
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.maxHeight = "80vh";
  popup.style.overflowY = "auto";
  popup.style.zIndex = "2147483647";

  /* Le déplacement à la souris était réécrit ici avec deux écouteurs
     anonymes sur document, jamais retirés : après N reformulations,
     2N écouteurs tournaient à chaque mouvement de souris. */
  Albert.initPopupDrag(popup, handle);

  Albert.trapFocus(popup);
  Albert.reformulationPopup = popup;
};

Albert.replaceSelection = function (text) {
  /* Restaurer la sélection d'origine dans le compose body : la popup
     vient de la collapser en prenant le focus. Sans cette restauration,
     execCommand("insertText") opère sur le bouton de la popup au lieu
     du corps du mail et l'insertion est silencieusement perdue. */
  const range = Albert.reformulationSavedRange;
  /* Un range suit les modifications du DOM : si son texte a changé
     depuis le clic, le remplacer écraserait la saisie faite depuis. */
  if (range && range.toString() !== Albert.reformulationSavedText) {
    Albert.showToast("Reformulation impossible : le texte a changé.", 3000);
    return;
  }
  if (range) {
    const body = Albert.getComposeBody();
    if (body) body.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* insertText conserve l'historique d'annulation natif. Si le moteur
     ne le supporte pas (cas marginal en designMode), on retombe sur
     une manipulation DOM directe via le range sauvegardé. */
  if (!document.execCommand("insertText", false, text) && range) {
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    const body = Albert.getComposeBody();
    if (body) body.normalize();
  }
};

/* La fermeture par Échap est centralisée dans compose-popup-utils.js. */
document.addEventListener("mousedown", (e) => {
  if (Albert.reformulationPopup && !Albert.reformulationPopup.contains(e.target)) {
    Albert.closeReformulationPopup();
  }
});
