/*
 * compose-apply.js - Application des corrections dans le compose Thunderbird.
 *
 * Applique une suggestion de correction dans le corps du message.
 * Deux stratégies :
 * 1. Via le span souligné (data-correction-index) : sélectionne le
 *    contenu du span et remplace via execCommand("insertText").
 * 2. Fallback par offset : parcourt les nœuds texte du body pour
 *    localiser le mot erroné et le remplacer.
 *
 * Contient également triggerManualCheck() pour le clic sur le badge.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

Albert.applySuggestion = function (correction, suggestion) {
  Albert.applyingCorrection = true;

  try {
    const body = Albert.getComposeBody();
    if (!body) return;

    /* Un mot à cheval sur plusieurs nœuds (gras, lien) est souligné par
       plusieurs spans partageant le même index : les remplacer tous. */
    const marks = document.querySelectorAll(
      '[data-correction-index="' + correction.index + '"]'
    );
    if (marks.length > 0) {
      /* Redonner le focus au corps éditable avant la manipulation */
      body.focus();

      const range = document.createRange();
      range.setStartBefore(marks[0]);
      range.setEndAfter(marks[marks.length - 1]);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      /* insertText peut échouer en designMode, fallback sur DOM direct */
      /* Une suggestion vide correspond à un mot en trop à supprimer. Sur
         Gecko, execCommand("insertText") avec une chaîne vide annonce
         une réussite sans rien retirer : passer directement par le DOM. */
      if (suggestion === "" || !document.execCommand("insertText", false, suggestion)) {
        range.deleteContents();
        range.insertNode(document.createTextNode(suggestion));
        body.normalize();
      }
    } else {
      const text = body.innerText;
      const realOffset = Albert.findRealOffset(text, correction.word, correction.offset);
      if (realOffset === -1) return;
      const finErreur = realOffset + correction.word.length;

      /* Les offsets viennent de innerText, qui insère des sauts de ligne
         entre les blocs. Un parcours qui se contente d'additionner la
         longueur des nœuds texte ignore ces sauts et vise donc un endroit
         décalé d'autant de caractères qu'il y a de paragraphes : le
         remplacement tombait à côté du mot, et sur un mot en fin de
         message la suggestion venait s'ajouter au lieu de le remplacer
         (« Olivi » corrigé donnait « OliviOlivier »). La table de
         correspondance partagée avec les soulignements tient compte des
         sauts de ligne. */
      const segments = Albert.buildInnerTextSegments(body);
      const debut = segments.find((s) => s.start <= realOffset && realOffset < s.end);
      const fin = segments.find((s) => s.start < finErreur && finErreur <= s.end);
      if (!debut || !fin) return;

      body.focus();
      const range = document.createRange();
      try {
        range.setStart(debut.node, realOffset - debut.start + (debut.nodeStart || 0));
        range.setEnd(fin.node, finErreur - fin.start + (fin.nodeStart || 0));
      } catch (err) {
        /* Nœud plus court que la table (DOM modifié entre-temps) :
           refuser plutôt que planter. */
        Albert.warn("applySuggestion : position invalide, remplacement annulé -", err && err.message);
        Albert.showToast("Le texte a changé, relancez la vérification.");
        return;
      }

      /* Dernier contrôle avant de toucher au texte : si la sélection ne
         couvre pas exactement le mot erroné (texte modifié depuis la
         vérification, table dépassée), un remplacement raté est bien
         pire qu'un remplacement refusé. */
      if (!Albert.memeTexte(range.toString(), correction.word)) {
        Albert.warn("applySuggestion : le texte sous l'offset ne correspond plus, remplacement annulé");
        Albert.showToast("Le texte a changé, relancez la vérification.");
        return;
      }

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      /* Une suggestion vide correspond à un mot en trop à supprimer. Sur
         Gecko, execCommand("insertText") avec une chaîne vide annonce
         une réussite sans rien retirer : passer directement par le DOM. */
      if (suggestion === "" || !document.execCommand("insertText", false, suggestion)) {
        range.deleteContents();
        range.insertNode(document.createTextNode(suggestion));
        body.normalize();
      }
    }

    const state = Albert.composeState;
    if (state && state.corrections) {
      /* correction est une copie enrichie d'un index (compose-overlay.js),
         jamais l'objet stocké dans composeState : une comparaison par
         identité ne retirait donc rien, et le mot corrigé était aussitôt
         re-souligné comme erroné. */
      state.corrections = state.corrections.filter((c, i) => i !== correction.index);
      state.checkedText = null;
    }
  } finally {
    Albert.applyingCorrection = false;
  }

  /* Le span de soulignement entoure désormais le mot corrigé : sans
     re-rendu, l'erreur reste visuellement signalée. Le re-rendu
     réattribue aussi des index contigus aux spans restants, sans quoi
     la navigation Suivant / Précédent de la popup ne les retrouve plus.
     Une nouvelle vérification est ensuite programmée, car le remplacement
     par le repli DOM ne déclenche aucun événement input. */
  const state = Albert.composeState;
  Albert.renderCorrections(state && state.corrections ? state.corrections : []);
  setTimeout(() => Albert.scheduleCheck(), 200);
};

Albert.triggerManualCheck = function () {
  const text = Albert.getBodyText();
  const state = Albert.badgeState;
  Albert.log("triggerManualCheck : clic badge (state=", state, ", ", text.trim().length, "car.)");

  if (text.trim().length < Albert.BADGE_MIN_LENGTH) {
    Albert.showToast("Texte trop court pour être vérifié (" + Albert.BADGE_MIN_LENGTH + " caractères minimum).");
    return;
  }

  if (state === "loading") {
    Albert.showToast("Vérification déjà en cours…");
    return;
  }

  if (state === "error") {
    const last = Albert.lastError;
    if (last && last.message) {
      Albert.showToast("Dernière erreur : " + last.message + ". Nouvelle tentative…");
    } else {
      Albert.showToast("Nouvelle tentative de vérification…");
    }
    /* Forcer une nouvelle requête même si le texte n'a pas changé */
    if (Albert.composeState) Albert.composeState.checkedText = null;
    Albert.requestCheck(text);
    return;
  }

  /* États ok / has-errors / null : relance manuelle */
  Albert.showToast("Vérification en cours…", 3000);
  if (Albert.composeState) Albert.composeState.checkedText = null;
  Albert.requestCheck(text);
};
