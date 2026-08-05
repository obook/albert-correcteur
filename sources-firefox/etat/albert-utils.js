/*
 * albert-utils.js - Accès au contenu des champs, état et dictionnaire personnel.
 *
 * Fonctions transversales conservées dans ce fichier après le découpage :
 *
 *   - getTextContent(el)    : extrait le texte brut d'un champ (input,
 *                             textarea, contenteditable).
 *   - getOrCreateState(el)  : renvoie ou crée l'objet d'état attaché à
 *                             un champ (WeakMap Albert.fieldStates).
 *   - sleep(ms)             : pause asynchrone.
 *   - Dictionnaire personnel : loadIgnoredWords, saveIgnoredWords,
 *                             ignoreWord.
 *
 * Les fonctions plus volumineuses ont été déplacées :
 *   - Détection des champs        -> albert-fields.js
 *   - Découpage en paragraphes    -> albert-paragraphes.js
 *   - Migration / recalibrage     -> albert-offsets.js
 *
 * Dépendances :
 *   - albert-state.js (objet global Albert)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

// ===============================================================
//  ACCÈS AU CONTENU ET À L'ÉTAT
// ===============================================================

/**
 * Récupère le texte d'un champ, peu importe son type.
 *
 * @param {HTMLElement} el - Champ de saisie.
 * @returns {string} Texte saisi.
 */
Albert.getTextContent = function (el) {
  if (el.value !== undefined) return el.value;
  return el.innerText || el.textContent || "";
};

/**
 * Récupère ou crée l'état associé à un champ.
 *
 * Chaque champ texte possède un objet d'état stocké dans une WeakMap.
 * L'état contient : timers de debounce, corrections en cours, overlay,
 * badge, texte vérifié, etc.
 *
 * @param {HTMLElement} el - Champ de saisie.
 * @returns {Object} État du champ (créé si inexistant).
 */
Albert.getOrCreateState = function (el) {
  if (!Albert.fieldStates.has(el)) {
    Albert.fieldStates.set(el, {
      timer: null, corrections: [], overlay: null, badge: null,
      attached: false, focused: false, lastCheckedText: "",
      checkedText: "", scrollHandler: null,
    });
  }
  return Albert.fieldStates.get(el);
};

/**
 * Pause asynchrone.
 *
 * @param {number} ms - Durée en millisecondes.
 * @returns {Promise<void>} Promesse résolue après le délai.
 */
Albert.sleep = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ===============================================================
//  DICTIONNAIRE PERSONNEL (MOTS IGNORÉS)
// ===============================================================

Albert.loadIgnoredWords = async function () {
  const result = await browser.storage.local.get("ignoredWords");
  Albert.ignoredWords = new Set(result.ignoredWords || []);
};

Albert.saveIgnoredWords = async function () {
  await browser.storage.local.set({ ignoredWords: [...Albert.ignoredWords] });
};

Albert.ignoreWord = async function (word) {
  Albert.ignoredWords.add(word.toLowerCase());
  await Albert.saveIgnoredWords();
};

/* Charger le dictionnaire au démarrage. Note : l'appel n'est pas await,
   il y a donc une fenêtre courte (< quelques ms) pendant laquelle
   Albert.ignoredWords est encore le Set vide initialisé par
   albert-state.js. Aucun filterIgnoredCorrections ne peut courir
   pendant cette fenêtre car la première vérification ne se lance
   qu'après un focus ou une frappe utilisateur. */
Albert.loadIgnoredWords();
