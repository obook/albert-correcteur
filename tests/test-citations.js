/*
 * test-citations.js
 * Tests unitaires.
 *
 * Auteur : O. Booklage
 * Date : septembre 2026
 * Licence : MIT
 */
/* Tests -- Exclusion du texte cité (citations.js).
 *
 * Le module s'appuie sur la table de inner-text.js : chaque cas fournit
 * donc l'arbre ET le innerText correspondant, comme dans
 * test-inner-text-segments.js.
 *
 * Invariants vérifiés :
 *   - le texte soumis ne contient rien de la citation ni de la signature ;
 *   - un offset du texte soumis, ramené vers innerText, retombe sur le
 *     même mot.
 */

const assert = require("assert");
const path = require("path");

/* ---------------------------------------------------------------
 * DOM minimal, identique à celui de test-inner-text-segments.js.
 * --------------------------------------------------------------- */

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

global.Node = { TEXT_NODE, ELEMENT_NODE };
global.getComputedStyle = (el) => ({ display: el.display || "block" });

function texte(contenu) {
  return { nodeType: TEXT_NODE, textContent: contenu, childNodes: [], parentNode: null };
}

function element(tagName, enfants, options) {
  const attributs = options || {};
  const el = Object.assign({
    nodeType: ELEMENT_NODE,
    tagName: tagName.toUpperCase(),
    childNodes: enfants || [],
    className: "",
    hidden: false,
    getAttribute: (nom) => (nom in attributs ? attributs[nom] : null),
  }, attributs);
  for (const enfant of el.childNodes) enfant.parentNode = el;
  return el;
}

/* Le module s'accroche à window.Albert et y lit buildInnerTextSegments. */
global.window = { Albert: {} };
const { construireSegmentsInnerText } =
  require(path.join(__dirname, "..", "sources-commun", "util", "inner-text.js"));
global.window.Albert.buildInnerTextSegments = construireSegmentsInnerText;

const { zonesCitees, texteHorsCitation, offsetVersRacine, ramenerOffsets } =
  require(path.join(__dirname, "..", "sources-commun", "util", "citations.js"));

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

/* ---------------------------------------------------------------
 * Corps de message types. innerText mesuré dans Gecko sur la même
 * structure (banc de vérification du 3 septembre 2026).
 * --------------------------------------------------------------- */

/* Réponse au-dessus de la citation, signature en bas. */
function reponseAuDessus() {
  const racine = element("BODY", [
    element("P", [texte("Bonjour, voici ma reponse.")]),
    element("DIV", [texte("Le 03/09/2026, Untel a ecrit :")], { className: "moz-cite-prefix" }),
    element("BLOCKQUOTE", [
      element("DIV", [texte("Texte cite du message.")]),
      element("DIV", [texte("Deuxieme ligne citee.")]),
    ], { type: "cite" }),
    element("DIV", [texte("-- Olivier")], { className: "moz-signature" }),
  ]);
  racine.innerText = "Bonjour, voici ma reponse.\n\nLe 03/09/2026, Untel a ecrit :\n"
    + "\nTexte cite du message.\nDeuxieme ligne citee.\n-- Olivier";
  for (const enfant of racine.childNodes) enfant.parentNode = racine;
  return racine;
}

/* Réponse en dessous de la citation : le texte rédigé n'est plus un
   préfixe, une simple troncature au début de la citation ne suffirait pas. */
function reponseEnDessous() {
  const racine = element("BODY", [
    element("DIV", [texte("Le 03/09/2026, Untel a ecrit :")], { className: "moz-cite-prefix" }),
    element("BLOCKQUOTE", [
      element("DIV", [texte("Texte cite du message.")]),
    ], { type: "cite" }),
    element("P", [texte("Ma reponse ecrite en dessous.")]),
    element("PRE", [texte("-- Olivier")], { className: "moz-txt-sig" }),
  ]);
  racine.innerText = "Le 03/09/2026, Untel a ecrit :\n\nTexte cite du message.\n"
    + "Ma reponse ecrite en dessous.\n-- Olivier";
  for (const enfant of racine.childNodes) enfant.parentNode = racine;
  return racine;
}

/* Zimbra ne pose pas de classe mais un attribut sur le bloc cité. */
function reponseZimbra() {
  const cite = element("DIV", [texte("Texte cite du message.")]);
  cite.getAttribute = (nom) => (nom === "data-marker" ? "__QUOTED_TEXT__" : null);
  const racine = element("BODY", [
    element("DIV", [texte("Ma reponse Zimbra.")]),
    cite,
  ]);
  racine.innerText = "Ma reponse Zimbra.\nTexte cite du message.";
  for (const enfant of racine.childNodes) enfant.parentNode = racine;
  return racine;
}

console.log("Exclusion du texte cité :");

/* La ligne « X a écrit : » reste soumise : Thunderbird y range le texte
   collé au-dessus de la citation, et l'écarter revenait à tout perdre. */
test("réponse au-dessus : la citation est écartée, la réponse soumise", () => {
  const { texte: soumis } = texteHorsCitation(reponseAuDessus());
  assert.ok(soumis.startsWith("Bonjour, voici ma reponse."), soumis);
  assert.ok(soumis.indexOf("Texte cite") === -1, "citation soumise : " + soumis);
});

test("réponse en dessous : la citation est écartée, la réponse soumise", () => {
  const { texte: soumis } = texteHorsCitation(reponseEnDessous());
  assert.ok(soumis.indexOf("Ma reponse ecrite en dessous.") !== -1, soumis);
  assert.ok(soumis.indexOf("Texte cite") === -1, "citation soumise : " + soumis);
});

test("texte collé dans la ligne « X a écrit : » reste soumis", () => {
  const racine = element("BODY", [
    element("DIV", [
      texte("Pour adresser ses voeux a ceux qu'elle avait eus a cotoyer."),
      texte("Le 03/09/2026, Untel a ecrit :"),
    ], { className: "moz-cite-prefix" }),
    element("BLOCKQUOTE", [element("DIV", [texte("Texte cite du message.")])], { type: "cite" }),
  ]);
  racine.innerText = "Pour adresser ses voeux a ceux qu'elle avait eus a cotoyer."
    + "Le 03/09/2026, Untel a ecrit :\n\nTexte cite du message.";
  for (const enfant of racine.childNodes) enfant.parentNode = racine;

  const { texte: soumis } = texteHorsCitation(racine);
  assert.ok(soumis.indexOf("Pour adresser ses voeux") !== -1,
    "le texte collé a été perdu : " + JSON.stringify(soumis));
  assert.ok(soumis.indexOf("Texte cite") === -1, "citation soumise : " + soumis);
});

test("un blockquote sans type=cite est du texte rédigé, pas une citation", () => {
  const racine = element("BODY", [
    element("BLOCKQUOTE", [texte("Bloc colle depuis une page web.")]),
    element("BLOCKQUOTE", [texte("Vraie citation.")], { type: "cite" }),
  ]);
  racine.innerText = "Bloc colle depuis une page web.\nVraie citation.";
  for (const enfant of racine.childNodes) enfant.parentNode = racine;

  const { texte: soumis } = texteHorsCitation(racine);
  assert.strictEqual(soumis, "Bloc colle depuis une page web.");
});

test("Zimbra : le bloc data-marker est écarté", () => {
  const { texte: soumis } = texteHorsCitation(reponseZimbra());
  assert.strictEqual(soumis, "Ma reponse Zimbra.");
});

test("la signature n'est jamais soumise", () => {
  for (const corps of [reponseAuDessus(), reponseEnDessous()]) {
    const { texte: soumis } = texteHorsCitation(corps);
    assert.ok(soumis.indexOf("Olivier") === -1, "signature soumise : " + soumis);
  }
});

test("aucun intervalle conservé n'est fait que de blancs", () => {
  const racine = reponseEnDessous();
  const { gardees } = texteHorsCitation(racine);
  for (const g of gardees) {
    const morceau = racine.innerText.slice(g.debut, g.fin);
    assert.ok(morceau.trim().length > 0, "intervalle vide : " + JSON.stringify(morceau));
  }
});

test("un corps sans citation est soumis en entier", () => {
  const racine = element("BODY", [element("P", [texte("Un message neuf.")])]);
  racine.innerText = "Un message neuf.";
  racine.childNodes[0].parentNode = racine;
  const { texte: soumis, gardees } = texteHorsCitation(racine);
  assert.strictEqual(soumis, "Un message neuf.");
  assert.deepStrictEqual(gardees, [{ debut: 0, fin: 16 }]);
});

test("les zones citées portent leur motif", () => {
  const motifs = zonesCitees(reponseAuDessus()).map((z) => z.motif);
  assert.deepStrictEqual(motifs, ["citation", "moz-signature"]);
});

/* Le trajet retour est ce qui garantit que le soulignement tombe sur le
   bon mot : un offset du texte soumis doit désigner le même mot dans
   innerText. */
function verifierAllerRetour(nom, corps, mot) {
  test(nom, () => {
    const racine = corps();
    const { texte: soumis, gardees } = texteHorsCitation(racine);
    const offsetSoumis = soumis.indexOf(mot);
    assert.notStrictEqual(offsetSoumis, -1, "mot absent du texte soumis");
    const offsetRacine = offsetVersRacine(offsetSoumis, gardees);
    assert.strictEqual(
      racine.innerText.slice(offsetRacine, offsetRacine + mot.length), mot);
  });
}

verifierAllerRetour("aller-retour d'offset, réponse au-dessus", reponseAuDessus, "reponse");
verifierAllerRetour("aller-retour d'offset, réponse en dessous", reponseEnDessous, "ecrite");
verifierAllerRetour("aller-retour d'offset, Zimbra", reponseZimbra, "Zimbra");

test("ramenerOffsets décale les corrections et écarte l'impossible", () => {
  const racine = reponseEnDessous();
  const { texte: soumis, gardees } = texteHorsCitation(racine);
  const corrections = [
    { word: "ecrite", offset: soumis.indexOf("ecrite") },
    { word: "hors", offset: 9999 },
  ];
  const ramenees = ramenerOffsets(corrections, gardees);
  assert.strictEqual(ramenees.length, 1, "la correction hors limites doit être écartée");
  assert.strictEqual(
    racine.innerText.slice(ramenees[0].offset, ramenees[0].offset + 6), "ecrite");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
