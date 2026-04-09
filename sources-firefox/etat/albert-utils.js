/*
 * albert-utils.js - Fonctions utilitaires du content script.
 *
 * Regroupe les fonctions transversales utilisées par les autres
 * modules Firefox : détection des champs texte et des éditeurs
 * riches, gestion de l'état par champ, migration des offsets après
 * frappe, recalibrage des offsets LLM, et dictionnaire personnel.
 *
 * Dépendances :
 *   - albert-state.js  (objet global Albert, constantes)
 *
 * Utilisé par :
 *   - albert-main.js   (isTextField, getOrCreateState, attachField)
 *   - albert-check.js  (splitParagraphs, findModifiedParagraph,
 *                        recalibrateOffsets, filterIgnoredCorrections)
 *   - albert-apply*.js (isRichEditor, getTextContent, findRealOffset)
 *   - albert-render*.js (getTextContent, getOrCreateState)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

// ===============================================================
//  DÉTECTION DES CHAMPS
// ===============================================================

/**
 * Vérifie si un élément est un champ d'authentification.
 *
 * Exclut les champs login et mot de passe pour ne pas envoyer
 * de données sensibles à l'API de correction.
 *
 * @param {HTMLElement} el - Élément DOM à tester.
 * @returns {boolean} true si le champ est un champ d'authentification.
 */
Albert.isLoginField = function (el) {
  if (!el || !el.tagName || el.tagName.toLowerCase() !== "input") return false;
  const type = (el.type || "text").toLowerCase();
  if (type === "password") return true;
  const ac = (el.autocomplete || "").toLowerCase();
  if (["username", "current-password", "new-password"].includes(ac)) return true;
  const id = ((el.id || "") + " " + (el.name || "")).toLowerCase();
  if (/\b(login|username|userid|user[-_]?id|user[-_]?name|passwd|password)\b/.test(id)) return true;
  return false;
};

/**
 * Vérifie si un élément est un champ de saisie texte exploitable.
 *
 * Reconnaît les textarea, les input texte (text, search, url) et
 * les contenteditable. Exclut les champs d'authentification.
 *
 * @param {HTMLElement} el - Élément DOM à tester.
 * @returns {boolean} true si l'élément est un champ texte.
 */
Albert.isTextField = function (el) {
  if (!el || !el.tagName) return false;
  if (Albert.isLoginField(el)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = (el.type || "text").toLowerCase();
    return ["text", "search", "url"].includes(type);
  }
  if (el.isContentEditable) return true;
  return false;
};

/**
 * Détecte si un contenteditable est géré par un éditeur riche.
 *
 * Les éditeurs riches (CKEditor, TinyMCE, Quill, ProseMirror,
 * Draft.js, Lexical, etc.) maintiennent un modèle de document
 * interne et ne tolèrent pas la modification directe du DOM.
 * Pour ces éditeurs, Albert utilise une stratégie différente :
 * simulation souris + chaîne d'événements (albert-apply-rich.js).
 *
 * @param {HTMLElement} el - Élément contenteditable à tester.
 * @returns {boolean} true si l'élément est géré par un éditeur riche.
 */
Albert.isRichEditor = function (el) {
  if (!el.isContentEditable) return false;
  /* CKEditor 5 */
  if (el.classList.contains("ck-editor__editable")) return true;
  if (el.closest(".ck-editor")) return true;
  if (el.hasAttribute("data-cke-enter-mode")) return true;
  /* TinyMCE */
  if (el.id && el.id.includes("tinymce")) return true;
  if (el.dataset.mceStyle !== undefined) return true;
  /* Quill */
  if (el.classList.contains("ql-editor")) return true;
  /* ProseMirror (utilisé par Tiptap, etc.) */
  if (el.classList.contains("ProseMirror")) return true;
  /* Draft.js (utilisé par x.com/Twitter, Facebook, etc.) */
  if (el.classList.contains("DraftEditor-editorContainer")) return true;
  if (el.classList.contains("public-DraftEditor-content")) return true;
  if (el.closest(".DraftEditor-root")) return true;
  if (el.hasAttribute("data-contents")) return true;
  /* Lexical (successeur de Draft.js, utilisé par Meta) */
  if (el.hasAttribute("data-lexical-editor")) return true;
  if (el.closest("[data-lexical-editor]")) return true;
  /* Element/Matrix (Tchap, Element Web) */
  if (el.classList.contains("mx_BasicMessageComposer_input")) return true;
  /* Éditeur avec role="textbox" (WhatsApp Web, Slack, etc.) :
     un contenteditable natif n'a pas besoin de role="textbox",
     sa présence indique un éditeur géré par un framework. */
  if (el.getAttribute("role") === "textbox") return true;
  return false;
};

// ===============================================================
//  MIGRATION DES OFFSETS
// ===============================================================

/**
 * Migre les offsets des corrections existantes après une frappe.
 *
 * Compare l'ancien et le nouveau texte pour localiser la zone éditée,
 * puis applique trois règles :
 * - Correction avant l'édition : inchangée.
 * - Correction chevauchant la zone éditée : invalidée (null → filtrée).
 * - Correction après l'édition : décalée du delta de longueur.
 *
 * @param {Array} corrections - Tableau de corrections existantes.
 * @param {string} oldText    - Texte avant la frappe.
 * @param {string} newText    - Texte après la frappe.
 * @returns {Array} Corrections avec offsets ajustés (sans les invalidées).
 */
Albert.migrateCorrections = function (corrections, oldText, newText) {
  const delta = newText.length - oldText.length;
  if (delta === 0 || !corrections || corrections.length === 0) return corrections;

  /* Trouver la position de divergence depuis le début */
  let editStart = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (editStart < minLen && oldText[editStart] === newText[editStart]) {
    editStart++;
  }
  /* Fin de la zone éditée dans l'ancien texte */
  const editEndOld = editStart + Math.max(0, -delta);

  return corrections.map((c) => {
    const cEnd = c.offset + c.length;
    /* Correction entièrement avant l'édition : inchangée */
    if (cEnd <= editStart) return c;
    /* Correction chevauche la zone éditée : invalider */
    if (c.offset < editEndOld + Math.max(0, delta) && cEnd > editStart) return null;
    /* Correction entièrement après l'édition : décaler */
    return Object.assign({}, c, { offset: c.offset + delta });
  }).filter(Boolean);
};

// ===============================================================
//  DÉCOUPAGE EN PARAGRAPHES
// ===============================================================

/**
 * Découpe un texte en paragraphes avec leurs offsets.
 *
 * Chaque paragraphe non vide est retourné avec son offset dans le
 * texte complet, ce qui permet la vérification incrémentale
 * (albert-check.js) : seul le paragraphe modifié est renvoyé à l'API.
 *
 * @param {string} text - Texte complet à découper.
 * @returns {Array<{text: string, offset: number}>} Paragraphes et leurs offsets.
 */
Albert.splitParagraphs = function (text) {
  const paragraphs = [];
  const lines = text.split("\n");
  let offset = 0;
  for (const line of lines) {
    if (line.trim().length > 0) {
      paragraphs.push({ text: line, offset: offset });
    }
    offset += line.length + 1; /* +1 pour le \n */
  }
  return paragraphs;
};

/**
 * Trouve le paragraphe modifié entre deux versions du texte.
 *
 * @param {Array} oldParagraphs - Paragraphes de l'ancien texte.
 * @param {Array} newParagraphs - Paragraphes du nouveau texte.
 * @returns {number} Index du paragraphe modifié, ou -1 si plusieurs ont changé.
 */
Albert.findModifiedParagraph = function (oldParagraphs, newParagraphs) {
  if (oldParagraphs.length !== newParagraphs.length) return -1;
  let modifiedIdx = -1;
  for (let i = 0; i < newParagraphs.length; i++) {
    if (oldParagraphs[i].text !== newParagraphs[i].text) {
      if (modifiedIdx !== -1) return -1; /* plusieurs paragraphes modifiés */
      modifiedIdx = i;
    }
  }
  return modifiedIdx;
};

// ===============================================================
//  ACCÈS AU CONTENU ET À L'ÉTAT
// ===============================================================

/**
 * Récupère le texte brut d'un champ de saisie.
 *
 * @param {HTMLElement} el - Champ (textarea, input ou contenteditable).
 * @returns {string} Contenu textuel du champ.
 */
Albert.getTextContent = function (el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "input") return el.value;
  return el.innerText || "";
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

// ===============================================================
//  RECALIBRAGE DES OFFSETS
// ===============================================================

/**
 * Recale les offsets des corrections renvoyées par le LLM.
 *
 * Le LLM se trompe souvent dans le comptage des caractères sur du
 * texte long. Si le champ "word" est présent, on recherche le mot
 * dans le texte pour trouver l'occurrence la plus proche de l'offset
 * annoncé par le modèle.
 *
 * @param {Array} corrections - Corrections brutes du LLM.
 * @param {string} text       - Texte original envoyé au LLM.
 * @returns {Array} Corrections avec offsets recalibrés.
 */
Albert.recalibrateOffsets = function (corrections, text) {
  return corrections.map((c) => {
    const word = c.word || text.slice(c.offset, c.offset + c.length);
    const atOffset = text.slice(c.offset, c.offset + word.length);

    /* L'offset est déjà correct */
    if (atOffset === word) {
      return { ...c, offset: c.offset, length: word.length };
    }

    /* Chercher l'occurrence la plus proche de l'offset du LLM */
    let bestIdx = -1;
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(word, searchFrom);
      if (idx === -1) break;
      if (bestIdx === -1 || Math.abs(idx - c.offset) < Math.abs(bestIdx - c.offset)) {
        bestIdx = idx;
      }
      searchFrom = idx + 1;
    }

    if (bestIdx !== -1) {
      return { ...c, offset: bestIdx, length: word.length };
    }

    /* Mot introuvable : garder l'offset original */
    return c;
  }).filter((c) => c.offset >= 0 && c.offset + c.length <= text.length);
};

/**
 * Filtre les corrections en excluant les mots du dictionnaire personnel.
 *
 * @param {Array} corrections - Corrections à filtrer.
 * @param {string} text       - Texte complet (pour extraire les mots).
 * @returns {Array} Corrections sans les mots ignorés.
 */
Albert.filterIgnoredCorrections = function (corrections, text) {
  return corrections.filter((c) => {
    const word = text.slice(c.offset, c.offset + c.length).toLowerCase();
    return !Albert.ignoredWords.has(word);
  });
};

/* Charger le dictionnaire au démarrage */
Albert.loadIgnoredWords();
