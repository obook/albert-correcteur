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
 *    - "check"          → checkText()       (service-api.js)
 *    - "getConfig"      → loadConfig()      (service-config.js)
 *    - "getLimits"      → fetchLimits()     (service-limites.js)
 *    - "getAliases"     → fetchAliases()    (service-limites.js)
 *    - "getDailyUsage"  → fetchDailyUsage() (service-limites.js)
 *    - "translate"      → translateText()   (service-api.js)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Menus contextuels --- */

/* Parent du sous-menu de reformulation. Chaque enfant correspond à un
   persona déclaré dans util/personas.js. */
browser.contextMenus.create({
  id: "albert-reformulate",
  title: "Reformuler avec Albert",
  contexts: ["editable"],
});

for (const persona of PERSONAS) {
  browser.contextMenus.create({
    id: "albert-reformulate-" + persona.id,
    parentId: "albert-reformulate",
    title: persona.label,
    contexts: ["editable"],
  });
}

browser.contextMenus.create({
  id: "albert-translate",
  title: "Traduire avec Albert",
  contexts: ["selection"],
});

/* Préfixe d'id qui identifie un clic sur un sous-item de reformulation. */
const REFORMULATE_PREFIX = "albert-reformulate-";

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText;
  AlbertLog.log("contextMenu cliqué:", info.menuItemId,
    "frameId=" + info.frameId,
    "selectionText.length=" + (text ? text.length : 0));

  if (!text || text.trim().length < 3) {
    AlbertLog.warn("contextMenu: sélection vide ou < 3 caractères, abandon "
      + "(menu cliqué mais aucun message envoyé au content script).",
      { menuItemId: info.menuItemId, selectionText: text });
    return;
  }

  /*
   * Cible explicitement la frame du clic-droit. Sans frameId, le message
   * n'irait qu'à la frame top, ce qui rate les éditeurs en iframe
   * (CKEditor d'EcoleDirecte, Confluence, etc.).
   */
  const sendOpts = typeof info.frameId === "number" ? { frameId: info.frameId } : undefined;

  if (typeof info.menuItemId === "string"
    && info.menuItemId.startsWith(REFORMULATE_PREFIX)) {
    const personaId = info.menuItemId.slice(REFORMULATE_PREFIX.length);
    const persona = getPersonaById(personaId);
    /* Mémoriser le dernier persona utilisé pour pré-cocher l'UI plus tard. */
    browser.storage.local.set({ lastReformulationPersona: persona.id });

    browser.tabs.sendMessage(tab.id, { type: "reformulateLoading" }, sendOpts)
      .catch((err) => AlbertLog.error("sendMessage reformulateLoading a échoué:",
        err && err.message, "(content script absent ou frame non autorisée ?)"));

    AlbertLog.log("checkText(reformulation) persona=" + persona.id,
      "longueur=" + text.length);
    const result = await checkText(text, "reformulation", persona.id);
    if (result.error) {
      AlbertLog.warn("checkText(reformulation) erreur:", result.error);
    } else {
      AlbertLog.log("checkText(reformulation) OK,",
        (result.corrections || []).length, "suggestions");
    }
    browser.tabs.sendMessage(tab.id, {
      type: "reformulateResult",
      originalText: text,
      personaLabel: persona.label,
      result,
    }, sendOpts).catch((err) => AlbertLog.error(
      "sendMessage reformulateResult a échoué:", err && err.message,
      "(le toast de chargement va rester affiché jusqu'à expiration)"));
    return;
  }

  if (info.menuItemId === "albert-translate") {
    browser.tabs.sendMessage(tab.id, { type: "translateGetSelection" }, sendOpts)
      .catch((err) => AlbertLog.error("sendMessage translateGetSelection a échoué:",
        err && err.message));
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
  if (message.type === "getAliases") {
    fetchAliases().then(sendResponse);
    return true;
  }
  if (message.type === "getDailyUsage") {
    fetchDailyUsage(message.model).then(sendResponse);
    return true;
  }
  if (message.type === "translate") {
    translateText(message.text, message.targetLang).then(sendResponse);
    return true;
  }
});
