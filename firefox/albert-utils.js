// albert-utils.js — Fonctions utilitaires.
// Détection des champs texte, éditeurs riches, gestion de l'état.

"use strict";

// Vérifie si un élément est un champ de saisie texte.
Albert.isTextField = function (el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const type = (el.type || "text").toLowerCase();
    return ["text", "search", "url", "email"].includes(type);
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
      attached: false, lastCheckedText: "", scrollHandler: null,
    });
  }
  return Albert.fieldStates.get(el);
};

// Pause asynchrone (ms millisecondes).
Albert.sleep = function (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Échappe les caractères HTML spéciaux.
Albert.escapeHTML = function (str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};
