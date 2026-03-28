// compose-utils.js --- Utilitaires pour la fenêtre de composition Thunderbird.

"use strict";

Albert.getComposeBody = function () {
  return document.body;
};

Albert.getBodyText = function () {
  const body = Albert.getComposeBody();
  return body ? body.innerText : "";
};

Albert.filterIgnoredCorrections = function (corrections) {
  if (!corrections || !corrections.length) return corrections;
  return corrections.filter(
    (c) => !Albert.ignoredWords.has(c.word.toLowerCase())
  );
};

Albert.getPopupThemeClass = function () {
  return Albert.popupTheme === "light" ? "albert-theme-light" : "";
};

Albert.escapeHtml = function (str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

Albert.findRealOffset = function (text, word, apiOffset) {
  const idx = text.indexOf(word, Math.max(0, apiOffset - 10));
  if (idx !== -1) return idx;
  return text.indexOf(word);
};
