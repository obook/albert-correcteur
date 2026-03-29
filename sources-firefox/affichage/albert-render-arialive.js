/* albert-render-arialive.js - Accessibilite : zone aria-live et nettoyage.
   Annonce le nombre d'erreurs aux lecteurs d'ecran (RGAA). */

"use strict";

Albert._ariaLive = null;

Albert._ensureAriaLive = function () {
  if (Albert._ariaLive && document.contains(Albert._ariaLive)) return;
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

Albert._announceErrors = function (count, lang) {
  Albert._ensureAriaLive();
  const langLabel =
    { fr: "francais", en: "anglais", es: "espagnol", de: "allemand" }[lang] || "";
  if (count === 0) {
    Albert._ariaLive.textContent =
      "Albert : aucune erreur detectee" + (langLabel ? ` (${langLabel})` : "");
  } else {
    Albert._ariaLive.textContent =
      `Albert : ${count} erreur${count > 1 ? "s" : ""}`
      + ` detectee${count > 1 ? "s" : ""}` + (langLabel ? ` (${langLabel})` : "");
  }
};

/* Supprime toutes les corrections visuelles d'un champ. */
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
