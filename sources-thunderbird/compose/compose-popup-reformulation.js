// compose-popup-reformulation.js --- Popup de reformulation dans le compose Thunderbird.

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

Albert.showReformulationPopup = function (originalText, result) {
  Albert.closeReformulationPopup();
  Albert.closeCorrectionPopup();
  Albert.closeTranslationPopup();

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

  const title = document.createElement("span");
  title.className = "albert-popup-type";
  title.textContent = "Reformulation";
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

  if (result && result.corrections && result.corrections.length) {
    const sugDiv = document.createElement("div");
    sugDiv.className = "albert-popup-suggestions";
    for (const c of result.corrections) {
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
    }
    popup.appendChild(sugDiv);
  } else if (result && result.error) {
    const errDiv = document.createElement("div");
    errDiv.className = "albert-popup-message";
    errDiv.textContent = result.error;
    popup.appendChild(errDiv);
  }

  document.body.appendChild(popup);
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "30%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = "2147483647";

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
