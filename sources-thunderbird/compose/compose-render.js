// compose-render.js --- Orchestration du rendu des corrections dans le compose Thunderbird.

"use strict";

Albert.ariaLive = null;

Albert.ensureAriaLive = function () {
  if (Albert.ariaLive) return Albert.ariaLive;
  const div = document.createElement("div");
  div.setAttribute("role", "status");
  div.setAttribute("aria-live", "polite");
  div.className = "albert-aria-live";
  div.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);";
  document.body.appendChild(div);
  Albert.ariaLive = div;
  return div;
};

Albert.announce = function (message) {
  const live = Albert.ensureAriaLive();
  live.textContent = "";
  setTimeout(() => { live.textContent = message; }, 100);
};

Albert.renderCorrections = function (corrections) {
  const state = Albert.composeState;
  if (!state) return;

  state.corrections = corrections;

  if (!corrections || corrections.length === 0) {
    Albert.clearUnderlines();
    Albert.setBadgeState("ok");
    Albert.announce("Aucune erreur détectée.");
    return;
  }

  Albert.applyUnderlines(corrections);
  Albert.setBadgeState("has-errors");

  const n = corrections.length;
  const s = n > 1 ? "s" : "";
  Albert.announce(n + " erreur" + s + " détectée" + s + ".");
};
