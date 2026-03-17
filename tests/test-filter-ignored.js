// Tests — Filtrage des mots ignorés (dictionnaire personnel).

const assert = require("assert");

function filterIgnoredCorrections(corrections, text, ignoredWords) {
  return corrections.filter((c) => {
    const word = text.slice(c.offset, c.offset + c.length).toLowerCase();
    return !ignoredWords.has(word);
  });
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

console.log("Filtrage des mots ignorés :");

test("Aucun mot ignoré — tout passe", () => {
  const text = "Bonnjour a tous";
  const corrections = [
    { offset: 0, length: 8 },
    { offset: 9, length: 1 },
  ];
  const result = filterIgnoredCorrections(corrections, text, new Set());
  assert.strictEqual(result.length, 2);
});

test("Un mot ignoré — filtré", () => {
  const text = "Bonnjour a tous";
  const corrections = [
    { offset: 0, length: 8 },
    { offset: 9, length: 1 },
  ];
  const result = filterIgnoredCorrections(corrections, text, new Set(["bonnjour"]));
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].offset, 9);
});

test("Tous les mots ignorés — liste vide", () => {
  const text = "Bonnjour a";
  const corrections = [
    { offset: 0, length: 8 },
    { offset: 9, length: 1 },
  ];
  const result = filterIgnoredCorrections(corrections, text, new Set(["bonnjour", "a"]));
  assert.strictEqual(result.length, 0);
});

test("Casse ignorée — mot en majuscules filtré", () => {
  const text = "BONNJOUR a tous";
  const corrections = [
    { offset: 0, length: 8 },
  ];
  const result = filterIgnoredCorrections(corrections, text, new Set(["bonnjour"]));
  assert.strictEqual(result.length, 0);
});

test("Mot pas dans le dictionnaire — conservé", () => {
  const text = "Bonnjour a tous";
  const corrections = [
    { offset: 0, length: 8 },
  ];
  const result = filterIgnoredCorrections(corrections, text, new Set(["xyz"]));
  assert.strictEqual(result.length, 1);
});

test("Dictionnaire vide — tout conservé", () => {
  const text = "erreur ici";
  const corrections = [
    { offset: 0, length: 6 },
    { offset: 7, length: 3 },
  ];
  const result = filterIgnoredCorrections(corrections, text, new Set());
  assert.strictEqual(result.length, 2);
});

test("Corrections vides — résultat vide", () => {
  const result = filterIgnoredCorrections([], "texte", new Set(["mot"]));
  assert.strictEqual(result.length, 0);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
