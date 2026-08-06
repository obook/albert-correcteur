/*
 * inner-text.js - Correspondance entre les offsets de innerText et les
 * nœuds texte du DOM.
 *
 * Le texte envoyé à l'API est celui de innerText. Pour placer un
 * soulignement ou remplacer un mot, il faut convertir un offset de
 * caractère en position { nœud texte, offset local }. Or innerText
 * n'est pas la concaténation des nœuds texte : les éléments de type
 * bloc y insèrent des sauts de ligne qui n'existent pas dans l'arbre,
 * et les blancs de mise en forme du HTML (retours à la ligne entre
 * deux <div> d'un courriel sérialisé, indentation) existent dans
 * l'arbre mais pas dans innerText.
 *
 * Une première version émulait la spécification (sauts de ligne par
 * type de balise, fusion des demandes consécutives). Elle ignorait les
 * nœuds texte de pure mise en forme : chacun décalait la table, et sur
 * une longue réponse Thunderbird la dérive atteignait des dizaines de
 * caractères, soulignements et remplacements tombaient à côté.
 *
 * L'algorithme actuel ne devine plus, il mesure : il lit le innerText
 * réel de la racine et y aligne les nœuds texte avec deux curseurs.
 * Caractère identique, les deux curseurs avancent ; blanc côté nœud
 * sans correspondance (blanc effondré par le CSS), le curseur du nœud
 * avance seul ; blanc côté innerText sans correspondance (saut de
 * ligne de bloc), le curseur d'innerText avance seul ; désaccord entre
 * deux caractères non blancs, l'alignement s'arrête et la table reste
 * valable jusque-là. L'espace insécable compte comme un blanc. Même
 * principe que la correspondance texte brut / texte soumis des
 * correcteurs du commerce.
 *
 * Chaque segment est un passage contigu des deux côtés :
 *   { node, start, end, nodeStart }
 * où start et end sont des offsets dans innerText et nodeStart l'offset
 * du premier caractère aligné dans node.textContent. La conversion d'un
 * offset global vaut donc : offsetLocal = global - start + nodeStart.
 * Un nœud dont des blancs intérieurs sont effondrés produit plusieurs
 * segments ; un nœud entièrement effondré n'en produit aucun.
 *
 * Utilisé par :
 *   - Firefox     : albert-apply-segments.js, albert-apply-rich.js
 *   - Thunderbird : compose-overlay.js, compose-apply.js
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

/* Balises dont le contenu n'apparaît jamais dans innerText. */
const BALISES_INVISIBLES = { SCRIPT: true, STYLE: true, NOSCRIPT: true, TEMPLATE: true };

/* Blancs susceptibles d'être effondrés ou insérés par le rendu. */
const BLANCS = { " ": true, "\t": true, "\n": true, "\r": true, "\u00A0": true };

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
 * @returns {Array<{node: Text, start: number, end: number, nodeStart: number}>}
 *          Segments ordonnés ; start et end sont des offsets dans
 *          racine.innerText, nodeStart un offset dans node.textContent.
 */
function construireSegmentsInnerText(racine) {
  const texte = racine.innerText;
  const segments = [];
  let pos = 0;      /* curseur dans innerText */
  let arret = false;

  /* Aligne un nœud texte sur innerText à partir du curseur courant. */
  function aligner(node) {
    const contenu = node.textContent;
    let i = 0;
    let debut = -1;      /* start du segment en cours, -1 si aucun */
    let debutNoeud = 0;

    function fermer() {
      if (debut !== -1) {
        segments.push({ node: node, start: debut, end: pos, nodeStart: debutNoeud });
        debut = -1;
      }
    }

    while (i < contenu.length) {
      const c = contenu[i];
      if (pos < texte.length && c === texte[pos]) {
        if (debut === -1) {
          debut = pos;
          debutNoeud = i;
        }
        pos++;
        i++;
      } else if (BLANCS[c]) {
        /* Blanc du nœud effondré par le rendu. */
        fermer();
        i++;
      } else if (pos < texte.length && BLANCS[texte[pos]]) {
        /* Saut de ligne de bloc ou blanc inséré par le rendu. */
        fermer();
        pos++;
      } else {
        /* Deux caractères non blancs en désaccord : innerText a été
           produit par un mécanisme que cet alignement ne couvre pas.
           La table reste valable jusqu'ici. */
        fermer();
        arret = true;
        return;
      }
    }
    fermer();
  }

  function parcourir(noeud) {
    for (const enfant of noeud.childNodes) {
      if (arret) return;
      if (enfant.nodeType === Node.TEXT_NODE) {
        if (enfant.textContent.length > 0) aligner(enfant);
        continue;
      }
      if (enfant.nodeType !== Node.ELEMENT_NODE) continue;
      if (estMasque(enfant)) continue;
      parcourir(enfant);
    }
  }

  parcourir(racine);
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
