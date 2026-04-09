/*
 * service-menus.js - Menus contextuels et dispatch des messages (Thunderbird).
 *
 * Ce script s'exécute dans le service worker (background script).
 * Il gère deux responsabilités :
 *
 * 1. Menus contextuels (browser.menus) :
 *    - "Reformuler avec Albert" (contexte : compose_body).
 *    - "Traduire avec Albert" (contexte : compose_body + selection).
 *      Dans le compose → envoie au compose script.
 *      En lecture de mail → ouvre une fenêtre popup de traduction.
 *
 * 2. Dispatch des messages du compose script :
 *    Route les requêtes vers les fonctions du service worker :
 *    - "check"     → checkText()      (service-api.js)
 *    - "getConfig" → loadConfig()     (service-config.js)
 *    - "getLimits" → fetchLimits()    (service-limites.js)
 *    - "translate" → translateText()  (service-api.js)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Menus contextuels --- */

browser.menus.create({
  id: "albert-reformulate",
  title: "Reformuler avec Albert",
  contexts: ["compose_body"],
});

browser.menus.create({
  id: "albert-translate",
  title: "Traduire avec Albert",
  contexts: ["compose_body", "selection"],
});

browser.menus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText;
  if (!text || text.trim().length < 3) return;

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
    /* Déterminer si on est dans un compose ou dans un affichage de message */
    const tabInfo = await browser.tabs.get(tab.id);
    if (tabInfo.type === "messageCompose") {
      /* Dans le compose : envoyer au compose script */
      browser.tabs.sendMessage(tab.id, { type: "translateGetSelection" });
    } else {
      /* Dans la lecture de mail : ouvrir une fenêtre popup de traduction */
      const encodedText = encodeURIComponent(text);
      browser.windows.create({
        url: "message/message-traduction.html?text=" + encodedText,
        type: "popup",
        width: 480,
        height: 320,
      });
    }
  }
});

/* --- Dispatch des messages du compose script --- */

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
