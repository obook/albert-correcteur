// albert-popup.js — Popup de suggestion (affichage et fermeture).

"use strict";

// Affiche le popup de suggestion sous le mot erroné.
Albert.showPopup = function (el, correction, markEl) {
  Albert.closePopup();

  const popup = document.createElement("div");
  popup.className = "albert-popup";

  // Message d'explication
  const msg = document.createElement("div");
  msg.className = "albert-popup-message";
  msg.textContent = correction.message || "Erreur détectée";
  popup.appendChild(msg);

  // Boutons de suggestion
  const sugBox = document.createElement("div");
  sugBox.className = "albert-popup-suggestions";

  (correction.suggestions || []).forEach((sug) => {
    const btn = document.createElement("button");
    btn.className = "albert-popup-suggestion";
    btn.textContent = sug;
    btn.addEventListener("click", () => {
      Albert.applySuggestion(el, correction, sug);
      Albert.closePopup();
    });
    sugBox.appendChild(btn);
  });

  // Bouton ignorer
  const dismiss = document.createElement("button");
  dismiss.className = "albert-popup-dismiss";
  dismiss.textContent = "Ignorer";
  dismiss.addEventListener("click", () => Albert.closePopup());
  sugBox.appendChild(dismiss);

  popup.appendChild(sugBox);
  document.body.appendChild(popup);

  // Positionner juste sous le mot erroné (position: fixed)
  const markRect = markEl.getBoundingClientRect();
  popup.style.top = (markRect.bottom + 4) + "px";
  popup.style.left = markRect.left + "px";

  // Ajuster si le popup dépasse de la fenêtre
  requestAnimationFrame(() => {
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth - 10) {
      popup.style.left = (window.innerWidth - popupRect.width - 10) + "px";
    }
    if (popupRect.bottom > window.innerHeight - 10) {
      popup.style.top = (markRect.top - popupRect.height - 4) + "px";
    }
  });

  Albert.activePopup = popup;
};

// Ferme le popup actif.
Albert.closePopup = function () {
  if (Albert.activePopup) {
    Albert.activePopup.remove();
    Albert.activePopup = null;
  }
};

// Fermer le popup si on clique ailleurs
document.addEventListener("click", (e) => {
  if (Albert.activePopup && !Albert.activePopup.contains(e.target) && !e.target.classList.contains("albert-error")) {
    Albert.closePopup();
  }
});
