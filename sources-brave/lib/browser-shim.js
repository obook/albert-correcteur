/*
 * browser-shim.js - Pont minimal browser.* -> chrome.* pour Brave / Chromium.
 *
 * Le code commun et les content scripts utilisent partout l'API "browser.*"
 * (standard WebExtensions, à base de promesses), que Chromium n'expose pas sous
 * ce nom. Plutôt que d'embarquer une bibliothèque tierce (webextension-polyfill),
 * on se contente d'aliaser "browser" sur "chrome" : sous Manifest V3, toutes les
 * API employées par l'extension (storage.local.get/set, runtime.sendMessage,
 * tabs.sendMessage, runtime.getURL, les addListener et contextMenus.create)
 * renvoient déjà nativement des promesses. Aucune dépendance externe n'est donc
 * nécessaire.
 *
 * Ce fichier doit être chargé en premier, aussi bien dans le service worker que
 * dans les content scripts.
 */

globalThis.browser = globalThis.browser || chrome;
