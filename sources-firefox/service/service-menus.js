/* service-menus.js - Menus contextuels et dispatch des messages. */

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
