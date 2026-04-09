/*
 * albert-toast.js - Notifications toast (coin supérieur droit).
 *
 * Affiche des messages temporaires à l'utilisateur : erreurs API,
 * limites de débit atteintes, confirmation de reformulation, etc.
 * Le toast apparaît avec une animation CSS et disparaît
 * automatiquement après la durée indiquée.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

"use strict";

/**
 * Affiche un toast en haut à droite de la fenêtre.
 *
 * Un seul toast est visible à la fois : l'ancien est supprimé
 * avant d'afficher le nouveau. Le toast comporte une icône Albert,
 * le message et un bouton de fermeture.
 *
 * @param {string} message     - Texte à afficher.
 * @param {number} durationSec - Durée d'affichage en secondes (défaut : 10).
 */
Albert.showToast = function (message, durationSec) {
  /* Supprimer un toast existant */
  const existing = document.querySelector(".albert-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "albert-toast";

  const icon = document.createElement("img");
  icon.src = Albert.ICON_URL;
  icon.alt = "Albert";
  icon.className = "albert-toast-icon";
  toast.appendChild(icon);

  const msg = document.createElement("span");
  msg.className = "albert-toast-message";
  msg.textContent = message;
  toast.appendChild(msg);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-toast-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => {
    toast.classList.remove("albert-toast-visible");
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);

  /* Animation d'entrée */
  requestAnimationFrame(() => toast.classList.add("albert-toast-visible"));

  /* Disparition automatique */
  const ms = (durationSec || 10) * 1000;
  setTimeout(() => {
    if (document.contains(toast)) {
      toast.classList.remove("albert-toast-visible");
      setTimeout(() => toast.remove(), 300);
    }
  }, ms);
};
