/*
 * compose-render.js - Orchestration du rendu des corrections (Thunderbird).
 *
 * Coordonne l'affichage des corrections dans la fenêtre de composition :
 * 1. Stocke les corrections dans composeState.
 * 2. Délègue l'insertion des soulignements à compose-overlay.js.
 * 3. Met à jour le badge (état ok / has-errors).
 * 4. Annonce le résultat aux lecteurs d'écran via aria-live.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : EUPL-1.2
 */

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
