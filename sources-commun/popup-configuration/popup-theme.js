/*
 * popup-theme.js - Applique le thème (sombre/clair/auto) aux pages
 * popup.html (configuration) et popup-settings.html (paramètres).
 *
 * Lit la préférence "popupTheme" dans browser.storage.local et pose
 * l'attribut data-theme sur <html>. Le mode "auto" suit la préférence
 * système (prefers-color-scheme). Réagit aux changements en direct.
 *
 * Auteur : O. Booklage
 * Date : Mai 2026
 * Licence : MIT
 */

"use strict";

function resolvePopupTheme(theme) {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme === "light" ? "light" : "dark";
}

function applyPopupTheme(theme) {
  document.documentElement.setAttribute("data-theme", resolvePopupTheme(theme));
}

browser.storage.local.get("popupTheme").then((result) => {
  applyPopupTheme(result.popupTheme || "dark");
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.popupTheme) {
    applyPopupTheme(changes.popupTheme.newValue || "dark");
  }
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async () => {
  const result = await browser.storage.local.get("popupTheme");
  if (result.popupTheme === "auto") {
    applyPopupTheme("auto");
  }
});
