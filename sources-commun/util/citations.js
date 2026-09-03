/*
 * citations.js - Repérage du texte cité dans un corps de message.
 *
 * Une réponse ou un transfert contient trois sortes de texte : ce que
 * l'utilisateur écrit, ce qu'il cite, et sa signature. Seul le premier
 * mérite d'être corrigé. Envoyer le reste à l'API coûte des jetons,
 * ralentit la vérification et disperse le modèle : sur une réponse
 * ordinaire, la citation pèse plus de neuf dixièmes du texte soumis.
 *
 * Le repérage s'appuie sur la table de correspondance de inner-text.js :
 * chaque segment connaît son nœud texte, il suffit de remonter ses
 * parents pour savoir s'il appartient à une citation. Les intervalles
 * obtenus sont des offsets dans racine.innerText, comme partout ailleurs.
 *
 * Le texte soumis est la concaténation des intervalles conservés. Les
 * offsets renvoyés par l'API valent donc pour ce texte réduit et doivent
 * être ramenés vers innerText avant tout affichage : c'est le rôle de
 * ramenerOffsets(), sans quoi soulignements et remplacements tomberaient
 * à côté.
 *
 * Marqueurs reconnus :
 *   - blockquote[type=cite] : citation posée par le client de messagerie ;
 *   - moz-signature         : signature HTML ;
 *   - moz-txt-sig           : signature en composition texte brut ;
 *   - moz-forward-container : corps d'un message transféré ;
 *   - data-marker           : équivalents Zimbra.
 *
 * Deux marqueurs sont volontairement absents de cette liste.
 *
 * La ligne « Le ..., X a écrit : » (moz-cite-prefix) est un simple div
 * d'une ligne, placé exactement là où l'on colle son texte quand on écrit
 * au-dessus de la citation : Thunderbird range alors la frappe dans ce
 * div, et l'écarter revenait à jeter tout le message rédigé. Les quelques
 * dizaines de caractères qu'elle coûte valent mieux que ce silence.
 *
 * Un blockquote sans type="cite" n'est pas une citation de courriel mais
 * un bloc collé depuis une page web, à corriger comme le reste. Les
 * webmails qui citent sans cet attribut demanderont leurs propres
 * sélecteurs, le jour où cette exclusion sera branchée côté Firefox.
 *
 * Utilisé par :
 *   - Thunderbird : compose-utils.js, compose-check.js
 *
 * Auteur : O. Booklage
 * Date : septembre 2026
 * Licence : MIT
 */

"use strict";

/* Classes posées par Thunderbird sur les parties non rédigées. La liste
   vient de son propre code : cloudAttachmentLinkManager.js interroge
   .moz-signature et .moz-forward-container, QuoteSanitizer.sys.mjs cible
   blockquote[type="cite"] et .moz-forward-container, et messageQuotes.css
   style div.moz-txt-sig, la forme que prend la signature en composition
   texte brut. */
const CLASSES_CITATION = [
  "moz-signature",
  "moz-txt-sig",
  "moz-forward-container",
];

/* Zimbra ne pose pas de classe mais un attribut sur les mêmes blocs. */
const MARQUEURS_CITATION = {
  __QUOTED_TEXT__: true,
  __DIVIDER__: true,
  __SIG__: true,
};

/**
 * Indique pourquoi un élément est considéré comme non rédigé.
 *
 * @param {Element} el - Élément examiné.
 * @returns {string|null} Marqueur reconnu, ou null si l'élément est neutre.
 */
function motifCitation(el) {
  /* getAttribute manque au DOM minimal des tests : son absence vaut
     "pas d'attribut", pas une exception. */
  const attribut = (nom) => (el.getAttribute ? el.getAttribute(nom) : null);

  if (el.tagName === "BLOCKQUOTE" && attribut("type") === "cite") return "citation";

  const classes = " " + (el.className || "") + " ";
  for (const classe of CLASSES_CITATION) {
    if (classes.indexOf(" " + classe + " ") !== -1) return classe;
  }

  const marqueur = attribut("data-marker");
  if (marqueur && MARQUEURS_CITATION[marqueur]) return marqueur;

  return null;
}

/**
 * Remonte les parents d'un nœud jusqu'à la racine à la recherche d'un
 * marqueur de citation.
 *
 * La remontée est manuelle plutôt que par closest() : elle s'arrête à la
 * racine du corps du message, et elle reste utilisable sur le DOM
 * minimal des tests, qui n'implémente pas closest().
 *
 * @param {Node} node - Nœud texte de départ.
 * @param {HTMLElement} racine - Corps du message.
 * @returns {string|null} Marqueur trouvé, ou null.
 */
function motifAncetre(node, racine) {
  let el = node.parentNode;
  while (el && el !== racine) {
    const motif = motifCitation(el);
    if (motif) return motif;
    el = el.parentNode;
  }
  return null;
}

/**
 * Renvoie les intervalles de innerText occupés par du texte cité.
 *
 * @param {HTMLElement} racine - Corps du message.
 * @returns {Array<{debut: number, fin: number, motif: string}>} Intervalles ordonnés.
 */
function zonesCitees(racine) {
  const segments = window.Albert.buildInnerTextSegments(racine);
  const zones = [];

  for (const segment of segments) {
    const motif = motifAncetre(segment.node, racine);
    if (!motif) continue;

    /* Deux segments voisins d'une même citation forment un seul
       intervalle : le saut de ligne qui les sépare dans innerText
       appartient à la citation, pas au texte rédigé. */
    const precedent = zones[zones.length - 1];
    if (precedent && precedent.motif === motif && segment.start <= precedent.fin + 2) {
      precedent.fin = segment.end;
      continue;
    }
    zones.push({ debut: segment.start, fin: segment.end, motif: motif });
  }

  return zones;
}

/**
 * Découpe le corps du message en gardant le seul texte rédigé.
 *
 * @param {HTMLElement} racine - Corps du message.
 * @returns {{texte: string, gardees: Array<{debut: number, fin: number}>}}
 *          Texte à soumettre et intervalles retenus dans racine.innerText.
 */
function texteHorsCitation(racine) {
  const complet = racine.innerText;
  const zones = zonesCitees(racine);
  const gardees = [];
  let position = 0;

  for (const zone of zones) {
    if (zone.debut > position) gardees.push({ debut: position, fin: zone.debut });
    position = Math.max(position, zone.fin);
  }
  if (position < complet.length) gardees.push({ debut: position, fin: complet.length });

  /* Entre deux citations il ne reste souvent que des sauts de ligne :
     les garder ferait commencer le texte soumis par des lignes vides,
     sans rien apporter au modèle. Les retirer ne dérègle pas les
     offsets, la table des intervalles restant explicite. */
  const utiles = gardees.filter((g) => complet.slice(g.debut, g.fin).trim().length > 0);

  /* Les blancs de tête et de queue du texte soumis ne servent à rien non
     plus. Seuls ceux des extrémités sont rognés : ceux qui séparent deux
     intervalles conservés tiennent lieu de séparateur de paragraphe, et
     les remplacer par autre chose décalerait les offsets. */
  if (utiles.length > 0) {
    const premier = utiles[0];
    while (premier.debut < premier.fin && !complet[premier.debut].trim()) premier.debut++;
    const dernier = utiles[utiles.length - 1];
    while (dernier.fin > dernier.debut && !complet[dernier.fin - 1].trim()) dernier.fin--;
  }

  return {
    texte: utiles.map((g) => complet.slice(g.debut, g.fin)).join(""),
    gardees: utiles,
  };
}

/**
 * Convertit un offset du texte soumis en offset dans innerText.
 *
 * @param {number} offset - Position dans le texte soumis à l'API.
 * @param {Array<{debut: number, fin: number}>} gardees - Intervalles retenus.
 * @returns {number} Position dans racine.innerText, ou -1 hors limites.
 */
function offsetVersRacine(offset, gardees) {
  let reste = offset;
  for (const intervalle of gardees) {
    const longueur = intervalle.fin - intervalle.debut;
    if (reste < longueur) return intervalle.debut + reste;
    reste -= longueur;
  }
  return -1;
}

/**
 * Ramène les offsets d'une liste de corrections vers innerText.
 *
 * Les corrections dont l'offset ne retombe dans aucun intervalle sont
 * écartées : mieux vaut une correction manquante qu'un soulignement
 * posé au hasard dans le message.
 *
 * @param {Array<Object>} corrections - Corrections renvoyées par l'API.
 * @param {Array<{debut: number, fin: number}>} gardees - Intervalles retenus.
 * @returns {Array<Object>} Corrections aux offsets ramenés.
 */
function ramenerOffsets(corrections, gardees) {
  if (!corrections || !corrections.length) return corrections;
  const ramenees = [];
  for (const correction of corrections) {
    const offset = offsetVersRacine(correction.offset, gardees);
    if (offset === -1) continue;
    ramenees.push(Object.assign({}, correction, { offset: offset }));
  }
  return ramenees;
}

/* Même point d'accrochage que util/inner-text.js : le namespace Albert
   existe côté content script comme côté compose script. */
if (typeof window !== "undefined") {
  window.Albert = window.Albert || {};
  window.Albert.zonesCitees = zonesCitees;
  window.Albert.texteHorsCitation = texteHorsCitation;
  window.Albert.offsetVersRacine = offsetVersRacine;
  window.Albert.ramenerOffsets = ramenerOffsets;
}

/* Export pour les tests Node. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { zonesCitees, texteHorsCitation, offsetVersRacine, ramenerOffsets };
}
