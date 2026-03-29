/* compose-badge.js --- Badge Albert dans la fenêtre de composition Thunderbird. */

"use strict";

Albert.badge = null;

Albert.createBadge = function () {
  if (Albert.badge) return Albert.badge;

  const badge = document.createElement("div");
  badge.className = "albert-badge";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Albert Correcteur - cliquer pour vérifier");
  badge.setAttribute("tabindex", "0");
  badge.title = "Albert Correcteur";

  /* Utiliser la vraie icône du projet (identique à Firefox) */
  const img = document.createElement("img");
  img.src = browser.runtime.getURL("icons/icon-48.png");
  img.alt = "Albert";
  img.setAttribute("aria-hidden", "true");
  badge.appendChild(img);

  badge.addEventListener("click", () => {
    Albert.triggerManualCheck();
  });
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      Albert.triggerManualCheck();
    }
  });

  document.body.appendChild(badge);
  Albert.badge = badge;
  return badge;
};

Albert.setBadgeState = function (state) {
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
