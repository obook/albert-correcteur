/* albert-render-overlay.js - Overlay transparent pour textarea, input et editeurs riches.
   Positionne par-dessus le champ, affiche les soulignements sans modifier le contenu. */

"use strict";

/*
 * Cree et positionne un overlay transparent par-dessus le champ de saisie.
 * L'overlay reproduit le meme texte en invisible, avec des <span> colores
 * aux positions des erreurs pour afficher les soulignements.
 */
Albert.renderOverlay = function (el, state) {
  /* Nettoyer l'overlay et le listener de scroll precedents */
  if (state.overlay) state.overlay.remove();
  if (state.scrollHandler) {
    el.removeEventListener("scroll", state.scrollHandler);
    state.scrollHandler = null;
  }

  /* Aucune erreur : pas d'overlay necessaire */
  if (state.corrections.length === 0) {
    state.overlay = null;
    return;
  }

  /* Creer le div overlay et copier les styles du champ cible */
  const overlay = document.createElement("div");
  overlay.className = "albert-overlay";
  Albert.syncOverlayStyle(el, overlay);

  /* Remplir l'overlay avec le texte + spans d'erreur */
  const text = Albert.getTextContent(el);
  Albert.buildHighlightedDOM(overlay, text, state.corrections);

  /*
   * Inserer l'overlay dans le parent positionne du champ.
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
   * Synchroniser le defilement de l'overlay avec celui du champ.
   * Le throttle via requestAnimationFrame evite les appels excessifs
   * lors d'un scroll rapide (1 mise a jour par frame au maximum).
   */
  overlay.scrollTop = el.scrollTop;
  overlay.scrollLeft = el.scrollLeft;
  let scrollRAF = null;
  state.scrollHandler = () => {
    if (scrollRAF) return;
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
 * Le principe : l'overlay doit avoir exactement la meme zone de contenu
 * que le champ original, pour que le texte invisible occupe les memes
 * positions et que les soulignements tombent sur les bons mots.
 */
Albert.syncOverlayStyle = function (el, overlay) {
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const parentRect = (el.offsetParent || document.body).getBoundingClientRect();

  /*
   * Positionner l'overlay au bord interne du champ (padding edge),
   * c'est-a-dire juste apres la bordure du textarea.
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
   * sans bordure ni scrollbar) en preservant la precision sous-pixel.
   * - rect.width est fractionnaire (precision du rendu reel)
   * - les bordures sont fractionnaires (getComputedStyle)
   * - la scrollbar est entiere (offsetWidth - clientWidth - bordures entieres)
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
   * Copier toutes les proprietes qui influencent le rendu du texte.
   * Sans cette synchronisation, le texte de l'overlay se decale par rapport
   * au champ original et les soulignements ne tombent plus sur les bons mots.
   */
  const props = [
    /* Sens d'ecriture */
    "direction", "writingMode", "unicodeBidi",
    /*
     * Espacement interne (inclus dans clientWidth, necessaire pour
     * que le texte commence au meme point que dans le textarea)
     */
    "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
    /* Alignement et transformation du texte */
    "textAlign", "textIndent", "textTransform", "textRendering",
    /* Retour a la ligne et cesure */
    "whiteSpace", "wordBreak", "overflowWrap", "hyphens",
    /* Interligne et espacement entre caracteres/mots */
    "lineHeight", "letterSpacing", "wordSpacing",
    /* Police de caracteres et ses variantes (crenage, ligatures, etc.) */
    "fontFamily", "fontSize", "fontStyle", "fontWeight", "fontStretch",
    "fontKerning", "fontFeatureSettings",
    "fontVariant", "fontVariantCaps", "fontVariantLigatures", "fontVariantNumeric",
  ];
  props.forEach((p) => { overlay.style[p] = cs[p]; });

  /*
   * Editeurs riches (CKEditor, etc.) : le contenu est dans des elements
   * bloc (<p>, <div>) qui ont des marges verticales. L'overlay est du texte
   * plat sans ces marges, donc il commence plus haut que le texte reel.
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
 * Construit le DOM de l'overlay : texte normal (invisible) + spans colores
 * aux positions des erreurs. Le texte est decoupe selon les offsets :
 *
 *   "Bonjour le mondde !"
 *    ^^^^^^^^^^^^^^^      -> TextNode (texte correct, invisible)
 *                   ^^^^^^ -> <span class="albert-error"> (souligne)
 *                         ^^ -> TextNode (reste du texte)
 */
Albert.buildHighlightedDOM = function (container, text, corrections) {
  container.textContent = "";

  /*
   * Trier les corrections par position dans le texte (debut -> fin)
   * et conserver l'index original pour retrouver la correction au clic.
   * Les offsets sont deja recalibres en amont (recalibrateOffsets).
   */
  const sorted = corrections
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => a.offset - b.offset);

  let cursor = 0; /* position courante dans le texte */

  for (const c of sorted) {
    /* Ignorer les corrections qui chevauchent la precedente */
    if (c.offset < cursor) continue;

    /* Ajouter le texte normal entre la position courante et l'erreur */
    if (c.offset > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, c.offset)));
    }

    /* Creer le span d'erreur avec le type (spelling, grammar, style) */
    const span = document.createElement("span");
    span.className = `albert-error albert-error-${c.type || "grammar"}`;
    span.dataset.idx = c.idx;
    span.textContent = text.slice(c.offset, c.offset + c.length);
    container.appendChild(span);

    cursor = c.offset + c.length;
  }

  /* Ajouter le texte restant apres la derniere erreur */
  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }
};
