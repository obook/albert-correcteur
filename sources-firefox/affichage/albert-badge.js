/* albert-badge.js - Gestion du badge (icone Albert dans le coin du champ). */

"use strict";

/* Cree ou recupere le badge pour un champ de saisie. */
Albert.ensureBadge = function (el) {
  const state = Albert.getOrCreateState(el);
  if (state.badge && document.contains(state.badge)) {
    Albert.updateBadgeVisibility(el, state.badge);
    return state.badge;
  }

  const badge = document.createElement("div");
  badge.className = "albert-badge";
  badge.title = "Albert Correcteur - Cliquez pour verifier";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Albert Correcteur - Cliquez pour verifier");
  badge.setAttribute("tabindex", "0");

  const img = document.createElement("img");
  img.src = Albert.ICON_URL;
  img.alt = "Albert";
  img.setAttribute("aria-hidden", "true");
  badge.appendChild(img);

  const parent = el.offsetParent || document.body;
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.appendChild(badge);
  Albert.positionBadge(el, badge);
  Albert.updateBadgeVisibility(el, badge);

  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    Albert.triggerCheck(el);
  });
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      Albert.triggerCheck(el);
    }
  });

  state.badge = badge;
  return badge;
};

/* Affiche ou masque le badge selon que le champ est vide ou non. */
Albert.updateBadgeVisibility = function (el, badge) {
  const text = Albert.getTextContent(el);
  badge.style.display = text.trim().length > 0 ? "flex" : "none";
};

/* Positionne le badge dans le coin inferieur droit du champ. */
Albert.positionBadge = function (el, badge) {
  const rect = el.getBoundingClientRect();
  const parentRect = (el.offsetParent || document.body).getBoundingClientRect();
  const cs = getComputedStyle(el);
  const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
  const borderRight = parseFloat(cs.borderRightWidth) || 0;
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const paddingBottom = parseFloat(cs.paddingBottom) || 0;
  badge.style.top =
    (rect.bottom - parentRect.top - borderBottom - paddingBottom - 16) + "px";
  badge.style.left =
    (rect.right - parentRect.left - borderRight - paddingRight - 16) + "px";
};
