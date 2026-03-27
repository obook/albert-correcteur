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

  // Désactiver le correcteur natif du navigateur pour éviter les doubles soulignements
  el.setAttribute("spellcheck", "false");

  // Gestion IME : ne pas déclencher de vérification pendant la composition
  el.addEventListener("compositionstart", () => {
    const st = Albert.getOrCreateState(el);
    st.isComposing = true;
  });
  el.addEventListener("compositionend", () => {
    const st = Albert.getOrCreateState(el);
    st.isComposing = false;
    Albert.scheduleCheck(el);
  });

  // Vérification immédiate au paste (sans attendre le debounce complet)
  el.addEventListener("paste", () => {
    setTimeout(() => {
      const st = Albert.getOrCreateState(el);
      if (st.badge) Albert.updateBadgeVisibility(el, st.badge);
      clearTimeout(st.timer);
      clearTimeout(st.maxTimer);
      st.timer = null;
      st.maxTimer = null;
      Albert.triggerCheck(el);
    }, 50);
  });

  el.addEventListener("input", () => {
    const st = Albert.getOrCreateState(el);
    if (st.badge) Albert.updateBadgeVisibility(el, st.badge);

    // Si c'est une correction appliquée par Albert, ne pas tout effacer
    if (Albert.applyingCorrection) return;

    // Ne pas réagir pendant la composition IME (saisie CJK en cours)
    if (st.isComposing) return;

    // Entrée en "typing mode" : masquer l'overlay et le popup
    // mais conserver les corrections en mémoire (elles seront migrées ou revérifiées)
    if (st.badge) {
      st.badge.classList.remove("albert-has-errors", "albert-no-errors");
      const img = st.badge.querySelector("img");
      if (img) img.src = Albert.ICON_URL;
      st.badge.title = "Albert Correcteur";
    }
    if (st.overlay) {
      st.overlay.remove();
      st.overlay = null;
    }
    Albert.closePopup();

    // Timer "fin de frappe" : quand l'utilisateur arrête de taper,
    // ré-afficher les corrections existantes (si le texte n'a pas changé)
    // en attendant la revérification complète
    clearTimeout(st.typingTimer);
    st.typingTimer = setTimeout(() => {
      if (st.corrections && st.corrections.length > 0 && st.lastCheckedText === Albert.getTextContent(el)) {
        Albert.renderCorrections(el);
      }
    }, Albert.STOPPED_TYPING_MS);

    Albert.scheduleCheck(el);
  });
  el.addEventListener("focus", () => {
    const st = Albert.getOrCreateState(el);
    if (!st.focused) {
      st.focused = true;
      Albert.ensureBadge(el);
      // Lancer la vérification immédiatement au premier focus
      Albert.scheduleCheck(el);
    }
    if (st.badge) Albert.positionBadge(el, st.badge);
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

// --- Démarrage ---
Albert.scanFields();
observer.observe(document.body, { childList: true, subtree: true });

// Première vérification rapide (1s après le chargement), puis cycle régulier
setTimeout(Albert.cycleCheckAll, 1000);
setInterval(Albert.cycleCheckAll, Albert.CYCLE_INTERVAL_MS);
