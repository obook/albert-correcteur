/*
 * albert-render-arialive.js - Accessibilité RGAA : zone ARIA live.
 *
 * Gère l'annonce vocale des résultats de correction aux lecteurs
 * d'écran (NVDA, JAWS, VoiceOver). Utilise une zone aria-live=polite
 * cachée visuellement mais lue par les technologies d'assistance.
 *
 * Contient également la fonction clearCorrections() qui supprime
 * toutes les corrections visuelles d'un champ (overlay, badge, spans).
 *
 * Conformité RGAA :
 *   - Critère 7.4 : changements de contenu annoncés via aria-live.
 *   - La zone utilise role="status" et aria-atomic="true".
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/** Référence vers l'élément DOM de la zone aria-live (singleton). */
Albert._ariaLive = null;

/**
 * Crée la zone aria-live si elle n'existe pas encore.
 *
 * L'élément est masqué visuellement (technique "sr-only") mais
 * reste lisible par les lecteurs d'écran.
 */
Albert._ensureAriaLive = function () {
  if (Albert._ariaLive && document.contains(Albert._ariaLive)) {
    return;
  }
  const el = document.createElement("div");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("role", "status");
  el.className = "albert-sr-only";
  el.style.cssText =
    "position:absolute;width:1px;height:1px;overflow:hidden;"
    + "clip:rect(0,0,0,0);white-space:nowrap;border:0;";
  document.body.appendChild(el);
  Albert._ariaLive = el;
};

/**
 * Annonce le nombre d'erreurs détectées via la zone aria-live.
 *
 * @param {number} count - Nombre d'erreurs détectées.
 * @param {string} lang  - Code langue du texte vérifié (fr, en, es, de).
 */
Albert._announceErrors = function (count, lang) {
  Albert._ensureAriaLive();
  const langLabel =
    { fr: "français", en: "anglais", es: "espagnol", de: "allemand" }[lang] || "";
  if (count === 0) {
    Albert._ariaLive.textContent =
      "Albert : aucune erreur détectée" + (langLabel ? ` (${langLabel})` : "");
  } else {
    Albert._ariaLive.textContent =
      `Albert : ${count} erreur${count > 1 ? "s" : ""}`
      + ` détectée${count > 1 ? "s" : ""}` + (langLabel ? ` (${langLabel})` : "");
  }
};

/**
 * Supprime toutes les corrections visuelles d'un champ.
 *
 * Nettoie : l'overlay, le scroll handler, les classes du badge,
 * et les spans albert-error dans les contenteditable simples.
 *
 * @param {HTMLElement} el - Champ de saisie à nettoyer.
 */
Albert.clearCorrections = function (el) {
  const state = Albert.getOrCreateState(el);
  state.corrections = [];
  if (state.overlay) {
    state.overlay.remove();
    state.overlay = null;
  }
  if (state.scrollHandler) {
    el.removeEventListener("scroll", state.scrollHandler);
    state.scrollHandler = null;
  }
  if (state.badge) {
    state.badge.classList.remove("albert-has-errors");
  }
  if (el.isContentEditable && !Albert.isRichEditor(el)) {
    el.querySelectorAll(".albert-error").forEach((mark) => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }
};

/**
 * Détache complètement un champ retiré du DOM.
 *
 * L'overlay et le badge sont insérés dans le parent positionné du champ,
 * pas dans le champ lui-même : quand une application monopage supprime le
 * champ, ils survivent et s'accumulent en artefacts visuels. Cette
 * fonction libère aussi les timers et l'observateur de redimensionnement.
 *
 * @param {HTMLElement} el - Champ retiré du document.
 */
Albert.detachField = function (el) {
  const state = Albert.fieldStates.get(el);
  if (!state) return;

  Albert.clearCorrections(el);

  if (state.badge) {
    state.badge.remove();
    state.badge = null;
  }
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
    state.resizeObserver = null;
  }
  clearTimeout(state.timer);
  state.timer = null;
  clearTimeout(state.maxTimer);
  state.maxTimer = null;
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.attached = false;
  state.focused = false;
};
