/*
 * compose-limites.js - Limites API et debounce adaptatif (Thunderbird).
 *
 * Gère le suivi des limites côté client dans la fenêtre de composition :
 *   - checkRateLimit()  : vérifie qu'on n'atteint pas 80 % du rpm.
 *   - recordRequest()   : enregistre une requête dans la fenêtre glissante.
 *   - loadLimits()      : charge les limites depuis le service worker
 *     et ajuste les délais de debounce en fonction du rpm.
 *
 * Le compteur rpm utilise Albert.RollingWindow (partagé avec Firefox via
 * sources-commun/verification/rolling-window.js) pour calculer précisément
 * le temps avant le prochain slot disponible.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.requestWindow = new Albert.RollingWindow(60000);

Albert.checkRateLimit = function () {
  const limits = Albert.limits;
  if (!limits) return true;

  const rpm = limits.rpm;
  if (rpm && Albert.requestWindow.total() >= rpm * 0.8) {
    return false;
  }

  return true;
};

Albert.recordRequest = function () {
  Albert.requestWindow.add();
};

Albert.loadLimits = async function () {
  const limits = await browser.runtime.sendMessage({ type: "getLimits" });
  Albert.limits = limits;

  if (limits && limits.rpm) {
    const interval = Math.ceil(60000 / (limits.rpm * 0.4));
    Albert.DEBOUNCE_SHORT = Math.max(1500, interval);
    Albert.DEBOUNCE_MAX = Albert.DEBOUNCE_SHORT * 2.5;
    Albert.log("loadLimits : rpm=", limits.rpm, "→ DEBOUNCE_SHORT=", Albert.DEBOUNCE_SHORT, "ms, DEBOUNCE_MAX=", Albert.DEBOUNCE_MAX, "ms");
  } else {
    Albert.log("loadLimits : pas de limites retournées par le service worker (défauts conservés)");
  }
};
