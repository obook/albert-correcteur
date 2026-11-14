/*
 * service-menus.js - Menus contextuels (Firefox).
 *
 * Ce script s'exécute dans le service worker (background script).
 * Il déclare les entrées de menu et traite les clics.
 *
 * Menus contextuels :
 *    - "Reformuler avec Albert" (contexte : champ éditable).
 *    - "Traduire avec Albert" (contexte : texte sélectionné).
 *
 * Le routage des messages reçus par le script de fond est assuré
 * par service-dispatch.js, partagé entre les cibles.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
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

/* Le navigateur n'injecte pas les content scripts dans les boutiques
   d'extensions, les pages internes et les PDF, ni (sous Brave) dans un
   onglet ouvert avant l'installation : le clic restait sans effet. */
function signalerPageInaccessible(err) {
  AlbertLog.warn("Content script injoignable :", err && err.message);
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-48.png"),
    title: "Albert Correcteur",
    message: "Albert ne peut pas agir sur cette page. "
      + "Si elle était ouverte avant l'installation, rechargez-la.",
  }).catch((e) => AlbertLog.warn("Notification impossible :", e && e.message));
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText;
  AlbertLog.log("contextMenu cliqué :", info.menuItemId,
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
    browser.storage.local.set({ lastReformulationPersona: persona.id })
      .catch((err) => AlbertLog.warn(
        "Mémorisation du persona impossible :", err && err.message));

    try {
      await browser.tabs.sendMessage(tab.id, { type: "reformulateLoading" }, sendOpts);
    } catch (err) {
      signalerPageInaccessible(err);
      return;
    }

    AlbertLog.log("checkText(reformulation) persona=" + persona.id,
      "longueur=" + text.length);
    const result = await checkText(text, "reformulation", persona.id);
    if (result.error) {
      AlbertLog.warn("checkText(reformulation) erreur :", result.error);
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
      "sendMessage reformulateResult a échoué :", err && err.message,
      "(le toast de chargement va rester affiché jusqu'à expiration)"));
    return;
  }

  if (info.menuItemId === "albert-translate") {
    browser.tabs.sendMessage(tab.id, { type: "translateGetSelection" }, sendOpts)
      .catch(signalerPageInaccessible);
  }
});
