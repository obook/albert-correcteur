/*
 * popup-base.js - Thème commun des popups injectées.
 *
 * Chaque cible avait sa version de getPopupThemeClass, et celle de
 * Thunderbird ignorait le thème "automatique" : la popup restait
 * sombre sous un système clair.
 *
 * Albert.popupTheme reste chargé par chaque cible : les content
 * scripts Firefox et les compose scripts Thunderbird n'ont pas le même
 * point d'entrée.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

window.Albert = window.Albert || {};

/**
 * Renvoie la classe de thème à poser sur une popup.
 *
 * @returns {string} "albert-theme-light" en thème clair, chaîne vide
 *                   en thème sombre (le style par défaut).
 */
Albert.getPopupThemeClass = function () {
  const theme = Albert.popupTheme || "dark";
  if (theme === "light") return "albert-theme-light";
  if (theme === "dark") return "";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "albert-theme-light"
    : "";
};
