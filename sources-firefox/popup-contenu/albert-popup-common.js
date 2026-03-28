// albert-popup-common.js — Fonctions partagées par toutes les popups.
// Thème, drag, fermeture, positionnement, sauvegarde de sélection.

"use strict";

// --- Thème ---

Albert.getPopupThemeClass = function () {
  const theme = Albert.popupTheme || "dark";
  if (theme === "dark") return "";
  if (theme === "light") return "albert-theme-light";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "albert-theme-light" : "";
};

Albert.loadPopupTheme = async function () {
  const result = await browser.storage.local.get("popupTheme");
  Albert.popupTheme = result.popupTheme || "dark";
};
Albert.loadPopupTheme();

browser.storage.onChanged.addListener((changes) => {
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
});

// --- Fermeture ---

Albert.popupPosition = null;

Albert.closePopup = function () {
  if (Albert.activePopup) {
    Albert.activePopup.remove();
    Albert.activePopup = null;
    Albert.activePopupIdx = -1;
    Albert.popupPosition = null;
  }
  if (Albert._previousFocus && Albert._previousFocus.focus) {
    Albert._previousFocus.focus();
    Albert._previousFocus = null;
  }
};

// --- Focus trap (accessibilite RGAA) ---

Albert._previousFocus = null;

Albert.trapFocus = function (popup) {
  Albert._previousFocus = document.activeElement;
  const focusables = popup.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  first.focus();
  popup._focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const current = popup.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const f = current[0];
    const l = current[current.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === f) {
        e.preventDefault();
        l.focus();
      }
    } else {
      if (document.activeElement === l) {
        e.preventDefault();
        f.focus();
      }
    }
  };
  popup.addEventListener("keydown", popup._focusTrapHandler);
};

// --- Fermeture par Échap ou clic en dehors ---

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && Albert.activePopup) {
    Albert.closePopup();
  }
});

document.addEventListener("mousedown", (e) => {
  if (Albert.activePopup && !Albert.activePopup.contains(e.target)) {
    Albert.closePopup();
  }
});

// --- Drag (déplacement de la popup via la poignée) ---

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

  // Stocker les références pour pouvoir les retirer à la fermeture du popup
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

  // Nettoyage automatique quand le popup est retiré du DOM
  const observer = new MutationObserver(() => {
    if (!popup.isConnected) {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      observer.disconnect();
    }
  });
  observer.observe(popup.parentNode || document.body, { childList: true });
};

// --- Positionnement près du clic droit ---

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

// --- Création du header standard (icône + poignée + fermer) ---

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

// --- Sauvegarde de la sélection avant le menu contextuel ---

Albert.savedSelection = null;

document.addEventListener("contextmenu", (e) => {
  const activeEl = document.activeElement;
  const sel = window.getSelection();
  const clickPos = { x: e.clientX, y: e.clientY };

  if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")) {
    Albert.savedSelection = {
      type: "input",
      el: activeEl,
      start: activeEl.selectionStart,
      end: activeEl.selectionEnd,
      text: activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd),
      clickPos,
    };
  } else if (sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    Albert.savedSelection = {
      type: "range",
      range: range.cloneRange(),
      text: sel.toString(),
      clickPos,
    };
  } else {
    Albert.savedSelection = null;
  }
});
