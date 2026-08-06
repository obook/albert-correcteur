/*
 * compose-badge.js - Badge Albert dans le compose Thunderbird.
 *
 * Crée et gère le badge (icône flottante) dans le corps du message.
 * Le badge indique l'état de la vérification :
 *   - has-errors : des corrections sont disponibles (icône rouge).
 *   - ok         : aucune erreur (icône normale).
 *   - loading    : vérification en cours (icône normale).
 *   - error      : erreur API (icône rouge).
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.badge = null;

Albert.createBadge = function () {
  if (Albert.badge) return Albert.badge;

  const badge = document.createElement("div");
  badge.className = "albert-badge albert-has-errors";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Albert Correcteur : cliquez pour vérifier");
  badge.setAttribute("tabindex", "0");
  badge.title = "Albert Correcteur";
  /* Le badge est désormais hors du corps du message, donc hors de portée
   * de l'éditeur. La mention reste par précaution : designMode porte sur
   * le document entier, et l'éditeur de Gecko entoure d'un cadre et de
   * poignées tout élément positionné qu'il juge modifiable. */
  badge.contentEditable = "false";

  /* L'icône est une image de fond posée par css/badge.css, qui la fait
   * varier selon l'état. Une balise <img> dont la source pointait sur
   * moz-extension:// restait vide dans la fenêtre de composition, et
   * Thunderbird n'affichait que le cadre de l'image manquante. Une
   * feuille de style injectée par l'extension, elle, atteint ses propres
   * ressources sans difficulté. */

  /* Empêcher l'éditeur de déplacer le curseur sur le badge au clic :
   * la sélection y déclencherait à nouveau les décorations de Gecko, et
   * le curseur doit rester là où l'utilisateur écrivait. */
  badge.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  badge.addEventListener("click", () => {
    Albert.triggerManualCheck();
  });
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      Albert.triggerManualCheck();
    }
  });

  Albert.uiRoot().appendChild(badge);
  Albert.badge = badge;
  return badge;
};

Albert.setBadgeState = function (state) {
  Albert.badgeState = state || null;
  const badge = Albert.badge;
  if (!badge) return;
  badge.className = "albert-badge";
  if (state) badge.classList.add("albert-" + state);
};

Albert.removeBadge = function () {
  if (Albert.badge) {
    Albert.badge.remove();
    Albert.badge = null;
  }
};

/* Filet de sécurité. Le badge n'est plus dans le corps du message, donc
 * une sélection totale suivie d'une suppression ne l'emporte plus, mais
 * rien ne garantit que son conteneur survive à tout : rechargement du
 * document par Thunderbird, intervention d'une autre extension. Le badge
 * disparaissait alors jusqu'à la frappe suivante, seul chemin qui le
 * reconstruisait. L'observation porte sur tout le document. */
Albert.watchBadge = function () {
  const observateur = new MutationObserver(() => {
    if (Albert.badge && document.contains(Albert.badge)) return;
    const etat = Albert.badgeState;
    Albert.removeBadge();
    Albert.createBadge();
    Albert.setBadgeState(etat);
  });
  observateur.observe(document.documentElement, { childList: true, subtree: true });
};
