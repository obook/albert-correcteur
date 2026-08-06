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
 * ponytail: browser.composeScripts.register() ferait le même travail
 * sans guet ni délai, mais l'essai s'est soldé par une extension
 * silencieuse et n'a pas pu être diagnostiqué à distance. À reprendre
 * avec un Thunderbird sous la main.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

const COMPOSE_JS = [
  "compose/compose-state.js",
  "compose/compose-utils.js",
  "util/ui-root.js",
  "util/inner-text.js",
  "util/lang-names.js",
  "notification/toast.js",
  "compose/compose-badge.js",
  "compose/compose-overlay.js",
  "compose/compose-render.js",
  "util/popup-focus.js",
  "compose/compose-popup-utils.js",
  "compose/compose-popup-correction.js",
  "compose/compose-popup-reformulation.js",
  "compose/compose-popup-traduction.js",
  "compose/compose-popup-messages.js",
  "compose/compose-apply.js",
  "verification/rolling-window.js",
  "compose/compose-limites.js",
  "compose/compose-debounce.js",
  "compose/compose-check.js",
  "compose/compose-main.js",
];

const COMPOSE_CSS = [
  "css/badge-base.css",
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

  AlbertLog.log("Injection des scripts dans l'onglet de composition", tabId);

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
    AlbertLog.log("Scripts injectés dans l'onglet", tabId);
  } catch (err) {
    AlbertLog.error("Injection des compose scripts impossible :", err);
    injectedTabs.delete(tabId);
  }
}

/* Injection dans les nouveaux onglets de composition.
 *
 * Le document de composition est prêt quand son chargement est terminé.
 * Un simple délai fixe ne suffisait pas : sur une réponse à un courriel
 * volumineux (fil de discussion, images intégrées, plusieurs niveaux de
 * citation), Thunderbird met plus longtemps à monter l'éditeur, si bien
 * que l'injection tombait sur un corps encore vide. La vérification
 * initiale du texte déjà présent était alors sautée, et l'utilisateur
 * devait taper un caractère pour déclencher la première analyse.
 *
 * injectedTabs empêche la double injection, onUpdated pouvant se
 * déclencher plusieurs fois pour un même onglet. */
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.type !== "messageCompose") return;
  if (changeInfo.status !== "complete") return;
  injectComposeScripts(tabId);
});

/* Repli pour les versions de Thunderbird qui ne signalent pas la fin de
   chargement d'un onglet de composition : injecter après un délai, sans
   effet si onUpdated a déjà fait le travail. */
browser.tabs.onCreated.addListener((tab) => {
  if (tab.type === "messageCompose") {
    setTimeout(() => injectComposeScripts(tab.id), 1500);
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
