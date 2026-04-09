/*
 * compose-toast.js - Notifications toast dans le compose Thunderbird.
 *
 * Affiche des messages temporaires dans le corps du message de
 * composition. Même principe que albert-toast.js (Firefox) avec
 * une animation d'entrée/sortie CSS et un bouton de fermeture.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

"use strict";

Albert.showToast = function (message, durationMs) {
  /* Supprimer un toast existant */
  const existing = document.querySelector(".albert-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "albert-toast";
  toast.setAttribute("role", "alert");

  const msg = document.createElement("span");
  msg.className = "albert-toast-message";
  msg.textContent = message;
  toast.appendChild(msg);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-toast-close";
  closeBtn.textContent = "\u2715";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", () => {
    toast.classList.remove("albert-toast-visible");
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);

  /* Animation d'entrée */
  requestAnimationFrame(() => toast.classList.add("albert-toast-visible"));

  /* Disparition automatique */
  const ms = durationMs || 10000;
  setTimeout(() => {
    if (document.contains(toast)) {
      toast.classList.remove("albert-toast-visible");
      setTimeout(() => toast.remove(), 300);
    }
  }, ms);
};
