// albert-main.js — Point d'entrée.
// Scanne les champs texte, observe les nouveaux champs et lance le cycle.

"use strict";

// Sélecteur CSS pour trouver les champs texte
const FIELD_SELECTOR = "textarea, input[type='text'], input:not([type]), [contenteditable='true']";

// Attache un champ texte à Albert (badge + événements).
Albert.attachField = function (el) {
  if (!Albert.isTextField(el)) return;
  const state = Albert.getOrCreateState(el);
  if (state.attached) return;
  state.attached = true;

  Albert.trackedFields.add(el);
  Albert.ensureBadge(el);

  el.addEventListener("input", () => {
    const st = Albert.getOrCreateState(el);
    if (st.badge) Albert.updateBadgeVisibility(el, st.badge);

    // Si c'est une correction appliquée par Albert, ne pas tout effacer
    if (Albert.applyingCorrection) return;

    // Saisie utilisateur : revenir à l'état initial
    if (st.badge) {
      st.badge.classList.remove("albert-has-errors");
      st.badge.title = "Albert Correcteur";
    }
    if (st.overlay) {
      st.overlay.remove();
      st.overlay = null;
    }
    Albert.closePopup();
    Albert.scheduleCheck(el);
  });
  el.addEventListener("focus", () => {
    const badge = Albert.ensureBadge(el);
    Albert.positionBadge(el, badge);
  });
};

// Scanne la page pour trouver tous les champs texte existants.
Albert.scanFields = function () {
  document.querySelectorAll(FIELD_SELECTOR).forEach(Albert.attachField);
};

// MutationObserver avec debounce pour détecter les nouveaux champs
// ajoutés dynamiquement (SPA, modales, etc.) sans ralentir la page.
// Ignore les mutations causées par les propres éléments d'Albert.
let scanTimer = null;
const observer = new MutationObserver((mutations) => {
  const isAlbertOnly = mutations.every((m) => {
    for (const node of m.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.className && typeof node.className === "string" && node.className.startsWith("albert-")) {
        continue;
      }
      return false;
    }
    return m.addedNodes.length > 0;
  });
  if (isAlbertOnly) return;

  clearTimeout(scanTimer);
  scanTimer = setTimeout(Albert.scanFields, Albert.SCAN_DEBOUNCE_MS);
});

// ── Démarrage ──
Albert.scanFields();
observer.observe(document.body, { childList: true, subtree: true });
setInterval(Albert.cycleCheckAll, Albert.CYCLE_INTERVAL_MS);
