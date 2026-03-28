// albert-toast.js — Toast de notification (en haut à droite).

"use strict";

// Affiche un toast en haut à droite de la fenêtre.
Albert.showToast = function (message, durationSec) {
  // Supprimer un toast existant
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

  // Animation d'entrée
  requestAnimationFrame(() => toast.classList.add("albert-toast-visible"));

  // Disparition automatique
  const ms = (durationSec || 10) * 1000;
  setTimeout(() => {
    if (document.contains(toast)) {
      toast.classList.remove("albert-toast-visible");
      setTimeout(() => toast.remove(), 300);
    }
  }, ms);
};
