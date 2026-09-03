/*
 * test-nettoyer-suggestions.js
 * Tests : Nettoyage des suggestions renvoyées par l'API (service-api.js).
 *
 * Auteur : O. Booklage
 * Date : septembre 2026
 * Licence : MIT
 */
/* Une règle exigeait qu'une suggestion garde le "s" final du mot erroné.
 * Elle supprimait en silence toute correction consistant à retirer ce
 * "s" : composés à second élément invariable, mots invariables mal
 * orthographiés. Ces cas sont ici des non-régressions.
 */

const assert = require("assert");
const path = require("path");

const { coerceSuggestion, nettoyerSuggestions } =
  require(path.join(__dirname, "..", "sources-commun", "service", "service-api.js"));

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

function correction(word, suggestions) {
  return { word: word, offset: 0, type: "spelling", suggestions: suggestions };
}

/* Une correction survit avec sa suggestion intacte. */
function verifierConservee(mot, suggestion) {
  test(`${mot} -> ${suggestion} est conservée`, () => {
    const sortie = nettoyerSuggestions([correction(mot, [suggestion])]);
    assert.strictEqual(sortie.length, 1, "correction supprimée");
    assert.deepStrictEqual(sortie[0].suggestions, [suggestion]);
  });
}

console.log("Nettoyage des suggestions de l'API :");

/* Composés dont le second élément est invariable. */
verifierConservee("timbres-postes", "timbres-poste");
verifierConservee("pommes de terres", "pommes de terre");
verifierConservee("chefs-d'oeuvres", "chefs-d'oeuvre");

/* Mots invariables mal orthographiés avec un s. */
verifierConservee("parmis", "parmi");
verifierConservee("malgrés", "malgré");
verifierConservee("beaucoups", "beaucoup");

/* Pluriels irréguliers : la forme correcte finit par x, pas par s. */
verifierConservee("chevals", "chevaux");
verifierConservee("journals", "journaux");
verifierConservee("travails", "travaux");

/* Correction ordinaire, qui n'a jamais été concernée. */
verifierConservee("enfant", "enfants");

test("une suggestion identique au mot erroné est retirée", () => {
  const sortie = nettoyerSuggestions([correction("timbre", ["timbre"])]);
  assert.strictEqual(sortie.length, 0, "la correction devait disparaître");
});

test("les autres suggestions survivent au retrait de l'identique", () => {
  const sortie = nettoyerSuggestions([correction("cotoyer", ["cotoyer", "côtoyer"])]);
  assert.deepStrictEqual(sortie[0].suggestions, ["côtoyer"]);
});

test("une correction sans champ suggestions est conservée", () => {
  const sortie = nettoyerSuggestions([{ word: "mot", offset: 0 }]);
  assert.strictEqual(sortie.length, 1);
});

test("une suggestion objet est ramenée à sa chaîne", () => {
  const sortie = nettoyerSuggestions([correction("fote", [{ text: "faute" }])]);
  assert.deepStrictEqual(sortie[0].suggestions, ["faute"]);
});

test("une suggestion inexploitable est écartée avec sa correction", () => {
  const sortie = nettoyerSuggestions([correction("fote", [{ n: 3 }])]);
  assert.strictEqual(sortie.length, 0);
});

console.log("\nConversion d'une suggestion en chaîne :");

test("chaîne : rendue telle quelle", () => {
  assert.strictEqual(coerceSuggestion("faute"), "faute");
});

test("objet à clé connue : la clé l'emporte", () => {
  assert.strictEqual(coerceSuggestion({ suggestion: "faute" }), "faute");
});

test("objet sans clé connue : première chaîne non vide", () => {
  assert.strictEqual(coerceSuggestion({ inconnu: "faute" }), "faute");
});

test("objet sans aucune chaîne : null", () => {
  assert.strictEqual(coerceSuggestion({ n: 3 }), null);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
