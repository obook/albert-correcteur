/*
 * albert-apply.js - Orchestration de l'application des corrections.
 *
 * Point d'entrée pour appliquer une suggestion de correction dans un
 * champ texte. Ce module :
 * 1. Nettoie la suggestion (suppression du contexte en trop).
 * 2. Choisit la stratégie selon le type de champ :
 *    - Textarea/input : remplacement de .value + pile undo manuelle.
 *    - Contenteditable simple : Range + execCommand immédiat.
 *    - Éditeur riche : délégation à albert-apply-rich.js.
 * 3. Met à jour les offsets des corrections restantes.
 * 4. Relance le rendu et programme une revérification.
 *
 * Flux d'application :
 *   Clic sur suggestion → applySuggestion()
 *     → _trimSuggestion() → findRealOffset()
 *     → _applyInTextarea() ou _applyInContentEditable()
 *     → _updateRemainingCorrections() → renderCorrections()
 *
 * Dépendances :
 *   - albert-apply-segments.js (buildInnerTextSegments, findSegmentAt)
 *   - albert-apply-rich.js     (applyViaSelection)
 *   - albert-render.js         (renderCorrections)
 *   - albert-check.js          (scheduleCheck)
 *   - albert-toast.js          (showToast)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.applyingCorrection = false;

/* --- Pile undo pour textarea/input (CTRL+Z) --- */

Albert._undoStacks = new WeakMap();

Albert._pushUndo = function (el) {
  if (!Albert._undoStacks.has(el)) {
    Albert._undoStacks.set(el, []);
    el.addEventListener("keydown", Albert._handleUndo);
  }
  Albert._undoStacks.get(el).push({
    value: el.value,
    selStart: el.selectionStart,
    selEnd: el.selectionEnd,
  });
};

Albert._handleUndo = function (e) {
  if (!(e.ctrlKey || e.metaKey) || e.key !== "z" || e.shiftKey) return;
  const stack = Albert._undoStacks.get(e.target);
  if (!stack || stack.length === 0) return;
  e.preventDefault();
  const prev = stack.pop();
  Albert.applyingCorrection = true;
  e.target.value = prev.value;
  e.target.setSelectionRange(prev.selStart, prev.selEnd);
  e.target.dispatchEvent(new Event("input", { bubbles: true }));
  const state = Albert.getOrCreateState(e.target);
  state.checkedText = prev.value;
  state.lastCheckedText = "";
  Albert.renderCorrections(e.target);
  setTimeout(() => { Albert.applyingCorrection = false; }, 120);
  Albert.scheduleCheck(e.target);
};

/* --- Recherche d'offset --- */

/*
 * Retrouve l'offset réel du mot erroné dans le texte actuel.
 * L'offset original peut être décalé si une correction précédente a changé la longueur du texte.
 */
Albert.findRealOffset = function (currentText, correction, checkedText) {
  /*
   * Utiliser correction.word (mot signalé par l'API) en priorité.
   * Fallback sur le slice de checkedText si word est absent.
   * Cela évite les décalages quand l'offset a été ajusté par
   * _updateRemainingCorrections mais ne pointe plus exactement sur le mot.
   */
  const originalWord = correction.word
    || checkedText.slice(correction.offset, correction.offset + correction.length);

  /* Chercher sur des copies normalisées : innerText garde les espaces
     insécables du DOM, le modèle rend un espace ordinaire dans word.
     La normalisation étant de un caractère pour un, les offsets trouvés
     restent valables dans currentText (cf. util/blancs.js). */
  const texte = Albert.normaliserBlancs(currentText);
  const mot = Albert.normaliserBlancs(originalWord);

  /* Vérifier d'abord à l'offset original */
  if (texte.slice(correction.offset, correction.offset + mot.length) === mot) {
    return correction.offset;
  }

  /* Sinon, chercher le mot dans le texte actuel (occurrence la plus proche de l'offset original) */
  let bestIdx = -1;
  let searchFrom = 0;
  while (searchFrom < texte.length) {
    const idx = texte.indexOf(mot, searchFrom);
    if (idx === -1) break;
    if (bestIdx === -1 || Math.abs(idx - correction.offset) < Math.abs(bestIdx - correction.offset)) {
      bestIdx = idx;
    }
    searchFrom = idx + 1;
  }
  return bestIdx;
};

/* --- Nettoyage de la suggestion --- */

/*
 * Si la suggestion de l'API inclut du contexte avant l'erreur, le retirer.
 * Ex. : erreur "ortographe" (offset 40), suggestion "d'orthographe" → retirer le "d'" en trop.
 */
Albert._trimSuggestion = function (suggestion, correction, fullText) {
  if (suggestion.length <= correction.length) return suggestion;

  const maxOverlap = suggestion.length - correction.length;
  for (let len = maxOverlap; len > 0; len--) {
    if (correction.offset >= len) {
      const prefix = fullText.slice(correction.offset - len, correction.offset);
      if (suggestion.startsWith(prefix)) {
        return suggestion.slice(len);
      }
    }
  }
  return suggestion;
};

/* --- Application de la correction --- */

/*
 * Point d'entrée : applique une suggestion de correction dans le champ.
 *
 * Asynchrone parce que l'insertion dans un éditeur riche est différée :
 * attendre sa fin garantit que les offsets des corrections restantes sont
 * recalculés sur le texte réellement modifié.
 */
Albert.applySuggestion = async function (el, correction, suggestion) {
  Albert.applyingCorrection = true;
  const tag = el.tagName.toLowerCase();
  const state = Albert.getOrCreateState(el);

  /* Nettoyer la suggestion */
  suggestion = Albert._trimSuggestion(suggestion, correction, Albert.getTextContent(el));

  /* Appliquer selon le type de champ. Les stratégies rendent l'offset
     où le remplacement a eu lieu, ou -1 si elles ont renoncé. */
  let realOffset = -1;
  if (tag === "textarea" || tag === "input") {
    realOffset = Albert._applyInTextarea(el, correction, suggestion, state);
  } else if (el.isContentEditable) {
    realOffset = await Albert._applyInContentEditable(el, correction, suggestion, state);
  }
  if (realOffset === -1) return;

  /* Retirer la correction appliquée et ajuster les offsets des suivantes */
  Albert._updateRemainingCorrections(state, correction, suggestion, realOffset);

  /* Le texte est à jour dans tous les cas : re-rendre immédiatement. */
  Albert.renderCorrections(el);

  /* Invalider le cache pour forcer une revérification */
  state.lastCheckedText = "";
  setTimeout(() => { Albert.applyingCorrection = false; }, 120);
  Albert.scheduleCheck(el);
};

/* --- Stratégies par type de champ --- */

/* Textarea / input : remplacement de .value avec pile undo manuelle (CTRL+Z).
   Rend l'offset du remplacement, ou -1 si le mot est introuvable. */
Albert._applyInTextarea = function (el, correction, suggestion, state) {
  const realOffset = Albert.findRealOffset(el.value, correction, state.checkedText || el.value);
  if (realOffset === -1) {
    Albert.applyingCorrection = false;
    Albert.showToast("Correction impossible : le texte a changé.", 3000);
    return -1;
  }
  const wordLen = (correction.word || "").length || correction.length;
  Albert._pushUndo(el);
  const before = el.value.slice(0, realOffset);
  const after = el.value.slice(realOffset + wordLen);
  el.value = before + suggestion + after;
  el.setSelectionRange(realOffset + suggestion.length, realOffset + suggestion.length);
  state.checkedText = el.value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return realOffset;
};

/* Contenteditable (simple ou riche). Rend l'offset du remplacement, ou -1. */
Albert._applyInContentEditable = async function (el, correction, suggestion, state) {
  const realOffset = Albert.isRichEditor(el)
    /* Éditeur riche : via Selection + chaîne d'événements (albert-apply-rich.js) */
    ? await Albert.applyViaSelection(el, correction, suggestion)
    /* Contenteditable simple : Range + execCommand immédiat (pas de setTimeout) */
    : Albert._applyInSimpleContentEditable(el, correction, suggestion, state);

  if (realOffset === -1) {
    Albert.applyingCorrection = false;
    Albert.showToast("Correction impossible : le texte a changé.", 3000);
  }
  return realOffset;
};

/* Contenteditable simple : sélection via Range puis execCommand immédiat.
   Rend l'offset du remplacement, ou -1. */
Albert._applyInSimpleContentEditable = function (el, correction, suggestion, state) {
  el.focus();

  const segments = Albert.buildInnerTextSegments(el);
  const currentText = el.innerText || "";
  const checkedText = state.checkedText || currentText;
  const expectedWord = correction.word
    || checkedText.slice(correction.offset, correction.offset + correction.length);

  const realOffset = Albert.findRealOffset(currentText, correction, checkedText);
  if (realOffset === -1) return -1;

  const errEnd = realOffset + expectedWord.length;
  const startPos = Albert.findSegmentAt(segments, realOffset);
  const endPos = Albert.findSegmentAt(segments, errEnd);
  if (!startPos || !endPos) return -1;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  /* Comparaison indifférente à la nature des espaces : le DOM peut
     porter une insécable là où le modèle a rendu un espace ordinaire. */
  if (!Albert.memeTexte(range.toString(), expectedWord)) return -1;

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  /* Remplacement immédiat via execCommand (conserve l'undo natif CTRL+Z) */
  const ok = document.execCommand("insertText", false, suggestion);
  if (!ok) {
    /* Fallback : remplacement DOM direct */
    range.deleteContents();
    range.insertNode(document.createTextNode(suggestion));
    el.normalize();
  }

  state.checkedText = el.innerText || "";
  return realOffset;
};

/* --- Mise à jour des offsets --- */

/*
 * Retire la correction appliquée et ajuste les offsets des corrections
 * restantes.
 *
 * Le décalage se calcule sur ce qui a réellement été remplacé, pas sur
 * ce que le modèle avait annoncé : findRealOffset a pu déplacer le
 * remplacement, et correction.length diffère parfois de la longueur de
 * correction.word. Prendre les valeurs annoncées décalait toutes les
 * corrections suivantes, et le clic d'après tombait à côté.
 */
Albert._updateRemainingCorrections = function (state, correction, suggestion, realOffset) {
  const wordLen = (correction.word || "").length || correction.length;
  const delta = suggestion.length - wordLen;
  state.corrections = state.corrections
    .filter((c) => c !== correction)
    .map((c) => {
      if (c.offset > realOffset) {
        return Object.assign({}, c, { offset: c.offset + delta });
      }
      return c;
    });
};
