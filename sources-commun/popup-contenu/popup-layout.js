/*
 * popup-layout.js - Mise en page des popups (drag, position, header).
 *
 * Fonctions utilitaires de présentation :
 *   - initPopupDrag   : déplacement de la popup via la poignée (⠿).
 *   - positionPopupAtClick : positionnement près du clic droit
 *     (pour les popups de reformulation et traduction).
 *   - createPopupHeader : création du header standard (icône Albert,
 *     poignée de déplacement, bouton fermer).
 *
 * Nettoyage automatique : les écouteurs mousemove/mouseup sont retirés
 * via MutationObserver quand la popup est supprimée du DOM.
 *
 * Fichier propre à Firefox jusqu'en août 2026, passé en commun pour
 * que la popup de traduction de Thunderbird ait le même bandeau, le
 * même positionnement et le même déplacement à la souris.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

window.Albert = window.Albert || {};

/* --- Drag (déplacement de la popup via la poignée) --- */

/**
 * Ramène une coordonnée dans les limites de la fenêtre.
 *
 * Une popup plus grande que la fenêtre est collée au bord haut ou
 * gauche : la repousser vers l'autre bord cacherait son bandeau, donc
 * la poignée qui sert à la ramener.
 *
 * @param {number} valeur        - Coordonnée voulue, en pixels.
 * @param {number} taillePopup   - Largeur ou hauteur de la popup.
 * @param {number} tailleFenetre - Largeur ou hauteur de la fenêtre.
 * @returns {number} Coordonnée retenue.
 */
Albert.bornerDansFenetre = function (valeur, taillePopup, tailleFenetre) {
  const maximum = Math.max(0, tailleFenetre - taillePopup);
  return Math.min(Math.max(valeur, 0), maximum);
};

Albert.initPopupDrag = function (popup, handle) {
  /* Document de la popup et non du script : une popup ouverte depuis
     une iframe d'éditeur vit dans le cadre parent. */
  const doc = popup.ownerDocument;
  const vue = doc.defaultView;
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
    /* La popup centrée porte un translateX(-50%) posé par
       positionPopupAtClick. La position écrite ensuite subirait encore
       cette translation, et la popup sautait d'une demi-largeur au
       moment où on l'attrape. */
    popup.style.transform = "none";
    popup.style.left = origLeft + "px";
    popup.style.top = origTop + "px";
    handle.style.cursor = "grabbing";
  });

  /* Stocker les références pour pouvoir les retirer à la fermeture du popup */
  const onMouseMove = (e) => {
    if (!isDragging) return;
    const rect = popup.getBoundingClientRect();
    popup.style.left = Albert.bornerDansFenetre(
      origLeft + e.clientX - startX, rect.width, vue.innerWidth) + "px";
    popup.style.top = Albert.bornerDansFenetre(
      origTop + e.clientY - startY, rect.height, vue.innerHeight) + "px";
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
    }
  };

  doc.addEventListener("mousemove", onMouseMove);
  doc.addEventListener("mouseup", onMouseUp);

  /* Nettoyage automatique quand le popup est retiré du DOM */
  const observer = new MutationObserver(() => {
    if (!popup.isConnected) {
      doc.removeEventListener("mousemove", onMouseMove);
      doc.removeEventListener("mouseup", onMouseUp);
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
        /* Remontée au-dessus du clic, bornée : sur un clic haut dans la
           fenêtre, une popup longue passait au-dessus du bord. */
        popup.style.top = Albert.bornerDansFenetre(
          saved.clickPos.y - popupRect.height - 4,
          popupRect.height, window.innerHeight) + "px";
      }
    });
  } else {
    popup.style.top = "20%";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
  }
};

/* --- Création du header standard (icône + poignée + fermer) --- */

/**
 * Construit le bandeau standard d'une popup.
 *
 * @param {HTMLElement} popup   - Popup à coiffer.
 * @param {Function} [onClose]  - Fermeture appelée par le bouton ✕.
 *                                Par défaut Albert.closePopup, qui
 *                                n'existe que côté Firefox.
 * @returns {{header: HTMLElement, headerLeft: HTMLElement,
 *            headerRight: HTMLElement, handle: HTMLElement}}
 */
Albert.createPopupHeader = function (popup, onClose) {
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "albert-popup-header-left";

  /* Image de fond posée par popup-dark.css et non balise <img> : une
     source en moz-extension:// reste vide dans la fenêtre de
     composition de Thunderbird, qui n'affiche que le cadre de l'image
     manquante (même contrainte que le badge). */
  const icon = document.createElement("span");
  icon.className = "albert-popup-icon";
  icon.setAttribute("aria-hidden", "true");
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
  closeBtn.addEventListener("click", () => {
    if (onClose) onClose();
    else Albert.closePopup();
  });
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  popup.appendChild(header);

  return { header, headerLeft, headerRight, handle };
};
