// compose-popup-correction.js --- Popup de correction dans le compose Thunderbird.

"use strict";

Albert.correctionPopup = null;

Albert.closeCorrectionPopup = function () {
  if (Albert.correctionPopup) {
    Albert.correctionPopup.remove();
    Albert.correctionPopup = null;
  }
};

Albert.showCorrectionPopup = function (correction, markEl) {
  Albert.closeCorrectionPopup();
  Albert.closeReformulationPopup();
  Albert.closeTranslationPopup();

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Correction suggérée");

  // En-tête avec type d'erreur et bouton fermer
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const typeLabel = document.createElement("span");
  typeLabel.className = "albert-popup-type";
  typeLabel.textContent = correction.type || "orthographe";
  header.appendChild(typeLabel);

  // Navigation entre erreurs
  const state = Albert.composeState;
  if (state && state.corrections && state.corrections.length > 1) {
    const nav = document.createElement("span");
    nav.className = "albert-popup-nav";

    const idx = correction.index != null ? correction.index : state.corrections.indexOf(correction);
    nav.textContent = (idx + 1) + " / " + state.corrections.length;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "\u25C0";
    prevBtn.className = "albert-popup-nav-btn";
    prevBtn.setAttribute("aria-label", "Erreur précédente");
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const prevIdx = (idx - 1 + state.corrections.length) % state.corrections.length;
      const prevMark = document.querySelector('[data-correction-index="' + prevIdx + '"]');
      if (prevMark) Albert.showCorrectionPopup(state.corrections[prevIdx], prevMark);
    });

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "\u25B6";
    nextBtn.className = "albert-popup-nav-btn";
    nextBtn.setAttribute("aria-label", "Erreur suivante");
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nextIdx = (idx + 1) % state.corrections.length;
      const nextMark = document.querySelector('[data-correction-index="' + nextIdx + '"]');
      if (nextMark) Albert.showCorrectionPopup(state.corrections[nextIdx], nextMark);
    });

    nav.insertBefore(prevBtn, nav.firstChild);
    nav.appendChild(nextBtn);
    header.appendChild(nav);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeCorrectionPopup();
  });
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // Message d'explication
  if (correction.message) {
    const msg = document.createElement("div");
    msg.className = "albert-popup-message";
    msg.textContent = correction.message;
    popup.appendChild(msg);
  }

  // Suggestions
  if (correction.suggestions && correction.suggestions.length) {
    const sugDiv = document.createElement("div");
    sugDiv.className = "albert-popup-suggestions";
    for (const sug of correction.suggestions) {
      const btn = document.createElement("button");
      btn.className = "albert-popup-suggestion";
      btn.textContent = sug;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Albert.applySuggestion(correction, sug);
        Albert.closeCorrectionPopup();
      });
      sugDiv.appendChild(btn);
    }
    popup.appendChild(sugDiv);
  }

  // Bouton "Ignorer partout"
  const ignoreBtn = document.createElement("button");
  ignoreBtn.className = "albert-popup-ignore";
  ignoreBtn.textContent = "Ignorer partout";
  ignoreBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    Albert.ignoredWords.add(correction.word.toLowerCase());
    const arr = Array.from(Albert.ignoredWords);
    await browser.storage.local.set({ ignoredWords: arr });
    Albert.closeCorrectionPopup();
    if (state) {
      const filtered = Albert.filterIgnoredCorrections(state.corrections);
      Albert.renderCorrections(filtered);
    }
  });
  popup.appendChild(ignoreBtn);

  // Positionnement sous le mot souligné
  document.body.appendChild(popup);
  const rect = markEl.getBoundingClientRect();
  popup.style.position = "absolute";
  popup.style.left = rect.left + "px";
  popup.style.top = (rect.bottom + 4) + "px";
  popup.style.zIndex = "2147483647";

  Albert.correctionPopup = popup;
};

// Fermeture par Escape ou clic en dehors
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeCorrectionPopup();
});
document.addEventListener("mousedown", (e) => {
  if (Albert.correctionPopup && !Albert.correctionPopup.contains(e.target) && !e.target.closest(".albert-error")) {
    Albert.closeCorrectionPopup();
  }
});
