/*
 * service-menus.js - Menus contextuels (Thunderbird).
 *
 * Ce script s'exécute dans le service worker (background script).
 * Il déclare les entrées de menu et traite les clics.
 *
 * Menus contextuels (browser.menus) :
 *    - "Reformuler avec Albert" (contexte : compose_body).
 *    - "Traduire avec Albert" (contexte : compose_body + selection).
 *      Dans le compose → envoie au compose script.
 *      En lecture de mail → envoie au script d'affichage.
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

browser.menus.create({
  id: "albert-reformulate",
  title: "Reformuler avec Albert",
  contexts: ["compose_body"],
});

for (const persona of PERSONAS) {
  browser.menus.create({
    id: "albert-reformulate-" + persona.id,
    parentId: "albert-reformulate",
    title: persona.label,
    contexts: ["compose_body"],
  });
}

browser.menus.create({
  id: "albert-translate",
  title: "Traduire avec Albert",
  contexts: ["compose_body", "selection"],
});

const REFORMULATE_PREFIX = "albert-reformulate-";

browser.menus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText;
  if (!text || text.trim().length < 3) return;

  if (typeof info.menuItemId === "string"
    && info.menuItemId.startsWith(REFORMULATE_PREFIX)) {
    const personaId = info.menuItemId.slice(REFORMULATE_PREFIX.length);
    const persona = getPersonaById(personaId);
    browser.storage.local.set({ lastReformulationPersona: persona.id })
      .catch((err) => AlbertLog.warn(
        "Mémorisation du persona impossible :", err && err.message));
    /* Sans .catch(), l'échec de l'envoi (compose script non injecté,
       fenêtre fermée entre-temps) devient un rejet silencieux : le
       résultat de la reformulation est calculé puis perdu sans trace. */
    browser.tabs.sendMessage(tab.id, { type: "reformulateLoading" })
      .catch((err) => AlbertLog.error("sendMessage reformulateLoading a échoué :",
        err && err.message));
    const result = await checkText(text, "reformulation", persona.id);
    browser.tabs.sendMessage(tab.id, {
      type: "reformulateResult",
      originalText: text,
      personaLabel: persona.label,
      result,
    }).catch((err) => AlbertLog.error("sendMessage reformulateResult a échoué :",
      err && err.message, "- le toast de chargement va rester affiché."));
    return;
  }

  if (info.menuItemId === "albert-translate") {
    /* Déterminer si on est dans un compose ou dans un affichage de message */
    const tabInfo = await browser.tabs.get(tab.id);
    if (tabInfo.type === "messageCompose") {
      /* Dans le compose : envoyer au compose script. La sélection est
         transmise car Thunderbird la réduit parfois à néant en fermant
         le menu contextuel, avant que le script ne puisse la relire. */
      browser.tabs.sendMessage(tab.id, {
        type: "translateGetSelection",
        selectionText: text,
      }).catch((err) => AlbertLog.error("sendMessage translateGetSelection a échoué :",
        err && err.message));
    } else {
      /* En lecture : mettre les scripts en place dans le message, puis
         demander la popup, la même que dans le compose. */
      if (!await injecterScriptsMessage(tab.id)) return;
      browser.tabs.sendMessage(tab.id, {
        type: "translateSelection",
        selectionText: text,
      }).catch((err) => AlbertLog.error("sendMessage translateSelection a échoué :",
        err && err.message));
    }
  }
});
