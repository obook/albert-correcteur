/*
 * toast.js - Notifications temporaires, partagées entre les cibles.
 *
 * Affiche un message temporaire en haut à droite : erreur d'API, limite
 * de débit atteinte, confirmation d'une action. Un seul toast est
 * visible à la fois, l'ancien est retiré avant d'afficher le nouveau.
 *
 * Le même code sert dans les pages web (Firefox, Brave) et dans la
 * fenêtre de composition de Thunderbird. Seule l'icône diffère : elle
 * n'est ajoutée que si Albert.ICON_URL est défini, ce qui est le cas
 * des content scripts mais pas des compose scripts.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

/* Durée d'affichage par défaut, en millisecondes. */
const TOAST_DUREE_DEFAUT_MS = 10000;

/* Durée de l'animation de sortie, en millisecondes. Doit rester alignée
   sur la transition définie dans css/toast.css. */
const TOAST_SORTIE_MS = 300;

/**
 * Retire un toast avec son animation de sortie.
 *
 * @param {HTMLElement} toast - Élément à retirer.
 */
function fermerToast(toast) {
  toast.classList.remove("albert-toast-visible");
  setTimeout(() => toast.remove(), TOAST_SORTIE_MS);
}

/**
 * Affiche un toast en haut à droite de la fenêtre.
 *
 * @param {string} message    - Texte à afficher.
 * @param {number} [durationMs] - Durée d'affichage en millisecondes
 *                                (défaut : 10000). L'unité est la même
 *                                sur toutes les cibles, pour qu'un
 *                                portage de code ne produise pas un
 *                                toast invisible ou interminable.
 */
Albert.showToast = function (message, durationMs) {
  const existant = document.querySelector(".albert-toast");
  if (existant) existant.remove();

  const toast = document.createElement("div");
  toast.className = "albert-toast";
  /* role="alert" fait annoncer le message par les lecteurs d'écran. */
  toast.setAttribute("role", "alert");

  if (Albert.ICON_URL) {
    const icone = document.createElement("img");
    icone.src = Albert.ICON_URL;
    icone.alt = "Albert";
    icone.className = "albert-toast-icon";
    toast.appendChild(icone);
  }

  const texte = document.createElement("span");
  texte.className = "albert-toast-message";
  texte.textContent = message;
  toast.appendChild(texte);

  const boutonFermer = document.createElement("button");
  boutonFermer.className = "albert-toast-close";
  boutonFermer.textContent = "✕";
  boutonFermer.setAttribute("aria-label", "Fermer");
  boutonFermer.addEventListener("click", () => fermerToast(toast));
  toast.appendChild(boutonFermer);

  Albert.uiRoot().appendChild(toast);

  /* Animation d'entrée : la classe est posée au cadre suivant pour que
     la transition CSS parte bien de l'état initial. */
  requestAnimationFrame(() => toast.classList.add("albert-toast-visible"));

  setTimeout(() => {
    if (document.contains(toast)) fermerToast(toast);
  }, durationMs || TOAST_DUREE_DEFAUT_MS);
};
