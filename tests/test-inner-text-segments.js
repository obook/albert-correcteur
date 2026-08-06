/*
 * test-inner-text-segments.js
 * Tests unitaires.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */
/* Tests -- Correspondance innerText <-> nœuds texte (inner-text.js).
 *
 * L'algorithme aligne les nœuds texte sur le innerText réel de la
 * racine : chaque cas fournit donc l'arbre ET le innerText mesuré dans
 * Firefox sur un élément contenteditable réel (il n'est pas déduit).
 * Exemple : "<p>a</p><p>b</p>" donne "a\n\nb" et non "a\nb".
 *
 * Invariants vérifiés :
 *   - chaque segment retrouve exactement son texte des deux côtés
 *     (innerText[start..end] == node.textContent[nodeStart..]) ;
 *   - tout caractère non blanc de innerText est couvert par un segment.
 */

const assert = require("assert");
const path = require("path");

/* ---------------------------------------------------------------
 * DOM minimal : de quoi exécuter le parcours sans dépendance externe.
 * --------------------------------------------------------------- */

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

global.Node = { TEXT_NODE, ELEMENT_NODE };
global.getComputedStyle = (el) => ({ display: el.display || "block" });

function texte(contenu) {
  return { nodeType: TEXT_NODE, textContent: contenu, childNodes: [] };
}

function element(tagName, enfants, options) {
  return Object.assign({
    nodeType: ELEMENT_NODE,
    tagName: tagName.toUpperCase(),
    childNodes: enfants || [],
    hidden: false,
  }, options || {});
}

const { construireSegmentsInnerText } =
  require(path.join(__dirname, "..", "sources-commun", "util", "inner-text.js"));

const BLANC = /[ \t\n\r\u00A0]/;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

/* Construit la table sur l'arbre et vérifie les deux invariants. */
function verifier(nom, racine, innerTextMesure) {
  test(nom + " --- " + JSON.stringify(innerTextMesure), () => {
    racine.innerText = innerTextMesure;
    const segments = construireSegmentsInnerText(racine);

    const couverts = new Array(innerTextMesure.length).fill(false);
    for (const seg of segments) {
      const longueur = seg.end - seg.start;
      assert.strictEqual(
        innerTextMesure.slice(seg.start, seg.end),
        seg.node.textContent.substr(seg.nodeStart, longueur),
        `segment @${seg.start} désaligné`
      );
      for (let i = seg.start; i < seg.end; i++) couverts[i] = true;
    }
    for (let i = 0; i < innerTextMesure.length; i++) {
      if (!BLANC.test(innerTextMesure[i])) {
        assert.ok(couverts[i], `caractère non couvert @${i} (${JSON.stringify(innerTextMesure[i])})`);
      }
    }
    return segments;
  });
}

console.log("Correspondance innerText <-> nœuds texte :");

verifier(
  "Deux paragraphes",
  element("div", [
    element("p", [texte("a")]),
    element("p", [texte("b")]),
  ]),
  "a\n\nb"
);

verifier(
  "Deux div",
  element("div", [
    element("div", [texte("a")]),
    element("div", [texte("b")]),
  ]),
  "a\nb"
);

verifier(
  "Paragraphe vide en tête",
  element("div", [
    element("p", [element("br", [])]),
    element("p", [texte("texte")]),
  ]),
  "\n\n\ntexte"
);

verifier(
  "Paragraphe vide au milieu",
  element("div", [
    element("p", [texte("a")]),
    element("p", [element("br", [])]),
    element("p", [texte("b")]),
  ]),
  "a\n\n\n\n\nb"
);

verifier(
  "Blocs imbriqués",
  element("div", [
    element("div", [element("p", [texte("a")])]),
    element("p", [texte("b")]),
  ]),
  "a\n\nb"
);

verifier(
  "Éléments de liste",
  element("div", [
    element("ul", [
      element("li", [texte("alpha")]),
      element("li", [texte("beta")]),
    ]),
  ]),
  "alpha\nbeta"
);

verifier(
  "Balises en ligne dans un paragraphe",
  element("div", [
    element("p", [texte("Bonjour "), element("b", [texte("le")], { display: "inline" }), texte(" monde")]),
    element("p", [texte("Suite")]),
  ]),
  "Bonjour le monde\n\nSuite"
);

verifier(
  "Saut de ligne explicite",
  element("div", [texte("a"), element("br", []), texte("b")]),
  "a\nb"
);

verifier(
  "Contenu masqué ignoré",
  element("div", [
    element("div", [
      texte("x"),
      element("span", [texte("CACHE")], { display: "none" }),
      texte("y"),
    ]),
  ]),
  "xy"
);

verifier(
  "Paragraphe unique sans saut final",
  element("div", [element("p", [texte("a")])]),
  "a"
);

/* --- Cas du bug du 6 août : blancs de mise en forme du HTML --- */

verifier(
  "Nœuds texte de mise en forme entre les blocs",
  /* HTML sérialisé d'une réponse : retours à la ligne et indentation
     entre les <div>, absents de innerText mais comptés par l'ancien
     algorithme (dérive d'un caractère ou plus par bloc). */
  element("div", [
    texte("\n  "),
    element("div", [texte("a")]),
    texte("\n  "),
    element("div", [texte("b")]),
    texte("\n"),
  ]),
  "a\nb"
);

verifier(
  "Citation indentée dans une réponse",
  element("div", [
    element("div", [texte("Voici ma réponse.")]),
    texte("\n"),
    element("blockquote", [
      texte("\n  "),
      element("div", [texte("Texte cité.")]),
      texte("\n"),
    ]),
  ]),
  "Voici ma réponse.\nTexte cité."
);

test("Blancs de tête effondrés : nodeStart pointe le premier caractère rendu", () => {
  const noeud = texte("\n    Texte");
  const racine = element("div", [element("p", [noeud])]);
  racine.innerText = "Texte";
  const segments = construireSegmentsInnerText(racine);
  assert.strictEqual(segments.length, 1);
  assert.strictEqual(segments[0].start, 0);
  assert.strictEqual(segments[0].end, 5);
  assert.strictEqual(segments[0].nodeStart, 5);
  /* La conversion globale -> locale doit viser le "T" du nœud. */
  assert.strictEqual(noeud.textContent[0 - segments[0].start + segments[0].nodeStart], "T");
});

test("Blanc intérieur effondré : le nœud produit deux segments exacts", () => {
  const racine = element("div", [texte("a\n b")]);
  racine.innerText = "a b";
  const segments = construireSegmentsInnerText(racine);
  for (const seg of segments) {
    assert.strictEqual(
      racine.innerText.slice(seg.start, seg.end),
      seg.node.textContent.substr(seg.nodeStart, seg.end - seg.start)
    );
  }
  /* "a" puis " b" : le "b" reste adressable à son offset réel. */
  const dernier = segments[segments.length - 1];
  assert.strictEqual(racine.innerText.slice(dernier.start, dernier.end).includes("b"), true);
});

verifier(
  "Espace insécable conservé tel quel",
  element("div", [element("p", [texte("mot\u00A0suivant")])]),
  "mot\u00A0suivant"
);

test("Nœud entièrement effondré : aucun segment", () => {
  const racine = element("div", [
    texte("\n   \n"),
  ]);
  racine.innerText = "";
  assert.strictEqual(construireSegmentsInnerText(racine).length, 0);
});

test("Long courriel : le dernier paragraphe reste aligné", () => {
  /* Le défaut historique décalait la table d'un caractère ou plus par
     bloc : au-delà d'une dizaine de paragraphes, les erreurs de fin de
     message n'étaient plus soulignées au bon endroit. Les nœuds de mise
     en forme intercalés reproduisent le HTML sérialisé d'un compose. */
  const contenus = [];
  for (let i = 0; i < 12; i++) contenus.push("Paragraphe numéro " + i);
  const enfants = [];
  for (const c of contenus) {
    enfants.push(texte("\n  "));
    enfants.push(element("p", [texte(c)]));
  }
  const racine = element("div", enfants);
  racine.innerText = contenus.join("\n\n");
  const segments = construireSegmentsInnerText(racine);
  const dernier = segments[segments.length - 1];
  assert.strictEqual(
    racine.innerText.slice(dernier.start, dernier.end),
    "Paragraphe numéro 11"
  );
  const attendu = contenus
    .slice(0, 11)
    .reduce((total, c) => total + c.length + 2, 0);
  assert.strictEqual(dernier.start, attendu);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
