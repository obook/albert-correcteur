/*
 * service-message-scripts.js - Injection des scripts dans un message lu.
 *
 * Pendant longtemps, "Traduire avec Albert" en lecture de message
 * ouvrait une fenêtre séparée, faute de pouvoir afficher quoi que ce
 * soit dans le message. Il en résultait une boîte différente de celle
 * de la rédaction et de celle de Firefox : décoration du système,
 * poignée de déplacement et croix en double, positionnement imposé.
 *
 * Deux chemins d'injection, qui ne font pas le même travail :
 *
 *   - register() couvre les messages ouverts ensuite. Il vaut pour son
 *     avance : l'écouteur du clic droit est en place avant le clic, et
 *     la popup peut s'ouvrir au point cliqué plutôt qu'au centre.
 *   - injecterScriptsMessage() rattrape tout le reste au moment du
 *     clic. Un enregistrement ne vaut que pour les messages ouverts
 *     après lui, alors qu'un onglet de lecture garde le même
 *     identifiant en changeant de message : sans ce rattrapage, rien ne
 *     s'affichait dès qu'on lisait un message déjà ouvert.
 *
 * Un drapeau posé sur le document évite de tout réinjecter à chaque
 * clic, ce qui doublerait les écouteurs. Il disparaît avec le document
 * quand un autre message est affiché.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

const MESSAGE_JS = [
  "util/ui-root.js",
  "util/lang-names.js",
  "util/popup-base.js",
  "util/popup-focus.js",
  "popup-contenu/popup-layout.js",
  "notification/toast.js",
  "popup-contenu/popup-traduction.js",
  "message/message-affichage.js",
];

const MESSAGE_CSS = [
  "css/popup-dark.css",
  "css/popup-light.css",
  "css/toast.css",
];

/**
 * Met les scripts de traduction en place dans le message affiché.
 *
 * @param {number} tabId - Onglet de lecture visé.
 * @returns {Promise<boolean>} Vrai si le message peut recevoir la popup.
 */
/* Onglets dont l'injection est en cours. Deux clics rapprochés sur le
   menu lisaient tous deux un drapeau encore absent et injectaient tout
   deux fois, écouteurs doublés. */
const injectionsEnCours = new Map();

async function injecterScriptsMessage(tabId) {
  if (injectionsEnCours.has(tabId)) return injectionsEnCours.get(tabId);

  const injection = (async () => {
    try {
      const [dejaPret] = await browser.tabs.executeScript(tabId, {
        code: "!!window.albertTraductionPrete",
      });
      if (dejaPret) return true;

      for (const file of MESSAGE_CSS) {
        await browser.tabs.insertCSS(tabId, { file });
      }
      for (const file of MESSAGE_JS) {
        try {
          await browser.tabs.executeScript(tabId, { file });
        } catch (e) {
          /* executeScript renvoie la dernière expression du script ; si
           * c'est une fonction, elle n'est pas sérialisable. Le libellé
           * de cette erreur n'a jamais été relu depuis avril : en cas de
           * doute, prévenir plutôt qu'avaler. */
          if (!e.message.includes("non-structured-clonable")) throw e;
          AlbertLog.warn("Retour non sérialisable ignoré pour", file);
        }
      }
      AlbertLog.log("Scripts de traduction injectés dans le message", tabId);
      return true;
    } catch (err) {
      AlbertLog.error("Injection dans le message impossible :",
        err && err.message);
      return false;
    } finally {
      injectionsEnCours.delete(tabId);
    }
  })();

  injectionsEnCours.set(tabId, injection);
  return injection;
}

browser.messageDisplayScripts.register({
  css: MESSAGE_CSS.map((file) => ({ file })),
  js: MESSAGE_JS.map((file) => ({ file })),
}).then(
  () => AlbertLog.log("Scripts d'affichage de message enregistrés"),
  (err) => AlbertLog.error(
    "Enregistrement des scripts d'affichage impossible :", err && err.message),
);
