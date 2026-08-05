/*
 * albert-render.js - Orchestration du rendu des corrections.
 *
 * Point central de l'affichage des corrections. Ce module :
 * 1. Choisit la méthode de rendu selon le type de champ :
 *    - Overlay transparent (textarea, input, contenteditable riche).
 *    - Spans cliquables dans le DOM (contenteditable simple).
 * 2. Met à jour le badge (icône, titre, compteur d'erreurs).
 * 3. Annonce les erreurs aux lecteurs d'écran via ARIA live.
 *
 * Dépendances :
 *   - albert-render-overlay.js  (renderOverlay)
 *   - albert-render-arialive.js (_announceErrors)
 *   - albert-badge.js           (mise à jour des classes du badge)
 *   - albert-state.js           (ICON_URL, ICON_ERROR_URL)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/**
 * Affiche les corrections sur un champ (orchestrateur principal).
 *
 * Délègue le rendu visuel à renderOverlay, met à jour le badge
 * (icône, compteur, titre) et annonce le résultat via ARIA live.
 *
 * @param {HTMLElement} el - Champ de saisie à décorer.
 */
Albert.renderCorrections = function (el) {
  const state = Albert.getOrCreateState(el);
  const tag = el.tagName.toLowerCase();

  if (tag === "textarea" || tag === "input" || el.isContentEditable) {
    Albert.renderOverlay(el, state);
  }

  /* Greffe paresseuse du badge : si un cycle de vérification a abouti
     sans que le champ ait jamais reçu d'événement focus dans notre
     listener (autofocus HTML, focus programmatique d'un éditeur riche
     déclenché avant l'installation des listeners, champ pré-rempli
     jamais cliqué), le badge n'existe pas encore. Idem si le badge a
     été détaché du DOM entre-temps (conteneur reconstruit, modale
     fermée puis rouverte). On le (re)crée ici afin que l'utilisateur
     voie l'icône dès que des corrections sont prêtes. */
  if ((!state.badge || !document.contains(state.badge))
    && Albert.isTextField(el)) {
    state.badge = null;
    Albert.ensureBadge(el);
  }

  if (state.badge) {
    const hasErrors = state.corrections.length > 0;
    const langLabel = { fr: "FR", en: "EN", es: "ES", de: "DE" }[state.lang] || "";
    const langSuffix = langLabel ? ` [${langLabel}]` : "";
    state.badge.classList.toggle("albert-has-errors", hasErrors);
    state.badge.classList.toggle("albert-no-errors", !hasErrors);
    const img = state.badge.querySelector("img");
    if (img) {
      img.src = hasErrors ? Albert.ICON_ERROR_URL : Albert.ICON_OK_URL;
    }
    const title = hasErrors
      ? `${state.corrections.length} erreur${state.corrections.length > 1 ? "s" : ""}`
        + ` trouvée${state.corrections.length > 1 ? "s" : ""}${langSuffix}`
      : `Albert Correcteur - Aucune erreur${langSuffix}`;
    state.badge.title = title;
    state.badge.setAttribute("aria-label", title);
  }

  /* Annoncer aux lecteurs d'écran (RGAA) */
  Albert._announceErrors(state.corrections.length, state.lang);
};

/**
 * Rendu pour les contenteditable simples (pas d'éditeur riche).
 *
 * Entoure les mots erronés de <span> cliquables directement dans le
 * DOM du champ. Chaque span reçoit la classe albert-error et un
 * data-idx pour retrouver la correction au clic.
 *
 * Cette méthode n'est PAS utilisée pour les éditeurs riches : ceux-ci
 * ne tolèrent pas la modification directe du DOM (voir renderOverlay).
 *
 * @param {HTMLElement} el    - Élément contenteditable.
 * @param {Object}      state - État du champ (corrections, etc.).
 */
Albert.renderContentEditable = function (el, state) {
  el.querySelectorAll(".albert-error").forEach((mark) => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });

  if (state.corrections.length === 0) {
    return;
  }

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  let globalOffset = 0;
  const nodeRanges = textNodes.map((n) => {
    const start = globalOffset;
    globalOffset += n.textContent.length;
    return { node: n, start, end: globalOffset };
  });

  const sorted = state.corrections
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => b.offset - a.offset);

  for (const c of sorted) {
    const cEnd = c.offset + c.length;
    const nr = nodeRanges.find((r) => c.offset >= r.start && c.offset < r.end);
    if (!nr || cEnd > nr.end) continue;

    const localStart = c.offset - nr.start;
    const localEnd = cEnd - nr.start;
    const range = document.createRange();
    range.setStart(nr.node, localStart);
    range.setEnd(nr.node, localEnd);

    const mark = document.createElement("span");
    mark.className = `albert-error albert-error-${c.type || "grammar"}`;
    mark.dataset.idx = c.idx;
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.showPopup(el, state.corrections[c.idx], mark);
    });

    range.surroundContents(mark);
  }
};
