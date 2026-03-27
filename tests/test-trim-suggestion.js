// Tests --- Nettoyage des suggestions (_trimSuggestion).

const assert = require("assert");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \u2717 ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

// --- Copie de la fonction à tester (depuis correction/albert-apply.js) ---

function trimSuggestion(suggestion, correction, fullText) {
  if (suggestion.length <= correction.length) return suggestion;

  const maxOverlap = suggestion.length - correction.length;
  for (let len = maxOverlap; len > 0; len--) {
    if (correction.offset >= len) {
      const prefix = fullText.slice(correction.offset - len, correction.offset);
      if (suggestion.startsWith(prefix)) {
        return suggestion.slice(len);
      }
    }
  }
  return suggestion;
}

console.log("Nettoyage des suggestions (_trimSuggestion) :");

// --- Suggestion sans contexte en trop ---

test("Suggestion de même longueur --- inchangée", () => {
  const result = trimSuggestion("algèbre", { offset: 10, length: 7 }, "les mots algébre et plus");
  assert.strictEqual(result, "algèbre");
});

test("Suggestion plus courte --- inchangée", () => {
  const result = trimSuggestion("test", { offset: 5, length: 6 }, "abcde testtt xyz");
  assert.strictEqual(result, "test");
});

// --- Suggestion avec contexte en trop ---

test("Préfixe d' en trop --- d'orthographe -> orthographe", () => {
  const fullText = "les fautes d'ortographe sont fréquentes";
  const correction = { offset: 13, length: 10 }; // "ortographe"
  const result = trimSuggestion("d'orthographe", correction, fullText);
  assert.strictEqual(result, "orthographe");
});

test("Préfixe l' en trop --- l'intéressé -> intéressé", () => {
  const fullText = "je suis l'interessé par ce sujet";
  const correction = { offset: 10, length: 9 }; // "interessé" commence après l'apostrophe
  const result = trimSuggestion("l'intéressé", correction, fullText);
  assert.strictEqual(result, "intéressé");
});

test("Préfixe espace en trop --- ' mot' -> 'mot'", () => {
  const fullText = "un test avec ereur dans le texte";
  const correction = { offset: 13, length: 5 }; // "ereur"
  const result = trimSuggestion(" erreur", correction, fullText);
  assert.strictEqual(result, "erreur");
});

// --- Pas de préfixe correspondant ---

test("Suggestion plus longue sans préfixe correspondant --- inchangée", () => {
  const fullText = "un test simple";
  const correction = { offset: 3, length: 4 }; // "test"
  const result = trimSuggestion("examen complet", correction, fullText);
  assert.strictEqual(result, "examen complet");
});

// --- Cas limites ---

test("Correction au début du texte (offset 0) --- pas de trim possible", () => {
  const fullText = "tset un mot";
  const correction = { offset: 0, length: 4 }; // "tset"
  const result = trimSuggestion("le test", correction, fullText);
  assert.strictEqual(result, "le test");
});

test("Suggestion identique au mot erroné --- inchangée", () => {
  const fullText = "un mot dans le texte";
  const correction = { offset: 3, length: 3 }; // "mot"
  const result = trimSuggestion("mot", correction, fullText);
  assert.strictEqual(result, "mot");
});

test("Préfixe partiel mais pas de correspondance --- inchangée", () => {
  const fullText = "xyz erruer est un mot";
  const correction = { offset: 4, length: 6 }; // "erruer"
  const result = trimSuggestion("abc erreur", correction, fullText);
  assert.strictEqual(result, "abc erreur");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
