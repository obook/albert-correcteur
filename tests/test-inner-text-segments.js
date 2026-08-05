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
 * Les valeurs attendues ne sont pas déduites de la spécification : elles
 * ont été mesurées dans Firefox sur un élément contenteditable réel.
 * Exemple : "<p>a</p><p>b</p>" donne "a\n\nb" et non "a\nb".
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

/* Reconstitue le texte que innerText produirait, à partir des segments :
   chaque segment est posé à son offset, les trous sont des sauts de ligne. */
function texteReconstitue(segments) {
  let sortie = "";
  for (const seg of segments) {
    sortie += "\n".repeat(Math.max(0, seg.start - sortie.length));
    sortie += seg.node.textContent;
  }
  return sortie;
}

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

/* Vérifie que la structure produit exactement le innerText mesuré. */
function verifier(nom, racine, innerTextAttendu) {
  test(nom + " --- " + JSON.stringify(innerTextAttendu), () => {
    const segments = construireSegmentsInnerText(racine);
    assert.strictEqual(texteReconstitue(segments), innerTextAttendu);
    /* Chaque segment doit retrouver son propre texte à son offset. */
    for (const seg of segments) {
      assert.strictEqual(
        innerTextAttendu.slice(seg.start, seg.end),
        seg.node.textContent,
        `segment @${seg.start} désaligné`
      );
    }
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

test("Long courriel : le dernier paragraphe reste aligné", () => {
  /* Le défaut corrigé décalait d'un caractère par paragraphe : au-delà
     d'une dizaine de paragraphes, findRealOffset ne compensait plus et
     les erreurs de fin de message n'étaient plus soulignées. */
  const contenus = [];
  for (let i = 0; i < 12; i++) contenus.push("Paragraphe numéro " + i);
  const segments = construireSegmentsInnerText(
    element("div", contenus.map((c) => element("p", [texte(c)])))
  );
  const innerText = texteReconstitue(segments);
  const dernier = segments[segments.length - 1];
  assert.strictEqual(
    innerText.slice(dernier.start, dernier.end),
    "Paragraphe numéro 11"
  );
  /* Chaque paragraphe précédent occupe sa longueur plus deux sauts de ligne. */
  const attendu = contenus
    .slice(0, 11)
    .reduce((total, c) => total + c.length + 2, 0);
  assert.strictEqual(dernier.start, attendu);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
