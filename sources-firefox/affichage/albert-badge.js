/*
 * albert-badge.js - Gestion du badge Albert (icône dans le coin du champ).
 *
 * Le badge est un petit bouton flottant positionné dans le coin
 * inférieur droit de chaque champ texte. Il indique visuellement
 * l'état de la correction :
 *   - Icône normale       : aucune erreur détectée.
 *   - Icône erreur (rouge) : des corrections sont disponibles.
 *   - Deux points tournants : vérification en cours (albert-loading),
 *                           le logo est masqué pendant ce temps.
 *   - Encart ambre fixe   : panne API persistante (albert-api-error).
 *                           Le tooltip indique la cause et invite
 *                           à cliquer pour réessayer.
 *   - Grisé               : limite de débit atteinte (rate-limited).
 *   - Masqué              : le champ est vide.
 *
 * Le badge est cliquable (et accessible au clavier) pour déclencher
 * une vérification manuelle immédiate. En état de panne, le clic
 * force une nouvelle requête (ignore le cache du dernier texte vérifié).
 *
 * Dépendances :
 *   - albert-state.js  (ICON_URL, ICON_ERROR_URL, getOrCreateState)
 *   - albert-utils.js  (getTextContent)
 *   - albert-check.js  (triggerCheck)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/**
 * Crée ou récupère le badge pour un champ de saisie.
 *
 * Si le badge existe déjà et est toujours dans le DOM, met à jour
 * sa visibilité. Sinon, crée un nouveau badge, le positionne et
 * l'insère dans le parent positionné du champ.
 *
 * @param {HTMLElement} el - Champ de saisie cible.
 * @returns {HTMLElement} Élément DOM du badge.
 */
Albert.ensureBadge = function (el) {
  const state = Albert.getOrCreateState(el);
  if (state.badge && document.contains(state.badge)) {
    Albert.updateBadgeVisibility(el, state.badge);
    return state.badge;
  }

  const badge = document.createElement("div");
  badge.className = "albert-badge albert-has-errors";
  badge.title = "Albert Correcteur : cliquez pour vérifier";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Albert Correcteur : cliquez pour vérifier");
  badge.setAttribute("tabindex", "0");

  const img = document.createElement("img");
  img.src = Albert.ICON_ERROR_URL;
  img.alt = "Albert";
  img.setAttribute("aria-hidden", "true");
  badge.appendChild(img);

  const parent = Albert.positionedParent(el);
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.appendChild(badge);
  Albert.positionBadge(el, badge);
  Albert.updateBadgeVisibility(el, badge);

  /*
   * Diagnostic : si le parent a overflow:hidden ou size 0, le badge sera
   * invisible - on prévient l'utilisateur via la console.
   */
  const pcs = getComputedStyle(parent);
  if (pcs.overflow === "hidden" || pcs.overflowX === "hidden" || pcs.overflowY === "hidden") {
    Albert.warn("ensureBadge: le parent positionné a overflow:hidden, "
      + "le badge peut être masqué", { parent, el });
  }
  Albert.log("ensureBadge: badge créé pour",
    el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""),
    { parent: parent.tagName.toLowerCase() });

  /* Toute interaction utilisateur sur le badge force la re-vérification,
     même si le texte est identique au dernier check : c'est le sens du
     bouton ("Cliquez pour vérifier"). Sans force=true, le cache
     state.lastCheckedText fait court-circuiter triggerCheck quand le
     badge est vert (albert-no-errors) ou rouge (albert-has-errors). */
  const handleActivate = () => {
    Albert.triggerCheck(el, true);
  };
  /* Même raison que pour l'overlay : garder le focus dans le champ, un
     champ qui s'agrandit au focus se replierait au clic sur le badge. */
  badge.addEventListener("mousedown", (e) => e.preventDefault());
  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleActivate();
  });
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleActivate();
    }
  });

  state.badge = badge;
  return badge;
};

/**
 * Affiche ou masque le badge selon que le champ contient du texte.
 *
 * @param {HTMLElement} el    - Champ de saisie.
 * @param {HTMLElement} badge - Élément DOM du badge.
 */
Albert.updateBadgeVisibility = function (el, badge) {
  const text = Albert.getTextContent(el);
  badge.style.display = text.trim().length > 0 ? "flex" : "none";
};

/**
 * Positionne le badge dans le coin inférieur droit du champ.
 *
 * Utilise getBoundingClientRect() pour un positionnement précis
 * relatif au parent positionné (offsetParent).
 *
 * @param {HTMLElement} el    - Champ de saisie.
 * @param {HTMLElement} badge - Élément DOM du badge.
 */
Albert.positionBadge = function (el, badge) {
  const rect = el.getBoundingClientRect();
  const parentRect = Albert.positionedParent(el).getBoundingClientRect();
  const cs = getComputedStyle(el);
  const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
  const borderRight = parseFloat(cs.borderRightWidth) || 0;
  const paddingRight = parseFloat(cs.paddingRight) || 0;
  const paddingBottom = parseFloat(cs.paddingBottom) || 0;
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
  /* Largeur d'un ascenseur vertical classique. Vaut 0 pour un ascenseur
     en surimpression (Firefox Linux) : la marge fixe ci-dessous sert à
     ne pas le recouvrir quand il apparaît (x.com). */
  const scrollbarW = Math.max(0, el.offsetWidth - el.clientWidth - borderLeft - borderRight);
  const marge = 10;
  badge.style.top =
    (rect.bottom - parentRect.top - borderBottom - paddingBottom - 16) + "px";
  badge.style.left =
    (rect.right - parentRect.left - borderRight - scrollbarW - paddingRight - marge - 16) + "px";
};
