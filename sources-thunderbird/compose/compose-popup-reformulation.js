/*
 * compose-popup-reformulation.js - Popup de reformulation (Thunderbird).
 *
 * Affiche les propositions de reformulation renvoyées par l'API
 * après un clic sur "Reformuler avec Albert" dans le menu
 * contextuel du compose. La popup est déplaçable (drag via le
 * header), centrée à l'ouverture, et fermable par Escape ou
 * clic en dehors.
 *
 * Le remplacement du texte sélectionné utilise
 * document.execCommand("insertText") pour préserver l'undo natif.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.reformulationPopup = null;

Albert.closeReformulationPopup = function () {
  if (Albert.reformulationPopup) {
    if (Albert.reformulationPopup._focusTrapHandler) {
      Albert.reformulationPopup.removeEventListener("keydown", Albert.reformulationPopup._focusTrapHandler);
      Albert.reformulationPopup._focusTrapHandler = null;
    }
    Albert.reformulationPopup.remove();
    Albert.reformulationPopup = null;
  }
  Albert.restoreFocus();
};

Albert.showReformulationPopup = function (originalText, result, personaLabel) {
  Albert.closeReformulationPopup();
  Albert.closeCorrectionPopup();
  Albert.closeTranslationPopup();
  const loadingToast = document.querySelector(".albert-toast");
  if (loadingToast) loadingToast.remove();

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Reformulation");
  popup.setAttribute("aria-modal", "true");
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Reformulation";
  popup.appendChild(h2);

  const header = document.createElement("div");
  header.className = "albert-popup-header";
  header.style.cursor = "grab";

  const title = document.createElement("span");
  title.className = "albert-popup-type";
  title.textContent = personaLabel ? "Reformulation : " + personaLabel : "Reformulation";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeReformulationPopup();
  });
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const origDiv = document.createElement("div");
  origDiv.className = "albert-popup-message";
  origDiv.textContent = "Original : " + originalText;
  popup.appendChild(origDiv);

  const corrections = (result && result.corrections) || [];

  if (corrections.length) {
    for (const c of corrections) {
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
      for (const sug of (c.suggestions || [])) {
        const btn = document.createElement("button");
        btn.className = "albert-popup-suggestion";
        btn.textContent = sug;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          Albert.replaceSelection(sug);
          Albert.closeReformulationPopup();
        });
        sugDiv.appendChild(btn);
      }
      block.appendChild(sugDiv);
      popup.appendChild(block);
    }
  } else if (result && result.error) {
    const errDiv = document.createElement("div");
    errDiv.className = "albert-popup-message";
    errDiv.textContent = result.error;
    popup.appendChild(errDiv);
  }

  document.body.appendChild(popup);
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.maxHeight = "80vh";
  popup.style.overflowY = "auto";
  popup.style.zIndex = "2147483647";

  /* Drag via le header */
  let isDragging = false;
  let startX, startY, origLeft, origTop;
  header.addEventListener("mousedown", (e) => {
    if (e.target === closeBtn) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = popup.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    popup.style.transform = "none";
    popup.style.left = rect.left + "px";
    popup.style.top = rect.top + "px";
    header.style.cursor = "grabbing";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    popup.style.left = (origLeft + e.clientX - startX) + "px";
    popup.style.top = (origTop + e.clientY - startY) + "px";
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = "grab";
    }
  });

  Albert.trapFocus(popup);
  Albert.reformulationPopup = popup;
};

Albert.replaceSelection = function (text) {
  document.execCommand("insertText", false, text);
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeReformulationPopup();
});
document.addEventListener("mousedown", (e) => {
  if (Albert.reformulationPopup && !Albert.reformulationPopup.contains(e.target)) {
    Albert.closeReformulationPopup();
  }
});
