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
 * Date : Avril 2026
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
  const parent = el.offsetParent || document.body;
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

  /* Rendre chaque span d'erreur cliquable pour ouvrir la popup de correction */
  overlay.querySelectorAll(".albert-error").forEach((mark) => {
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(mark.dataset.idx, 10);
      Albert.showPopup(el, state.corrections[idx], mark);
    });
  });
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
  const parentRect = (el.offsetParent || document.body).getBoundingClientRect();

  /*
   * Positionner l'overlay au bord interne du champ (padding edge),
   * c'est-à-dire juste après la bordure du textarea.
   * On utilise getBoundingClientRect() (fractionnaire) pour la position,
   * et on ajoute la bordure du champ pour entrer dans la zone de contenu.
   */
  const parentCS = getComputedStyle(el.offsetParent || document.body);
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
   * Éditeurs riches (CKEditor, etc.) : le contenu est dans des éléments
   * bloc (<p>, <div>) qui ont des marges verticales. L'overlay est du texte
   * plat sans ces marges, donc il commence plus haut que le texte réel.
   * On compense en ajoutant la marge du premier bloc comme padding-top.
   */
  if (Albert.isRichEditor(el)) {
    const firstBlock = el.querySelector("p, div, h1, h2, h3, h4, h5, h6, li");
    if (firstBlock) {
      const blockCS = getComputedStyle(firstBlock);
      const extraTop = parseFloat(blockCS.marginTop) || 0;
      overlay.style.paddingTop = (parseFloat(cs.paddingTop) + extraTop) + "px";
    }
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
