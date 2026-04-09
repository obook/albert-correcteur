/*
 * service-menus.js - Menus contextuels et dispatch des messages (Firefox).
 *
 * Ce script s'exécute dans le service worker (background script).
 * Il gère deux responsabilités :
 *
 * 1. Menus contextuels :
 *    - "Reformuler avec Albert" (contexte : champ éditable).
 *    - "Traduire avec Albert" (contexte : texte sélectionné).
 *
 * 2. Dispatch des messages du content script :
 *    Écoute browser.runtime.onMessage et route les requêtes vers
 *    les fonctions du service worker :
 *    - "check"      → checkText()      (service-api.js)
 *    - "getConfig"  → loadConfig()     (service-config.js)
 *    - "getLimits"  → fetchLimits()    (service-limites.js)
 *    - "translate"  → translateText()  (service-api.js)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Menus contextuels --- */

browser.contextMenus.create({
  id: "albert-reformulate",
  title: "Reformuler avec Albert",
  contexts: ["editable"],
});

browser.contextMenus.create({
  id: "albert-translate",
  title: "Traduire avec Albert",
  contexts: ["selection"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText;
  if (!text || text.trim().length < 3) {
    return;
  }

  if (info.menuItemId === "albert-reformulate") {
    browser.tabs.sendMessage(tab.id, { type: "reformulateLoading" });
    const result = await checkText(text, "reformulation");
    browser.tabs.sendMessage(tab.id, {
      type: "reformulateResult",
      originalText: text,
      result,
    });
  }

  if (info.menuItemId === "albert-translate") {
    browser.tabs.sendMessage(tab.id, { type: "translateGetSelection" });
  }
});

/* --- Dispatch des messages du content script --- */

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check") {
    checkText(message.text, message.mode).then(sendResponse);
    return true;
  }
  if (message.type === "getConfig") {
    loadConfig().then(sendResponse);
    return true;
  }
  if (message.type === "getLimits") {
    fetchLimits().then(sendResponse);
    return true;
  }
  if (message.type === "translate") {
    translateText(message.text, message.targetLang).then(sendResponse);
    return true;
  }
});
