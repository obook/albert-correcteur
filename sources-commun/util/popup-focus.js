/*
 * popup-focus.js - Piège de focus des popups (accessibilité RGAA).
 *
 * Une popup modale doit retenir le focus clavier : la tabulation ne
 * doit pas en sortir tant qu'elle est ouverte, et le focus doit revenir
 * à l'élément d'origine à la fermeture. Sans cela, un utilisateur au
 * clavier ou au lecteur d'écran se retrouve à parcourir la page
 * derrière la popup, sans repère.
 *
 * Le même code sert aux popups des pages web (Firefox, Chromium) et à
 * celles de la fenêtre de composition de Thunderbird.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

/* Éléments susceptibles de recevoir le focus à l'intérieur d'une popup. */
const SELECTEUR_FOCUSABLES =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* Élément qui avait le focus avant l'ouverture de la popup. */
Albert._previousFocus = null;

/**
 * Enferme le focus clavier dans une popup et y place le focus initial.
 *
 * La liste des éléments focusables est recalculée à chaque tabulation :
 * le contenu d'une popup change en cours de vie (boutons de suggestion
 * ajoutés après la réponse de l'API), et une liste figée à l'ouverture
 * laisserait le focus s'échapper.
 *
 * @param {HTMLElement} popup - Popup à rendre modale au clavier.
 * @param {{focusInitial?: boolean}} [options] - focusInitial à false
 *   laisse le focus dans le champ : certains champs disparaissent dès
 *   qu'ils le perdent (appréciations du bulletin de Pronote).
 */
Albert.trapFocus = function (popup, { focusInitial = true } = {}) {
  if (!Albert._previousFocus) {
    const precedent = document.activeElement;
    Albert._previousFocus =
      (precedent && precedent !== document.body) ? precedent : null;
  }

  const focusables = popup.querySelectorAll(SELECTEUR_FOCUSABLES);
  if (focusables.length === 0) return;
  if (focusInitial) {
    focusables[0].focus();
  }

  popup._focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const courants = popup.querySelectorAll(SELECTEUR_FOCUSABLES);
    if (courants.length === 0) return;
    const premier = courants[0];
    const dernier = courants[courants.length - 1];
    /* Sous shadow DOM, document.activeElement vaut le conteneur hôte :
       c'est la racine de la popup qui sait qui a le focus. */
    const actif = popup.getRootNode().activeElement || document.activeElement;
    if (e.shiftKey) {
      if (actif === premier) {
        e.preventDefault();
        dernier.focus();
      }
    } else if (actif === dernier) {
      e.preventDefault();
      premier.focus();
    }
  };
  popup.addEventListener("keydown", popup._focusTrapHandler);
};

/**
 * Rend le focus à l'élément qui l'avait avant l'ouverture de la popup.
 */
Albert.restoreFocus = function () {
  if (Albert._previousFocus && Albert._previousFocus.focus) {
    Albert._previousFocus.focus();
    Albert._previousFocus = null;
  }
};
