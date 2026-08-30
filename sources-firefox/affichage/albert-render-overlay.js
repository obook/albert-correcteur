/*
 * albert-render-overlay.js - Overlay transparent pour les soulignements.
 *
 * Crée un div transparent positionné exactement par-dessus le champ
 * de saisie (textarea, input ou contenteditable riche). L'overlay
 * reproduit le même texte en invisible, avec des <span> colorés aux
 * positions des erreurs pour afficher les soulignements.
 *
 * Principe de fonctionnement :
 *   1. Copier tous les styles du champ (police, padding, interligne…)
 *      sur l'overlay pour un alignement pixel-perfect.
 *   2. Découper le texte en segments : texte normal (invisible) et
 *      erreurs (spans colorés cliquables).
 *   3. Synchroniser le défilement de l'overlay avec celui du champ.
 *
 * Cette approche évite de modifier le contenu du champ, ce qui est
 * indispensable pour les textarea/input (pas de DOM interne) et les
 * éditeurs riches (modèle de document interne fragile).
 *
 * Dépendances :
 *   - albert-state.js  (getOrCreateState, isRichEditor)
 *   - albert-utils.js  (getTextContent)
 *   - albert-popup-correction.js (showPopup, au clic sur un span)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/*
 * Crée et positionne un overlay transparent par-dessus le champ de saisie.
 * L'overlay reproduit le même texte en invisible, avec des <span> colorés
 * aux positions des erreurs pour afficher les soulignements.
 */
Albert.renderOverlay = function (el, state) {
  /* Nettoyer l'overlay et le listener de scroll précédents */
  if (state.overlay) {
    state.overlay.remove();
  }
  if (state.scrollHandler) {
    el.removeEventListener("scroll", state.scrollHandler);
    state.scrollHandler = null;
  }

  /* Aucune erreur : pas d'overlay nécessaire */
  if (state.corrections.length === 0) {
    state.overlay = null;
    return;
  }

  /* Champ à DOM : mesurer plutôt que reproduire la mise en page. */
  if (el.isContentEditable) {
    Albert.renderMarquesRange(el, state);
    return;
  }

  /* Créer le div overlay et copier les styles du champ cible */
  const overlay = document.createElement("div");
  overlay.className = "albert-overlay";
  Albert.syncOverlayStyle(el, overlay);

  /* Remplir l'overlay avec le texte + spans d'erreur */
  const text = Albert.getTextContent(el);
  Albert.buildHighlightedDOM(overlay, text, state.corrections);

  /*
   * Insérer l'overlay dans le parent positionné du champ.
   * Si le parent est en position static, le passer en relative
   * pour que le positionnement absolu de l'overlay fonctionne.
   */
  const parent = Albert.positionedParent(el);
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  parent.appendChild(overlay);
  state.overlay = overlay;

  /*
   * Synchroniser le défilement de l'overlay avec celui du champ.
   * Le throttle via requestAnimationFrame évite les appels excessifs
   * lors d'un scroll rapide (1 mise à jour par frame au maximum).
   */
  overlay.scrollTop = el.scrollTop;
  overlay.scrollLeft = el.scrollLeft;
  let scrollRAF = null;
  state.scrollHandler = () => {
    if (scrollRAF) {
      return;
    }
    scrollRAF = requestAnimationFrame(() => {
      overlay.scrollTop = el.scrollTop;
      overlay.scrollLeft = el.scrollLeft;
      scrollRAF = null;
    });
  };
  el.addEventListener("scroll", state.scrollHandler, { passive: true });

  /* Garder le focus dans le champ au clic sur un mot souligné. Sans
     cela, un champ qui s'agrandit au focus (transition CSS) se replie
     dès le mousedown, sous la popup qui vient de s'ouvrir. L'overlay
     est en pointer-events: none, seules les marques d'erreur reçoivent
     cet événement, la pose du curseur ailleurs n'est pas touchée. */
  overlay.addEventListener("mousedown", (e) => e.preventDefault());

  /* Rendre chaque span d'erreur cliquable pour ouvrir la popup de correction */
  overlay.querySelectorAll(".albert-error").forEach((mark) => {
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(mark.dataset.idx, 10);
      Albert.showPopup(el, state.corrections[idx], mark);
    });
  });
};

/**
 * Renvoie la plage DOM couvrant une erreur, ou null si la table des
 * segments ne permet pas de la situer.
 *
 * Même chemin que le remplacement (albert-apply.js) : ce qui n'est pas
 * situable n'est ni soulignable ni remplaçable, les deux restent donc
 * cohérents.
 *
 * @param {HTMLElement} el         - Champ contenteditable.
 * @param {Object} correction      - Correction renvoyée par l'API.
 * @param {string} texte           - innerText courant du champ.
 * @param {string} verifie         - Texte sur lequel l'API a travaillé.
 * @param {Array} segments         - Table offsets innerText -> nœuds.
 * @returns {Range|null} Plage couvrant le mot fautif.
 */
Albert.plageErreur = function (el, correction, texte, verifie, segments) {
  const attendu = correction.word
    || verifie.slice(correction.offset, correction.offset + correction.length);
  const offset = Albert.findRealOffset(texte, correction, verifie);
  if (offset === -1) return null;
  const debut = Albert.findSegmentAt(segments, offset);
  const fin = Albert.findSegmentAt(segments, offset + attendu.length);
  if (!debut || !fin) return null;
  const plage = el.ownerDocument.createRange();
  try {
    plage.setStart(debut.node, debut.offset);
    plage.setEnd(fin.node, fin.offset);
  } catch (err) {
    /* Le DOM a changé depuis la construction de la table. */
    return null;
  }
  return plage;
};

/**
 * Souligne les erreurs d'un champ à DOM en mesurant leurs plages.
 *
 * L'overlay classique reproduit la mise en page du champ à partir d'un
 * texte à plat. Sur un éditeur riche, cette copie dérive : les sauts de
 * ligne de innerText s'effondrent sous le white-space du champ, les
 * marges entre paragraphes ne sont comptées nulle part, et le gras ou
 * un lien changent la largeur du texte. Sur un message de trois
 * paragraphes, les soulignements du deuxième tombaient déjà à côté.
 *
 * Ici, aucune reproduction : chaque erreur est convertie en plage DOM,
 * dont getClientRects() donne les rectangles réellement occupés, y
 * compris quand le mot est coupé en fin de ligne. Un rectangle vide est
 * posé sur chacun, la CSS des marques y trace le soulignement.
 *
 * @param {HTMLElement} el - Champ contenteditable.
 * @param {Object} state   - État du champ.
 */
Albert.renderMarquesRange = function (el, state) {
  const parent = Albert.positionedParent(el);
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }

  const conteneur = el.ownerDocument.createElement("div");
  conteneur.className = "albert-overlay albert-marques";
  parent.appendChild(conteneur);
  state.overlay = conteneur;

  /* Garder le focus dans le champ au clic sur un mot souligné : voir
     le commentaire de même objet dans renderOverlay. */
  conteneur.addEventListener("mousedown", (e) => e.preventDefault());

  const placer = () => {
    conteneur.textContent = "";
    const parentRect = parent.getBoundingClientRect();
    const texte = el.innerText || "";
    const verifie = state.checkedText || texte;
    const segments = Albert.buildInnerTextSegments(el);

    state.corrections.forEach((correction, idx) => {
      const plage = Albert.plageErreur(el, correction, texte, verifie, segments);
      if (!plage) return;
      for (const rect of plage.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        const marque = el.ownerDocument.createElement("span");
        marque.className = "albert-error albert-error-"
          + (correction.type || "grammar");
        marque.dataset.idx = idx;
        marque.style.cssText = "position:absolute;"
          + "left:" + (rect.left - parentRect.left) + "px;"
          + "top:" + (rect.top - parentRect.top) + "px;"
          + "width:" + rect.width + "px;"
          + "height:" + rect.height + "px;";
        marque.addEventListener("click", (e) => {
          e.stopPropagation();
          /* Relire la correction au clic, ne pas garder celle capturée
             au rendu : un remplacement recalibre les offsets des
             corrections restantes, et un objet périmé ferait viser une
             autre occurrence du même mot, ailleurs dans le texte. */
          const courante = state.corrections[idx];
          if (courante) Albert.showPopup(el, courante, marque);
        });
        conteneur.appendChild(marque);
      }
    });
  };

  placer();

  /* Un champ qui défile en interne emporte son texte sans que les
     marques suivent : les replacer, une fois par frame au plus. */
  let scrollRAF = null;
  state.scrollHandler = () => {
    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      scrollRAF = null;
      if (state.overlay === conteneur) placer();
    });
  };
  el.addEventListener("scroll", state.scrollHandler, { passive: true });
};

/*
 * Copie le style du champ sur l'overlay pour un alignement pixel-perfect.
 * Le principe : l'overlay doit avoir exactement la même zone de contenu
 * que le champ original, pour que le texte invisible occupe les mêmes
 * positions et que les soulignements tombent sur les bons mots.
 */
Albert.syncOverlayStyle = function (el, overlay) {
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const parentRect = Albert.positionedParent(el).getBoundingClientRect();

  /*
   * Positionner l'overlay au bord interne du champ (padding edge),
   * c'est-à-dire juste après la bordure du textarea.
   * On utilise getBoundingClientRect() (fractionnaire) pour la position,
   * et on ajoute la bordure du champ pour entrer dans la zone de contenu.
   */
  const parentCS = getComputedStyle(Albert.positionedParent(el));
  const parentBorderTop = parseFloat(parentCS.borderTopWidth) || 0;
  const parentBorderLeft = parseFloat(parentCS.borderLeftWidth) || 0;
  const elBorderTop = parseFloat(cs.borderTopWidth) || 0;
  const elBorderLeft = parseFloat(cs.borderLeftWidth) || 0;
  overlay.style.top = (rect.top - parentRect.top - parentBorderTop + elBorderTop) + "px";
  overlay.style.left = (rect.left - parentRect.left - parentBorderLeft + elBorderLeft) + "px";

  /*
   * Calculer la largeur interne exacte du textarea (contenu + padding,
   * sans bordure ni scrollbar) en préservant la précision sous-pixel.
   * - rect.width est fractionnaire (précision du rendu réel)
   * - les bordures sont fractionnaires (getComputedStyle)
   * - la scrollbar est entière (offsetWidth - clientWidth - bordures entières)
   */
  const elBorderRight = parseFloat(cs.borderRightWidth) || 0;
  const elBorderBottom = parseFloat(cs.borderBottomWidth) || 0;
  const scrollbarW = el.offsetWidth - el.clientWidth
    - Math.round(elBorderLeft) - Math.round(elBorderRight);
  const innerWidth = rect.width - elBorderLeft - elBorderRight - scrollbarW;
  const innerHeight = rect.height - elBorderTop - elBorderBottom;
  overlay.style.width = innerWidth + "px";
  overlay.style.height = innerHeight + "px";
  overlay.style.boxSizing = "border-box";

  /*
   * Copier toutes les propriétés qui influencent le rendu du texte.
   * Sans cette synchronisation, le texte de l'overlay se décale par rapport
   * au champ original et les soulignements ne tombent plus sur les bons mots.
   */
  const props = [
    /* Sens d'écriture */
    "direction", "writingMode", "unicodeBidi",
    /*
     * Espacement interne (inclus dans clientWidth, nécessaire pour
     * que le texte commence au même point que dans le textarea)
     */
    "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
    /* Alignement et transformation du texte */
    "textAlign", "textIndent", "textTransform", "textRendering",
    /* Retour à la ligne et césure */
    "whiteSpace", "wordBreak", "overflowWrap", "hyphens",
    /* Interligne et espacement entre caractères/mots */
    "lineHeight", "letterSpacing", "wordSpacing",
    /* Police de caractères et ses variantes (crénage, ligatures, etc.) */
    "fontFamily", "fontSize", "fontStyle", "fontWeight", "fontStretch",
    "fontKerning", "fontFeatureSettings",
    "fontVariant", "fontVariantCaps", "fontVariantLigatures", "fontVariantNumeric",
  ];
  props.forEach((p) => { overlay.style[p] = cs[p]; });

  /*
   * Cas particulier des <input> mono-ligne : le contrôle rend toujours
   * son texte sur une seule ligne qui défile horizontalement, quel que
   * soit son white-space calculé (le plus souvent "normal"). Copier ce
   * white-space sur l'overlay (un simple <div>) le ferait replier sur
   * plusieurs lignes : les soulignements tomberaient au mauvais endroit
   * et, faute de débordement horizontal, la synchro
   * overlay.scrollLeft = el.scrollLeft deviendrait inopérante (le texte
   * ne suivrait plus le défilement aux flèches gauche/droite).
   * On force donc une ligne unique pour reproduire le rendu de l'input.
   */
  if (el.tagName === "INPUT") {
    overlay.style.whiteSpace = "pre";
    overlay.style.wordBreak = "normal";
    overlay.style.overflowWrap = "normal";
  }

};

/*
 * Construit le DOM de l'overlay : texte normal (invisible) + spans colorés
 * aux positions des erreurs. Le texte est découpé selon les offsets :
 *
 *   "Bonjour le mondde !"
 *    ^^^^^^^^^^^^^^^      -> TextNode (texte correct, invisible)
 *                   ^^^^^^ -> <span class="albert-error"> (souligné)
 *                         ^^ -> TextNode (reste du texte)
 */
Albert.buildHighlightedDOM = function (container, text, corrections) {
  container.textContent = "";

  /*
   * Trier les corrections par position dans le texte (début -> fin)
   * et conserver l'index original pour retrouver la correction au clic.
   * Les offsets sont déjà recalibrés en amont (recalibrateOffsets).
   */
  const sorted = corrections
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => a.offset - b.offset);

  let cursor = 0; /* position courante dans le texte */

  for (const c of sorted) {
    /* Ignorer les corrections qui chevauchent la précédente */
    if (c.offset < cursor) {
      continue;
    }

    /* Ajouter le texte normal entre la position courante et l'erreur */
    if (c.offset > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, c.offset)));
    }

    /* Créer le span d'erreur avec le type (spelling, grammar, style) */
    const span = document.createElement("span");
    span.className = `albert-error albert-error-${c.type || "grammar"}`;
    span.dataset.idx = c.idx;
    span.textContent = text.slice(c.offset, c.offset + c.length);
    container.appendChild(span);

    cursor = c.offset + c.length;
  }

  /* Ajouter le texte restant après la dernière erreur */
  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }
};
