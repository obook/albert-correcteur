/*
 * albert-popup-layout.js - Mise en page des popups (drag, position, header).
 *
 * Fonctions utilitaires de présentation extraites de
 * albert-popup-common.js pour alléger ce dernier :
 *   - initPopupDrag   : déplacement de la popup via la poignée (⠿).
 *   - positionPopupAtClick : positionnement près du clic droit
 *     (pour les popups de reformulation et traduction).
 *   - createPopupHeader : création du header standard (icône Albert,
 *     poignée de déplacement, bouton fermer).
 *
 * Nettoyage automatique : les écouteurs mousemove/mouseup sont retirés
 * via MutationObserver quand la popup est supprimée du DOM.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Drag (déplacement de la popup via la poignée) --- */

Albert.initPopupDrag = function (popup, handle) {
  let isDragging = false;
  let startX, startY, origLeft, origTop;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = popup.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    handle.style.cursor = "grabbing";
  });

  /* Stocker les références pour pouvoir les retirer à la fermeture du popup */
  const onMouseMove = (e) => {
    if (!isDragging) return;
    popup.style.left = (origLeft + e.clientX - startX) + "px";
    popup.style.top = (origTop + e.clientY - startY) + "px";
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  /* Nettoyage automatique quand le popup est retiré du DOM */
  const observer = new MutationObserver(() => {
    if (!popup.isConnected) {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      observer.disconnect();
    }
  });
  observer.observe(popup.parentNode || document.body, { childList: true });
};

/* --- Positionnement près du clic droit --- */

Albert.positionPopupAtClick = function (popup) {
  const saved = Albert.savedSelection;
  if (saved && saved.clickPos) {
    popup.style.top = (saved.clickPos.y + 4) + "px";
    popup.style.left = saved.clickPos.x + "px";
    requestAnimationFrame(() => {
      const popupRect = popup.getBoundingClientRect();
      if (popupRect.right > window.innerWidth - 10) {
        popup.style.left = (window.innerWidth - popupRect.width - 10) + "px";
      }
      if (popupRect.bottom > window.innerHeight - 10) {
        popup.style.top = (saved.clickPos.y - popupRect.height - 4) + "px";
      }
    });
  } else {
    popup.style.top = "20%";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
  }
};

/* --- Création du header standard (icône + poignée + fermer) --- */

Albert.createPopupHeader = function (popup) {
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "albert-popup-header-left";

  const icon = document.createElement("img");
  icon.src = Albert.ICON_URL;
  icon.alt = "Albert";
  icon.className = "albert-popup-icon";
  headerLeft.appendChild(icon);

  header.appendChild(headerLeft);

  const headerRight = document.createElement("div");
  headerRight.className = "albert-popup-header-right";

  const handle = document.createElement("div");
  handle.className = "albert-popup-handle";
  handle.textContent = "⠿";
  handle.title = "Déplacer";
  handle.setAttribute("aria-hidden", "true");
  headerRight.appendChild(handle);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", () => Albert.closePopup());
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  popup.appendChild(header);

  return { header, headerLeft, headerRight, handle };
};
