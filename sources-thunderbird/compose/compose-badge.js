// compose-badge.js --- Badge Albert dans la fenêtre de composition Thunderbird.

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

  badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">'
    + '<circle cx="24" cy="24" r="20" fill="#1a73e8" opacity="0.9"/>'
    + '<text x="24" y="31" text-anchor="middle" fill="white" font-size="22" font-weight="bold">A</text>'
    + '</svg>';

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
