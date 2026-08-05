/*
 * albert-main.js - Point d'entrée du content script Firefox.
 *
 * Ce module est injecté dans chaque page web visitée. Il :
 * 1. Scanne la page pour trouver les champs texte existants.
 * 2. Attache à chaque champ un badge Albert et les écouteurs
 *    d'événements (input, paste, focus, composition IME).
 * 3. Observe le DOM via MutationObserver pour détecter les champs
 *    ajoutés dynamiquement (SPA, modales, AJAX).
 * 4. Lance un cycle périodique de vérification sur tous les champs.
 *
 * Flux d'un champ texte :
 *   Frappe utilisateur → input event → migration des offsets existants
 *   → scheduleCheck (debounce) → triggerCheck → API → renderCorrections
 *
 * Dépendances (chargées avant ce fichier dans le manifest) :
 *   - albert-state.js    (objet global Albert, constantes)
 *   - albert-utils.js    (isTextField, getOrCreateState, getTextContent)
 *   - albert-badge.js    (ensureBadge, positionBadge, updateBadgeVisibility)
 *   - albert-check.js    (triggerCheck, cycleCheckAll)
 *   - albert-debounce.js (scheduleCheck)
 *   - albert-render.js   (renderCorrections)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* Sélecteur CSS pour trouver les champs texte */
const FIELD_SELECTOR = "textarea, input[type='text'], input:not([type]), [contenteditable='true']";

/**
 * Attache un champ texte à Albert (badge + écouteurs d'événements).
 *
 * Appelée pour chaque champ trouvé par scanFields() ou détecté
 * par le MutationObserver. Ne fait rien si le champ est déjà attaché
 * ou n'est pas un champ texte valide.
 *
 * @param {HTMLElement} el - Élément DOM à attacher.
 */
Albert.attachField = function (el) {
  if (!Albert.isTextField(el)) return;
  const state = Albert.getOrCreateState(el);
  if (state.attached) return;
  state.attached = true;

  Albert.log("attachField:", el.tagName.toLowerCase(),
    { type: el.type || "", contenteditable: el.isContentEditable,
      richEditor: el.isContentEditable && Albert.isRichEditor(el) });

  Albert.trackedFields.add(el);

  /* Désactiver le correcteur natif du navigateur pour éviter les doubles soulignements */
  el.setAttribute("spellcheck", "false");

  /* Gestion IME : ne pas déclencher de vérification pendant la composition */
  el.addEventListener("compositionstart", () => {
    const st = Albert.getOrCreateState(el);
    st.isComposing = true;
  });
  el.addEventListener("compositionend", () => {
    const st = Albert.getOrCreateState(el);
    st.isComposing = false;
    Albert.scheduleCheck(el);
  });

  /* Vérification immédiate au paste (sans attendre le debounce complet) */
  el.addEventListener("paste", () => {
    setTimeout(() => {
      const st = Albert.getOrCreateState(el);
      if (st.badge) {
        Albert.updateBadgeVisibility(el, st.badge);
        Albert.positionBadge(el, st.badge);
      }
      clearTimeout(st.timer);
      clearTimeout(st.maxTimer);
      st.timer = null;
      st.maxTimer = null;
      Albert.triggerCheck(el);
    }, 50);
  });

  el.addEventListener("input", () => {
    const st = Albert.getOrCreateState(el);
    if (st.badge) {
      Albert.updateBadgeVisibility(el, st.badge);
      Albert.positionBadge(el, st.badge);
    }

    /* Si c'est une correction appliquée par Albert, ne pas tout effacer */
    if (Albert.applyingCorrection) return;

    /* Ne pas réagir pendant la composition IME (saisie CJK en cours) */
    if (st.isComposing) return;

    Albert.closePopup();

    /* Migration des offsets : ajuster les corrections existantes au lieu de tout effacer */
    const newText = Albert.getTextContent(el);
    const oldText = st.lastCheckedText || "";
    if (st.corrections && st.corrections.length > 0 && oldText) {
      st.corrections = Albert.migrateCorrections(st.corrections, oldText, newText);
      st.checkedText = newText;
      /* Ne pas toucher à st.lastCheckedText : c'est la garde de
         déduplication de triggerCheck. L'écraser ici bloquerait
         définitivement les vérifications suivantes. */
      /* Re-rendre avec les offsets migrés */
      if (st.corrections.length > 0) {
        Albert.renderCorrections(el);
      } else {
        if (st.overlay) { st.overlay.remove(); st.overlay = null; }
        if (st.badge) {
          st.badge.classList.remove("albert-has-errors");
          st.badge.classList.add("albert-no-errors");
          const img = st.badge.querySelector("img");
          if (img) img.src = Albert.ICON_URL;
        }
      }
    } else {
      if (st.overlay) { st.overlay.remove(); st.overlay = null; }
      if (st.badge) {
        st.badge.classList.remove("albert-has-errors", "albert-no-errors");
        const img = st.badge.querySelector("img");
        if (img) img.src = Albert.ICON_URL;
        st.badge.title = "Albert Correcteur";
      }
    }

    Albert.scheduleCheck(el);
  });
  el.addEventListener("focus", () => {
    const st = Albert.getOrCreateState(el);
    if (!st.focused) {
      st.focused = true;
      Albert.ensureBadge(el);
      /* Lancer la vérification immédiatement au premier focus */
      Albert.scheduleCheck(el);
    }
    if (st.badge) Albert.positionBadge(el, st.badge);
  });

  /* La géométrie de l'overlay n'est calculée qu'au rendu. Un textarea qui
     s'agrandit à la frappe (GitHub, LinkedIn) désaligne donc les
     soulignements dès la deuxième ligne : les recalculer à chaque
     changement de taille du champ. */
  if (typeof ResizeObserver === "function") {
    state.resizeObserver = new ResizeObserver(() => {
      const st = Albert.getOrCreateState(el);
      if (st.overlay) Albert.renderCorrections(el);
      if (st.badge) Albert.positionBadge(el, st.badge);
    });
    state.resizeObserver.observe(el);
  }

  /* Cas EcoleDirecte (CKEditor 5) et autres SPA : le contenteditable
     est greffé dynamiquement après le clic de l'utilisateur, ou bien
     son rect ne franchit le seuil isTextField qu'au moment du focus.
     Quand attachField est appelé par notre listener focusin de secours,
     l'événement focus natif est déjà passé sur l'élément ; le listener
     ci-dessus ne se redéclenchera qu'au prochain focus, obligeant
     l'utilisateur à cliquer ailleurs puis à revenir pour voir le badge.
     Si l'élément est déjà actif au moment où on l'attache, on simule
     manuellement le passage focus pour créer le badge immédiatement. */
  if (document.activeElement === el && !state.focused) {
    state.focused = true;
    Albert.ensureBadge(el);
    if (state.badge) Albert.positionBadge(el, state.badge);
    Albert.scheduleCheck(el);
  }
};

// ===============================================================
//  SCAN DE LA PAGE
// ===============================================================

/** Scanne la page pour trouver et attacher tous les champs texte existants. */
Albert.scanFields = function () {
  const candidates = document.querySelectorAll(FIELD_SELECTOR);
  Albert.log("scanFields:", candidates.length, "candidats trouvés",
    window.top !== window ? "(iframe " + location.href + ")" : "");
  candidates.forEach(Albert.attachField);
};

/*
 * MutationObserver avec debounce pour détecter les nouveaux champs
 * ajoutés dynamiquement (SPA, modales, AJAX) sans ralentir la page.
 * Ignore les mutations causées par les propres éléments d'Albert
 * (badge, overlay, popup) pour éviter les boucles infinies.
 */
let scanTimer = null;

/* Vrai si le nœud provient d'Albert : élément portant une classe
   "albert-", ou nœud texte inséré dans l'un de ces éléments. La
   reconstruction de l'overlay crée surtout des nœuds texte ; sans ce
   second cas, chaque frappe reprogrammait un scan complet de la page. */
function estNoeudAlbert(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return typeof node.className === "string"
      && node.className.startsWith("albert-");
  }
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    return !!(parent && parent.closest("[class^='albert-'], [class*=' albert-']"));
  }
  return false;
}

const observer = new MutationObserver((mutations) => {
  const isAlbertOnly = mutations.every((m) => {
    for (const node of m.addedNodes) {
      if (estNoeudAlbert(node)) continue;
      return false;
    }
    return m.addedNodes.length > 0;
  });
  if (isAlbertOnly) return;

  clearTimeout(scanTimer);
  scanTimer = setTimeout(Albert.scanFields, Albert.SCAN_DEBOUNCE_MS);
});

/* Re-test au focus : un champ peut devenir éligible (auto-grow, modale qui s'affiche)
   après le scan initial. On retente l'attachement à chaque focusin. */
document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (!el || Albert.trackedFields.has(el)) return;
  Albert.attachField(el);
}, true);

// ===============================================================
//  DÉMARRAGE
// ===============================================================
Albert.scanFields();
observer.observe(document.body, { childList: true, subtree: true });

/* Première vérification rapide (1s après le chargement), puis cycle régulier */
setTimeout(Albert.cycleCheckAll, 1000);
setInterval(Albert.cycleCheckAll, Albert.CYCLE_INTERVAL_MS);
