// service-menus.js --- Menus contextuels Thunderbird et dispatch des messages.

"use strict";

// --- Menus contextuels ---

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
    const result = await checkText(text, "reformulation");
    browser.tabs.sendMessage(tab.id, {
      type: "reformulateResult",
      originalText: text,
      result,
    });
  }

  if (info.menuItemId === "albert-translate") {
    // Déterminer si on est dans un compose ou dans un affichage de message
    const tabInfo = await browser.tabs.get(tab.id);
    if (tabInfo.type === "messageCompose") {
      // Dans le compose : envoyer au compose script
      browser.tabs.sendMessage(tab.id, { type: "translateGetSelection" });
    } else {
      // Dans la lecture de mail : injecter le script de traduction et les CSS
      const cssFiles = [
        "css/popup-dark.css",
        "css/popup-light.css",
        "css/toast.css",
      ];
      for (const file of cssFiles) {
        try { await browser.tabs.insertCSS(tab.id, { file }); } catch (e) { /* déjà injecté */ }
      }
      try {
        await browser.tabs.executeScript(tab.id, { file: "message/message-traduction.js" });
      } catch (e) {
        if (!e.message.includes("non-structured-clonable")) {
          console.error("[Albert] Erreur injection traduction lecture :", e);
        }
      }
      // Envoyer la sélection et lancer la traduction
      browser.tabs.sendMessage(tab.id, {
        type: "translateInMessage",
        text: text,
      });
    }
  }
});

// --- Dispatch des messages du compose script ---

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
