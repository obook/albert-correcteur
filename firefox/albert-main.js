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

  el.addEventListener("input", () => Albert.scheduleCheck(el));
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
let scanTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(Albert.scanFields, Albert.SCAN_DEBOUNCE_MS);
});

// ── Démarrage ──
Albert.scanFields();
observer.observe(document.body, { childList: true, subtree: true });
setInterval(Albert.cycleCheckAll, Albert.CYCLE_INTERVAL_MS);
