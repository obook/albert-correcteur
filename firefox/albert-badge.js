// albert-badge.js — Gestion du badge (icône Albert dans le coin du champ).

"use strict";

// Crée ou récupère le badge pour un champ de saisie.
Albert.ensureBadge = function (el) {
  const state = Albert.getOrCreateState(el);
  if (state.badge && document.contains(state.badge)) return state.badge;

  const badge = document.createElement("div");
  badge.className = "albert-badge";
  badge.title = "Albert Correcteur — Cliquez pour vérifier";

  const img = document.createElement("img");
  img.src = Albert.ICON_URL;
  img.alt = "Albert";
  badge.appendChild(img);

  const parent = el.offsetParent || document.body;
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.appendChild(badge);
  Albert.positionBadge(el, badge);

  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    Albert.triggerCheck(el);
  });

  state.badge = badge;
  return badge;
};

// Positionne le badge dans le coin inférieur droit du champ.
Albert.positionBadge = function (el, badge) {
  const rect = el.getBoundingClientRect();
  const parentRect = (el.offsetParent || document.body).getBoundingClientRect();
  const cs = getComputedStyle(el);
  const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
  const borderRight = parseFloat(cs.borderRightWidth) || 0;
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const paddingBottom = parseFloat(cs.paddingBottom) || 0;
  badge.style.top = (rect.bottom - parentRect.top - borderBottom - paddingBottom - 22) + "px";
  badge.style.left = (rect.right - parentRect.left - borderRight - paddingRight - 22) + "px";
};
