/*
 * albert-apply-rich.js - Remplacement de texte dans les éditeurs riches.
 *
 * Les éditeurs riches (CKEditor, TinyMCE, Quill, ProseMirror, Lexical,
 * Draft.js…) maintiennent un modèle de document interne. Modifier le
 * DOM directement casse leur état. Ce module contourne le problème en
 * simulant une interaction utilisateur complète :
 *
 * Stratégie d'insertion :
 * 1. Localiser le mot erroné dans l'arbre DOM via les segments
 *    (albert-apply-segments.js).
 * 2. Simuler une séquence mousedown → mousemove → sélection →
 *    mouseup pour que l'éditeur enregistre la sélection.
 * 3. Muter les événements parasites (mouse, pointer, selectionchange)
 *    pendant la phase d'insertion.
 * 4. Insérer le texte via la chaîne d'événements complète :
 *    beforeinput → textInput → execCommand("insertText").
 * 5. Fallback paste si execCommand échoue.
 *
 * Dépendances :
 *   - albert-apply-segments.js (buildInnerTextSegments, findSegmentAt)
 *   - albert-apply.js          (findRealOffset)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* --- Muting des événements parasites --- */

/*
 * Pendant le remplacement, les éditeurs riches (Lexical/WhatsApp, CKEditor, etc.)
 * peuvent réagir aux événements souris/pointer/sélection et déplacer leur curseur
 * interne. On mute ces événements en phase de capture au niveau du document
 * pour éviter toute interférence.
 */
/* selectionchange ne figure pas dans cette liste : c'est par lui que
   les éditeurs à modèle interne apprennent où insérer. Le museler
   revenait à leur demander d'écrire à l'ancienne position du curseur. */
const _MUTED_EVENTS = [
  "mousedown", "mouseup", "mousemove", "mouseover", "mouseout",
  "pointerdown", "pointerup", "pointermove", "pointerover", "pointerout",
  "click", "dblclick"
];

Albert._muteEvents = function (el) {
  const handler = (e) => { e.stopImmediatePropagation(); };
  const entries = [];
  const root = el.ownerDocument || document;
  for (const type of _MUTED_EVENTS) {
    root.addEventListener(type, handler, true);
    entries.push({ type, handler });
  }
  return function unmute() {
    for (const { type, handler } of entries) {
      root.removeEventListener(type, handler, true);
    }
  };
};

/*
 * Applique une correction dans un éditeur riche (CKEditor, TinyMCE, etc.)
 * via Selection + chaîne d'événements complète.
 *
 * L'insertion est différée de 30 ms pour laisser l'éditeur enregistrer la
 * sélection : la promesse retournée n'est résolue qu'une fois le texte
 * réellement remplacé, afin que l'appelant recalcule les offsets sur le
 * contenu à jour.
 *
 * @returns {Promise<boolean>} true si la correction a été appliquée.
 */
/**
 * Reconstruit la plage couvrant le mot erroné sur l'état actuel du DOM.
 *
 * Un Range gardé d'un tour de boucle précédent ne survit pas au
 * re-rendu des nœuds texte par l'éditeur : ses bornes se replient sur
 * le parent, et le poser en sélection donne une sélection vide.
 *
 * @param {HTMLElement} el      - Éditeur riche.
 * @param {number} debut        - Offset du mot dans innerText.
 * @param {number} fin          - Offset de fin du mot.
 * @param {string} motAttendu   - Texte que la plage doit couvrir.
 * @returns {Range|null} Plage vérifiée, ou null si le mot n'est plus situable.
 */
Albert._plageDuMot = function (el, debut, fin, motAttendu) {
  const segments = Albert.buildInnerTextSegments(el);
  const posDebut = Albert.findSegmentAt(segments, debut);
  const posFin = Albert.findSegmentAt(segments, fin);
  if (!posDebut || !posFin) return null;
  const plage = el.ownerDocument.createRange();
  try {
    plage.setStart(posDebut.node, posDebut.offset);
    plage.setEnd(posFin.node, posFin.offset);
  } catch (err) {
    return null;
  }
  return Albert.memeTexte(plage.toString(), motAttendu) ? plage : null;
};

Albert.applyViaSelection = function (el, correction, suggestion) {
  el.focus();

  /*
   * Laisser le focus produire ses effets avant de poser la sélection.
   *
   * Le focus n'est jamais dans l'éditeur quand on arrive ici : le piège
   * de focus de la popup (popup-focus.js, exigé au clavier) l'a donné à
   * son premier bouton. Or Draft.js ignore tout changement de sélection
   * le temps de traiter son retour de focus. Posée dans le même tour,
   * notre sélection ne l'atteignait pas : son curseur restait là où
   * l'utilisateur l'avait laissé, et l'insertion partait dans ce bloc au
   * lieu du mot visé, en y recopiant la ligne corrigée.
   *
   * Mesuré sur exemple/test-draftjs.html : sans cette attente, la
   * sélection interne reste au bloc du curseur ; avec elle, elle suit le
   * mot. L'attente vaut pour tous les éditeurs riches, le retard est
   * celui de leur famille (10 ms hors modèle interne).
   */
  return new Promise((resolve) => {
    setTimeout(() => {
      Albert._poserSelectionEtInserer(el, correction, suggestion).then(resolve);
    }, Albert.editorInsertDelay(el));
  });
};

/* Pose la sélection sur le mot erroné puis insère la suggestion. */
Albert._poserSelectionEtInserer = function (el, correction, suggestion) {
  const state = Albert.getOrCreateState(el);

  const segments = Albert.buildInnerTextSegments(el);

  const currentText = el.innerText || "";
  const checkedText = state.checkedText || currentText;
  /*
   * Utiliser correction.word en priorité pour le mot attendu.
   * Après _updateRemainingCorrections, l'offset peut être décalé
   * d'un caractère ; correction.word reste fiable.
   */
  const expectedWord = correction.word
    || checkedText.slice(correction.offset, correction.offset + correction.length);

  const realOffset = Albert.findRealOffset(currentText, correction, checkedText);
  if (realOffset === -1) return Promise.resolve(-1);

  const errEnd = realOffset + expectedWord.length;

  /* Localiser les nœuds texte de début et fin */
  const startPos = Albert.findSegmentAt(segments, realOffset);
  const endPos = Albert.findSegmentAt(segments, errEnd);
  if (!startPos || !endPos) return Promise.resolve(-1);

  /* Créer le Range couvrant le texte erroné */
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  /* Comparaison indifférente à la nature des espaces : le DOM peut
     porter une insécable là où le modèle a rendu un espace ordinaire. */
  if (!Albert.memeTexte(range.toString(), expectedWord)) return Promise.resolve(-1);

  /*
   * Coordonnées séparées pour début et fin :
   * certains éditeurs (Lexical/WhatsApp) utilisent les coordonnées souris
   * pour déterminer la position du curseur dans leur modèle interne.
   */
  const startRange = document.createRange();
  startRange.setStart(startPos.node, startPos.offset);
  startRange.collapse(true);
  const startRect = startRange.getBoundingClientRect();

  const endRange = document.createRange();
  endRange.setStart(endPos.node, endPos.offset);
  endRange.collapse(true);
  const endRect = endRange.getBoundingClientRect();

  /*
   * Simuler la séquence complète mousedown → mousemove → sélection → mousemove → mouseup
   */
  Albert._simulateMouseEvent(startPos.node.parentElement || el, "mousedown", startRect);
  Albert._simulateMouseEvent(el, "mousemove", startRect);

  /* Appliquer la sélection */
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  /* Simuler mousemove + mouseup sur le nœud de fin */
  Albert._simulateMouseEvent(endPos.node.parentElement || el, "mousemove", endRect);
  Albert._simulateMouseEvent(endPos.node.parentElement || el, "mouseup", endRect);

  /*
   * Délai pour que l'éditeur enregistre la sélection, puis insertion via
   * chaîne d'événements complète. Le délai dépend de la famille
   * d'éditeur (albert-fields.js) : une valeur unique était trop longue
   * pour les éditeurs qui travaillent sur le DOM, dont elle faisait
   * échouer les garde-fous, et trop courte pour ceux à modèle interne,
   * qui écrivaient alors en fin de texte.
   */
  const attente = Albert.editorInsertDelay(el);

  return new Promise((resolve) => {
    setTimeout(() => {
      /*
       * Certains éditeurs (Lexical/WhatsApp) effacent la sélection pendant
       * le délai. On la reconstruit depuis les segments actuels du DOM
       * (qui ont pu être modifiés par l'éditeur).
       */
      const freshSegments = Albert.buildInnerTextSegments(el);
      const freshStart = Albert.findSegmentAt(freshSegments, realOffset);
      const freshEnd = Albert.findSegmentAt(freshSegments, errEnd);
      if (!freshStart || !freshEnd) {
        /* Le DOM de l'éditeur a changé : sans sélection fiable,
           l'insertion se ferait à la position courante du curseur,
           donc au mauvais endroit. Mieux vaut ne rien faire. */
        Albert.warn("applyViaSelection : sélection introuvable après le "
          + "délai, insertion annulée pour éviter un remplacement "
          + "au mauvais endroit.");
        resolve(-1);
        return;
      }

      const freshRange = document.createRange();
      freshRange.setStart(freshStart.node, freshStart.offset);
      freshRange.setEnd(freshEnd.node, freshEnd.offset);

      /* Même garde-fou que le contenteditable simple : si la sélection
         reconstruite ne couvre pas exactement le mot erroné, insérer
         reviendrait à écrire au mauvais endroit. */
      if (!Albert.memeTexte(freshRange.toString(), expectedWord)) {
        Albert.warn("applyViaSelection : la sélection reconstruite ne "
          + "couvre pas le mot attendu, insertion annulée.");
        resolve(-1);
        return;
      }

      const freshSel = window.getSelection();
      freshSel.removeAllRanges();
      freshSel.addRange(freshRange);

      /*
       * Laisser le selectionchange de cette sélection être délivré avant
       * d'émettre les événements d'insertion. Les éditeurs à modèle
       * interne (Draft.js sur x.com notamment) ne lisent pas la sélection
       * DOM au moment du beforeinput : ils utilisent leur propre état,
       * synchronisé par selectionchange. Insérer dans le même tour de
       * boucle leur faisait écrire à l'ancienne position du curseur,
       * typiquement en fin de texte.
       *
       * Les événements souris sont muselés pendant cette attente
       * seulement, et démuselés avant l'insertion : c'est le curseur
       * déplacé par une souris parasite qu'il faut empêcher, pas
       * l'insertion elle-même.
       */
      const unmute = Albert._muteEvents(el);
      setTimeout(() => {
        unmute();
        const inserer = () => {
          Albert._insertTextInEditor(el, suggestion);
          state.checkedText = el.innerText || "";
          resolve(realOffset);
        };

        const selCourante = window.getSelection();
        const couvreLeMot = selCourante.rangeCount > 0
          && Albert.memeTexte(selCourante.getRangeAt(0).toString(), expectedWord);

        /* Sélection intacte : le selectionchange de la pose précédente a
           déjà été délivré, l'éditeur sait où écrire. */
        if (couvreLeMot) {
          inserer();
          return;
        }

        /* L'éditeur a déplacé la sélection pendant l'attente (Lexical
           l'efface, Draft.js la ramène au curseur de son modèle). La
           reposer puis insérer dans le même tour de boucle est le piège
           décrit plus haut : le selectionchange part après beforeinput,
           l'éditeur écrit donc à son ancienne position, et Draft.js y
           recopie au passage la ligne où se trouve la sélection du DOM.
           Reposer, laisser partir le selectionchange, revérifier. */
        /* Plage reconstruite sur l'état courant du DOM : celle du tour
           précédent s'est repliée sur son parent si l'éditeur a re-rendu
           ses nœuds texte entre-temps, et la reposer donnerait une
           sélection vide. */
        const plageCourante = Albert._plageDuMot(el, realOffset, errEnd, expectedWord);
        if (!plageCourante) {
          Albert.warn("applyViaSelection : le mot n'est plus situable dans "
            + "le DOM, insertion annulée.");
          resolve(-1);
          return;
        }
        selCourante.removeAllRanges();
        selCourante.addRange(plageCourante);
        setTimeout(() => {
          const selFinale = window.getSelection();
          if (selFinale.rangeCount === 0
            || !Albert.memeTexte(selFinale.getRangeAt(0).toString(), expectedWord)) {
            Albert.warn("applyViaSelection : l'éditeur reprend la sélection, "
              + "insertion annulée pour éviter un remplacement au mauvais "
              + "endroit.");
            resolve(-1);
            return;
          }
          inserer();
        }, attente);
      }, attente);
    }, attente);
  });
};

/* --- Simulation d'événements --- */

/* Simule un événement souris sur un élément avec les coordonnées d'un DOMRect. */
Albert._simulateMouseEvent = function (target, type, rect) {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true, cancelable: true, view: window,
    clientX: x, clientY: y, button: 0
  }));
};

/* --- Insertion de texte --- */

/*
 * Insère du texte via la chaîne d'événements complète :
 * beforeinput → textInput → execCommand, avec fallback paste si échec.
 */
Albert._insertTextInEditor = function (el, text) {
  /* Étape 1 : beforeinput (CKEditor 5, ProseMirror, Lexical) */
  const beforeInputOpts = {
    bubbles: true, cancelable: true,
    inputType: "insertText", data: text
  };
  if ("StaticRange" in window && "getTargetRanges" in InputEvent.prototype) {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        beforeInputOpts.targetRanges = [new StaticRange(sel.getRangeAt(0))];
      }
    } catch (_) { /* pas critique */ }
  }
  const beforeOK = el.dispatchEvent(new InputEvent("beforeinput", beforeInputOpts));

  /* Étape 2 : textInput (éditeurs legacy) */
  let textInputOK = true;
  if ("TextEvent" in window) {
    try {
      const textEvt = new InputEvent("textInput", {
        bubbles: true, cancelable: true,
        inputType: "insertText", data: text
      });
      textInputOK = el.dispatchEvent(textEvt);
    } catch (_) { /* non supporté, on continue */ }
  }

  /* Étape 3 : execCommand si les événements n'ont pas été annulés */
  if (beforeOK && textInputOK) {
    const ok = document.execCommand("insertText", false, text);

    /* Étape 4 : fallback paste si execCommand a échoué */
    if (!ok) {
      Albert._insertViaPaste(el, text);
    }
  }
};

/* Fallback : simule un paste pour les éditeurs qui n'acceptent pas execCommand. */
Albert._insertViaPaste = function (el, text) {
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const pasteEvt = new ClipboardEvent("paste", {
      clipboardData: dt, cancelable: true, bubbles: true
    });
    const pasteHandled = !el.dispatchEvent(pasteEvt);
    if (!pasteHandled) {
      document.execCommand("insertText", false, text);
    }
  } catch (_) {
    document.execCommand("insertText", false, text);
  }
};
