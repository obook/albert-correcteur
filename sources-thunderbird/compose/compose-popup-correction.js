/*
 * compose-popup-correction.js - Popup de correction (Thunderbird).
 *
 * Affiche une popup de correction au clic sur un mot souligné dans
 * la fenêtre de composition. Structure DOM identique au popup Firefox
 * pour partager les feuilles de style CSS.
 *
 * Contenu de la popup :
 *   - Type d'erreur (Orthographe, Grammaire, Style).
 *   - Message d'explication.
 *   - Bouton "Ignorer partout" (dictionnaire personnel).
 *   - Suggestions cliquables.
 *   - Navigation Précédent / Suivant entre les erreurs.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.showCorrectionPopup = function (correction, markEl) {
  Albert.closeCorrectionPopup();
  Albert.closeReformulationPopup();
  Albert.closeTranslationPopup();

  const state = Albert.composeState;
  const idx = correction.index != null ? correction.index : 0;
  Albert.activePopupIdx = idx;

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Correction suggérée");
  popup.setAttribute("aria-modal", "true");
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Correction suggérée";
  popup.appendChild(h2);

  /* --- Header (identique à Firefox) --- */
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "albert-popup-header-left";

  const typeLabel = document.createElement("span");
  typeLabel.className = "albert-popup-type";
  const typeNames = {
    spelling: "Orthographe",
    grammar: "Grammaire",
    style: "Style",
  };
  typeLabel.textContent = typeNames[correction.type]
    || correction.type
    || "Orthographe";
  headerLeft.appendChild(typeLabel);

  header.appendChild(headerLeft);

  const headerRight = document.createElement("div");
  headerRight.className = "albert-popup-header-right";

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeCorrectionPopup();
  });
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  popup.appendChild(header);

  /* --- Body (identique à Firefox) --- */
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  /* Message + bouton ignorer */
  const msgRow = document.createElement("div");
  msgRow.className = "albert-popup-msg-row";

  const msg = document.createElement("div");
  msg.className = "albert-popup-message";
  msg.textContent = correction.message || "Erreur détectée";
  msgRow.appendChild(msg);

  const ignoreBtn = document.createElement("button");
  ignoreBtn.className = "albert-popup-ignore-rule";
  ignoreBtn.title = "Ignorer partout";
  ignoreBtn.textContent = "\u2298";
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
  msgRow.appendChild(ignoreBtn);
  body.appendChild(msgRow);

  /* Extrait "Essayez..." */
  if (correction.suggestions && correction.suggestions.length) {
    const extract = document.createElement("div");
    extract.className = "albert-popup-extract";
    extract.textContent = "Essayez \u00AB " + correction.suggestions[0] + " \u00BB";
    body.appendChild(extract);
  }

  /* Suggestions */
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

    const dismiss = document.createElement("button");
    dismiss.className = "albert-popup-dismiss";
    dismiss.textContent = "Ignorer";
    dismiss.addEventListener("click", () => Albert.closeCorrectionPopup());
    sugDiv.appendChild(dismiss);

    body.appendChild(sugDiv);
  }

  popup.appendChild(body);

  /* --- Footer : navigation (identique à Firefox) --- */
  if (state && state.corrections && state.corrections.length > 1) {
    const footer = document.createElement("div");
    footer.className = "albert-popup-footer";

    const prevBtn = document.createElement("button");
    prevBtn.className = "albert-popup-nav albert-popup-nav-prev";
    prevBtn.textContent = "\u2190 Précédent";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(-1);
    });
    footer.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.className = "albert-popup-nav albert-popup-nav-next";
    nextBtn.textContent = "Suivant \u2192";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.navigateError(1);
    });
    footer.appendChild(nextBtn);

    popup.appendChild(footer);
  }

  /* --- Positionnement sous le mot --- */
  Albert.uiRoot().appendChild(popup);
  const rect = markEl.getBoundingClientRect();
  popup.style.top = (rect.bottom + 4) + "px";
  popup.style.left = rect.left + "px";

  /* Éviter le débordement à droite ou en bas */
  requestAnimationFrame(() => {
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth - 10) {
      popup.style.left = (window.innerWidth - popupRect.width - 10) + "px";
    }
    if (popupRect.bottom > window.innerHeight - 10) {
      popup.style.top = (rect.top - popupRect.height - 4) + "px";
    }
  });

  Albert.trapFocus(popup);
  Albert.correctionPopup = popup;
};

/* Navigation entre erreurs */
Albert.navigateError = function (direction) {
  const state = Albert.composeState;
  if (!state || !state.corrections || state.corrections.length === 0) return;

  let newIdx = Albert.activePopupIdx + direction;
  if (newIdx < 0) newIdx = state.corrections.length - 1;
  if (newIdx >= state.corrections.length) newIdx = 0;

  const mark = document.querySelector(
    '[data-correction-index="' + newIdx + '"]'
  );
  if (mark) {
    mark.scrollIntoView({ block: "nearest", behavior: "smooth" });
    /* Les corrections stockées dans composeState n'ont pas de champ index :
       sans lui, applySuggestion ne retrouve pas le span souligné et
       retombe sur le repli par offset. */
    Albert.showCorrectionPopup(
      Object.assign({}, state.corrections[newIdx], { index: newIdx }),
      mark
    );
  }
};
