/*
 * service-dispatch.js - Routage des messages reçus par le script de fond.
 *
 * Les content scripts (Firefox, Brave) et les compose scripts
 * (Thunderbird) n'accèdent ni au réseau ni à la configuration : ils
 * passent par ce point d'entrée unique, identique sur les trois cibles.
 *
 * Messages acceptés :
 *   - "check"     -> checkText()      (service-api.js)
 *   - "translate" -> translateText()  (service-api.js)
 *   - "getLimits" -> fetchLimits()    (service-limites.js)
 *
 * Chaque branche renvoie true pour garder le canal ouvert le temps de
 * la promesse : sans ce retour, sendResponse serait appelé après la
 * fermeture du canal et la réponse serait perdue.
 *
 * Les menus contextuels restent propres à chaque cible et vivent dans
 * les service-menus.js respectifs, leurs API différant (contextMenus
 * côté navigateur, menus côté Thunderbird).
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "check") {
    checkText(message.text, message.mode).then(sendResponse);
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
  /* Copie depuis le script de fond : dans le compose Thunderbird, le
     document injecté ne peut pas écrire dans le presse-papiers, ni par
     navigator.clipboard ni par execCommand. Le fond en a le droit avec
     la permission clipboardWrite. Sans elle (Firefox, Brave), l'appel
     échoue et le script appelant reçoit ok: false. */
  if (message.type === "copyToClipboard") {
    const clipboard = navigator.clipboard;
    if (!clipboard || !clipboard.writeText) {
      sendResponse({ ok: false });
      return;
    }
    clipboard.writeText(message.text)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  }
});
