/*
 * inner-text.js - Correspondance entre les offsets de innerText et les
 * nœuds texte du DOM.
 *
 * Le texte envoyé à l'API est celui de innerText. Pour placer un
 * soulignement ou remplacer un mot, il faut convertir un offset de
 * caractère en position { nœud texte, offset local }. Or innerText
 * n'est pas la simple concaténation des nœuds texte : les éléments de
 * type bloc y insèrent des sauts de ligne qui n'existent nulle part
 * dans l'arbre.
 *
 * L'algorithme reproduit celui de la spécification HTML, mesuré et
 * vérifié sur Gecko :
 *   - un <br> produit exactement un saut de ligne ;
 *   - un élément bloc demande un saut de ligne avant et après lui,
 *     deux dans le cas d'un <p> ;
 *   - les demandes consécutives fusionnent en prenant le maximum,
 *     elles ne s'additionnent pas ;
 *   - les demandes en tête et en fin de contenu sont ignorées ;
 *   - un élément non rendu (display:none) ne produit rien.
 *
 * Concrètement, "<p>a</p><p>b</p>" donne "a\n\nb" et non "a\nb", et
 * "<p><br></p><p>texte</p>" donne "\n\n\ntexte". Compter un seul saut
 * de ligne par bloc décalait tous les offsets suivants, d'autant plus
 * que le texte comptait de paragraphes.
 *
 * Utilisé par :
 *   - Firefox     : albert-apply-segments.js, albert-apply-rich.js
 *   - Thunderbird : compose-overlay.js
 *
 * Auteur : O. Booklage
 * Date : Août 2026
 * Licence : MIT
 */

"use strict";

/* Nombre de sauts de ligne demandés de part et d'autre d'un élément,
   par nom de balise. Les balises absentes sont considérées comme
   n'étant pas des blocs, sauf si le style calculé dit le contraire. */
const SAUTS_PAR_BALISE = {
  P: 2,
  DIV: 1, SECTION: 1, ARTICLE: 1, ASIDE: 1, NAV: 1, HEADER: 1, FOOTER: 1,
  MAIN: 1, FIGURE: 1, FIGCAPTION: 1, BLOCKQUOTE: 1, PRE: 1, ADDRESS: 1,
  H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
  UL: 1, OL: 1, LI: 1, DL: 1, DT: 1, DD: 1,
  TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1,
  FORM: 1, FIELDSET: 1, LEGEND: 1, HR: 1, DETAILS: 1, SUMMARY: 1,
};

/* Balises dont le contenu n'apparaît jamais dans innerText. */
const BALISES_INVISIBLES = { SCRIPT: true, STYLE: true, NOSCRIPT: true, TEMPLATE: true };

/**
 * Détermine combien de sauts de ligne un élément demande avant et après lui.
 *
 * @param {Element} el - Élément examiné.
 * @returns {number} 0 s'il est en ligne, 1 ou 2 s'il est de type bloc.
 */
function sautsDemandes(el) {
  const connu = SAUTS_PAR_BALISE[el.tagName];
  if (connu !== undefined) return connu;

  /* Balise inconnue (composant web, <span> passé en bloc par CSS) :
     se fier au style calculé. */
  let display = "";
  try {
    display = getComputedStyle(el).display;
  } catch (_) {
    return 0;
  }
  if (display.startsWith("inline") && display !== "inline-block") return 0;
  if (display === "contents" || display === "none") return 0;
  return 1;
}

/**
 * Indique si un élément est masqué et donc absent de innerText.
 *
 * @param {Element} el - Élément examiné.
 * @returns {boolean} true si l'élément et son contenu ne sont pas rendus.
 */
function estMasque(el) {
  if (BALISES_INVISIBLES[el.tagName]) return true;
  if (el.hidden) return true;
  try {
    return getComputedStyle(el).display === "none";
  } catch (_) {
    return false;
  }
}

/**
 * Construit la table de correspondance entre innerText et les nœuds texte.
 *
 * @param {HTMLElement} racine - Élément contenteditable ou corps de message.
 * @returns {Array<{node: Text, start: number, end: number}>} Segments ordonnés,
 *          où start et end sont des offsets dans racine.innerText.
 */
function construireSegmentsInnerText(racine) {
  /* Première passe : produire la suite des éléments de texte et des
     demandes de saut de ligne, dans l'ordre du document. */
  const elements = [];

  function parcourir(noeud) {
    for (const enfant of noeud.childNodes) {
      if (enfant.nodeType === Node.TEXT_NODE) {
        if (enfant.textContent.length > 0) {
          elements.push({ type: "texte", node: enfant });
        }
        continue;
      }
      if (enfant.nodeType !== Node.ELEMENT_NODE) continue;
      if (estMasque(enfant)) continue;

      if (enfant.tagName === "BR") {
        elements.push({ type: "saut" });
        continue;
      }

      const sauts = sautsDemandes(enfant);
      if (sauts > 0) elements.push({ type: "demande", n: sauts });
      parcourir(enfant);
      if (sauts > 0) elements.push({ type: "demande", n: sauts });
    }
  }

  parcourir(racine);

  /* Seconde passe : convertir en offsets. Les demandes consécutives
     fusionnent (maximum), celles de tête et de fin sont ignorées. */
  const segments = [];
  let offset = 0;
  let demandeEnAttente = 0;
  let texteEmis = false;

  for (const element of elements) {
    if (element.type === "demande") {
      if (texteEmis) demandeEnAttente = Math.max(demandeEnAttente, element.n);
      continue;
    }

    /* Un <br> ou un nœud texte solde les demandes accumulées. */
    offset += demandeEnAttente;
    demandeEnAttente = 0;

    if (element.type === "saut") {
      offset += 1;
      texteEmis = true;
      continue;
    }

    const longueur = element.node.textContent.length;
    segments.push({ node: element.node, start: offset, end: offset + longueur });
    offset += longueur;
    texteEmis = true;
  }

  return segments;
}

/* Le namespace Albert existe côté content script (Firefox) comme côté
   compose script (Thunderbird) ; ce module est chargé avant ses appelants. */
if (typeof window !== "undefined") {
  window.Albert = window.Albert || {};
  window.Albert.buildInnerTextSegments = construireSegmentsInnerText;
}

/* Export pour les tests Node. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { construireSegmentsInnerText };
}
