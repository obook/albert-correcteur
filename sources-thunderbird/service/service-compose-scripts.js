/*
 * service-compose-scripts.js - Injection des scripts dans le compose Thunderbird.
 *
 * Thunderbird ne supporte pas les content_scripts pour les fenêtres
 * de composition (compose). Ce module contourne cette limitation en
 * injectant manuellement les scripts et feuilles de style via
 * browser.tabs.executeScript() et browser.tabs.insertCSS().
 *
 * L'injection est déclenchée :
 *   - À la création d'un nouvel onglet de type "messageCompose".
 *   - Au démarrage de l'extension, pour les onglets déjà ouverts.
 *
 * L'ordre d'injection des scripts est important : compose-state.js
 * (objet global) doit être chargé en premier, et compose-main.js
 * (point d'entrée) en dernier.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

const COMPOSE_JS = [
  "compose/compose-state.js",
  "compose/compose-utils.js",
  "compose/compose-badge.js",
  "compose/compose-overlay.js",
  "compose/compose-render.js",
  "compose/compose-popup-utils.js",
  "compose/compose-popup-correction.js",
  "compose/compose-popup-reformulation.js",
  "compose/compose-popup-traduction.js",
  "compose/compose-popup-messages.js",
  "compose/compose-apply.js",
  "compose/compose-toast.js",
  "verification/rolling-window.js",
  "compose/compose-limites.js",
  "compose/compose-debounce.js",
  "compose/compose-check.js",
  "compose/compose-main.js",
];

const COMPOSE_CSS = [
  "css/badge.css",
  "css/overlay.css",
  "css/popup-dark.css",
  "css/popup-light.css",
  "css/toast.css",
];

const injectedTabs = new Set();

async function injectComposeScripts(tabId) {
  if (injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);

  console.log("[Albert] Injection des scripts dans le compose tab", tabId);

  try {
    for (const file of COMPOSE_CSS) {
      await browser.tabs.insertCSS(tabId, { file });
    }
    for (const file of COMPOSE_JS) {
      try {
        await browser.tabs.executeScript(tabId, { file });
      } catch (e) {
        /* executeScript retourne la dernière expression du script ;
         * si c'est une fonction (non sérialisable), ignorer l'erreur. */
        if (!e.message.includes("non-structured-clonable")) throw e;
      }
    }
    console.log("[Albert] Scripts injectés avec succès dans tab", tabId);
  } catch (err) {
    console.error("[Albert] Erreur injection compose scripts :", err);
    injectedTabs.delete(tabId);
  }
}

/* Injection dans les nouveaux onglets de composition */
browser.tabs.onCreated.addListener((tab) => {
  if (tab.type === "messageCompose") {
    /* Attendre que l'éditeur soit prêt */
    setTimeout(() => injectComposeScripts(tab.id), 500);
  }
});

/* Nettoyage quand un onglet est fermé */
browser.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

/* Injection dans les onglets de composition déjà ouverts */
(async () => {
  const tabs = await browser.tabs.query({ type: "messageCompose" });
  for (const tab of tabs) {
    await injectComposeScripts(tab.id);
  }
})();
