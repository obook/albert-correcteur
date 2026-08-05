/*
 * albert-fields.js - Détection des champs texte exploitables par Albert.
 *
 * Trie les éléments du DOM en trois familles :
 *   - champs d'authentification (à exclure systématiquement) ;
 *   - champs texte standards (textarea, input[type=text], contenteditable
 *     suffisamment grands) ;
 *   - éditeurs riches (CKEditor, TinyMCE, Quill, ProseMirror, Draft.js,
 *     Lexical, etc.) qui imposent une stratégie d'application différente.
 *
 * Expose aussi Albert.diagnose() pour analyser depuis la console
 * pourquoi un élément est ou n'est pas pris en charge.
 *
 * Dépendances :
 *   - albert-state.js (objet global Albert)
 *
 * Auteur : O. Booklage
 * Date : mai 2026
 * Licence : MIT
 */

"use strict";

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
 * Reconnaît les textarea, les <input type="text"> et les contenteditable,
 * à condition qu'ils soient visuellement assez grands. Exclut les autres
 * types d'input (search, url, email, number, etc.) et les champs
 * d'authentification.
 *
 * @param {HTMLElement} el - Élément DOM à tester.
 * @returns {boolean} true si l'élément est un champ texte.
 */
Albert.MIN_FIELD_WIDTH_PX = 150;
Albert.MIN_FIELD_HEIGHT_PX = 28;

Albert.isTextField = function (el) {
  if (!el || !el.tagName) return false;
  if (Albert.isLoginField(el)) return false;
  const tag = el.tagName.toLowerCase();

  let candidate = false;
  if (tag === "textarea") candidate = true;
  else if (tag === "input") {
    const type = (el.type || "text").toLowerCase();
    candidate = (type === "text");
  }
  else if (el.isContentEditable) candidate = true;

  if (!candidate) return false;

  /* Éditeurs riches reconnus (CKEditor, TinyMCE, Quill, ProseMirror,
     Draft.js, Lexical, Element/Matrix) : la classe ou l'attribut
     signature suffit, on n'applique pas le seuil de taille. Sinon
     un composer Tchap vide (hauteur ~24 px) ou un éditeur CKEditor
     dans une modale fermée serait écarté à tort, et ne serait jamais
     attaché même quand l'utilisateur commence à le remplir. */
  if (el.isContentEditable && Albert.isRichEditor(el)) return true;

  /* Seuil visuel : un champ trop petit n'est pas destiné à du texte rédigé */
  const rect = el.getBoundingClientRect();
  if (rect.width < Albert.MIN_FIELD_WIDTH_PX) return false;
  if (rect.height < Albert.MIN_FIELD_HEIGHT_PX) return false;
  return true;
};

/**
 * Diagnostic : explique pourquoi un élément n'est (ou n'est pas) considéré
 * comme un champ texte.
 *
 * À appeler depuis la console du content script, et non depuis celle de
 * la page : les content scripts s'exécutent dans un contexte isolé, où
 * le namespace Albert n'est pas visible pour le code de la page. Ouvrir
 * about:debugging, « Ce Firefox », bouton « Inspecter » en face
 * d'Albert Correcteur, puis :
 *   Albert.diagnose(document.activeElement)
 *
 * @param {HTMLElement} el - Élément DOM à tester (par défaut : document.activeElement).
 */
Albert.diagnose = function (el) {
  el = el || document.activeElement;
  const out = { element: el };
  if (!el || !el.tagName) {
    out.verdict = "élément invalide ou sans tagName";
    console.info("[Albert] diagnose:", out);
    return out;
  }
  out.tag = el.tagName.toLowerCase();
  out.type = el.type || "";
  out.isContentEditable = el.isContentEditable;
  out.isLoginField = Albert.isLoginField(el);
  out.isTextField = Albert.isTextField(el);
  out.isRichEditor = el.isContentEditable ? Albert.isRichEditor(el) : false;
  const rect = el.getBoundingClientRect();
  out.size = { width: Math.round(rect.width), height: Math.round(rect.height) };
  const state = Albert.fieldStates.get(el);
  out.attached = state ? state.attached : false;
  out.focused = state ? state.focused : false;
  out.hasBadge = state && state.badge ? document.contains(state.badge) : false;
  out.frameInIframe = window.top !== window;
  out.url = location.href;
  if (out.isLoginField) out.verdict = "exclu : champ d'authentification";
  else if (out.tag === "input" && (out.type || "text").toLowerCase() !== "text") {
    out.verdict = "exclu : <input type=\"" + (out.type || "") + "\"> non géré (seul type=\"text\" est accepté)";
  }
  else if ((out.tag === "textarea" || out.tag === "input" || out.isContentEditable)
    && (rect.width < Albert.MIN_FIELD_WIDTH_PX || rect.height < Albert.MIN_FIELD_HEIGHT_PX)) {
    out.verdict = "exclu : champ trop petit (" + out.size.width + "x" + out.size.height
      + "px, minimum " + Albert.MIN_FIELD_WIDTH_PX + "x" + Albert.MIN_FIELD_HEIGHT_PX + ")";
  }
  else if (!out.isTextField) out.verdict = "non détecté comme champ texte";
  else if (!out.attached) out.verdict = "détecté mais pas attaché : scanFields ne l'a pas vu";
  else if (!out.focused) out.verdict = "attaché mais n'a jamais reçu le focus : le badge n'est créé qu'au premier focus";
  else if (!out.hasBadge) out.verdict = "a reçu le focus mais le badge est absent du DOM : vérifier ensureBadge et le parent positionné";
  else out.verdict = "OK : champ pris en charge";
  console.info("[Albert] diagnose:", out);
  return out;
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
  /* CKEditor 4 et TinyMCE en mode iframe : le content script est injecté
     dans l'iframe (all_frames), où l'éditeur se réduit à un <body
     contenteditable> dépourvu des marqueurs ci-dessus. Sans ce test, le
     remplacement passerait par la voie « contenteditable simple » et
     corromprait le modèle interne de l'éditeur. */
  if (Albert._estCorpsIframeEditable(el)) return true;
  return false;
};

/**
 * Détecte le corps éditable d'une iframe d'éditeur riche.
 *
 * @param {HTMLElement} el - Élément contenteditable à tester.
 * @returns {boolean} true si l'élément est le <body> éditable d'une iframe d'éditeur.
 */
Albert._estCorpsIframeEditable = function (el) {
  if (el.tagName !== "BODY") return false;
  const vue = el.ownerDocument && el.ownerDocument.defaultView;
  if (!vue || vue.top === vue) return false;
  /* Un éditeur expose son objet global dans l'iframe ou dans la page
     parente ; à défaut, un <body> éditable seul dans son document est
     déjà le cas d'usage d'un éditeur en iframe. */
  try {
    if (vue.CKEDITOR || vue.tinymce || vue.tinyMCE) return true;
    if (vue.parent && (vue.parent.CKEDITOR || vue.parent.tinymce)) return true;
  } catch (_) {
    /* Iframe d'origine différente : accès au parent refusé, on retombe
       sur l'heuristique ci-dessous. */
  }
  return el.hasAttribute("data-id")
    || el.id === "tinymce"
    || el.ownerDocument.documentElement.childElementCount <= 2;
};
