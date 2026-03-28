// albert-utils.js — Fonctions utilitaires.
// Détection des champs texte, éditeurs riches, gestion de l'état.

"use strict";

// Vérifie si un champ est un champ d'authentification (login, mot de passe).
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

// Vérifie si un élément est un champ de saisie texte.
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

// Détecte si un contenteditable est géré par un éditeur riche
// (CKEditor, TinyMCE, etc.) qui ne tolère pas la modification directe du DOM.
Albert.isRichEditor = function (el) {
  if (!el.isContentEditable) return false;
  // CKEditor 5
  if (el.classList.contains("ck-editor__editable")) return true;
  if (el.closest(".ck-editor")) return true;
  if (el.hasAttribute("data-cke-enter-mode")) return true;
  // TinyMCE
  if (el.id && el.id.includes("tinymce")) return true;
  if (el.dataset.mceStyle !== undefined) return true;
  // Quill
  if (el.classList.contains("ql-editor")) return true;
  // ProseMirror (utilisé par Tiptap, etc.)
  if (el.classList.contains("ProseMirror")) return true;
  // Draft.js (utilisé par x.com/Twitter, Facebook, etc.)
  if (el.classList.contains("DraftEditor-editorContainer")) return true;
  if (el.classList.contains("public-DraftEditor-content")) return true;
  if (el.closest(".DraftEditor-root")) return true;
  if (el.hasAttribute("data-contents")) return true;
  // Lexical (successeur de Draft.js, utilisé par Meta)
  if (el.hasAttribute("data-lexical-editor")) return true;
  if (el.closest("[data-lexical-editor]")) return true;
  return false;
};

// Récupère le texte d'un champ de saisie.
Albert.getTextContent = function (el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "input") return el.value;
  return el.innerText || "";
};

// Récupère ou crée l'état associé à un champ.
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

// Pause asynchrone (ms millisecondes).
Albert.sleep = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// --- Dictionnaire personnel (mots ignorés) ---

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

// Recale les offsets des corrections renvoyées par le LLM.
// Le LLM se trompe souvent dans le comptage des caractères sur du texte long.
// Si le champ "word" est présent, on recherche le mot dans le texte
// pour trouver l'occurrence la plus proche de l'offset annoncé.
Albert.recalibrateOffsets = function (corrections, text) {
  return corrections.map((c) => {
    const word = c.word || text.slice(c.offset, c.offset + c.length);
    const atOffset = text.slice(c.offset, c.offset + word.length);

    // L'offset est déjà correct
    if (atOffset === word) {
      return { ...c, offset: c.offset, length: word.length };
    }

    // Chercher l'occurrence la plus proche de l'offset du LLM
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

    // Mot introuvable : garder l'offset original
    return c;
  }).filter((c) => c.offset >= 0 && c.offset + c.length <= text.length);
};

// Filtre les corrections en excluant les mots du dictionnaire personnel.
Albert.filterIgnoredCorrections = function (corrections, text) {
  return corrections.filter((c) => {
    const word = text.slice(c.offset, c.offset + c.length).toLowerCase();
    return !Albert.ignoredWords.has(word);
  });
};

// Charger le dictionnaire au démarrage
Albert.loadIgnoredWords();
