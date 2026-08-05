/*
 * compose-badge.js - Badge Albert dans le compose Thunderbird.
 *
 * Crée et gère le badge (icône flottante) dans le corps du message.
 * Le badge indique l'état de la vérification :
 *   - has-errors : des corrections sont disponibles (icône rouge).
 *   - ok         : aucune erreur (icône normale).
 *   - loading    : vérification en cours (icône normale).
 *   - error      : erreur API (icône rouge).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.badge = null;

Albert.createBadge = function () {
  if (Albert.badge) return Albert.badge;

  const badge = document.createElement("div");
  badge.className = "albert-badge albert-has-errors";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Albert Correcteur - cliquer pour vérifier");
  badge.setAttribute("tabindex", "0");
  badge.title = "Albert Correcteur";

  /* Utiliser la vraie icône du projet (identique à Firefox) */
  const img = document.createElement("img");
  img.src = browser.runtime.getURL("icons/icon-error.svg");
  /* alt vide : l'image est décorative (aria-label porté par le parent,
   * aria-hidden sur l'image). Un alt non vide fuit dans le courriel
   * envoyé : si le nettoyage onBeforeSend échoue ou n'est pas exécuté,
   * Thunderbird sérialise l'image avec son alt et le destinataire voit
   * « Albert » en fin de message. */
  img.alt = "";
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
  Albert.badgeState = state || null;
  const badge = Albert.badge;
  if (!badge) return;
  badge.className = "albert-badge";
  if (state) badge.classList.add("albert-" + state);
  const img = badge.querySelector("img");
  if (img) {
    let iconFile;
    if (state === "ok") iconFile = "icons/icon-ok.svg";
    else if (state === "loading") iconFile = "icons/icon.svg";
    else iconFile = "icons/icon-error.svg";
    img.src = browser.runtime.getURL(iconFile);
  }
};

Albert.removeBadge = function () {
  if (Albert.badge) {
    Albert.badge.remove();
    Albert.badge = null;
  }
};
