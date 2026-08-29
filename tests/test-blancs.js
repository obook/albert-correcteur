/*
 * test-blancs.js
 * Tests : normalisation des espaces particuliers (util/blancs.js).
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const { normaliserBlancs, memeTexte } = require("../sources-commun/util/blancs.js");

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

console.log("Normalisation des espaces particuliers :");

/* Les quatre caractères couverts par la classe, invisibles à la lecture. */
const INSECABLE = " ";
const INSECABLE_ETROITE = " ";
const INSECABLE_CHIFFRES = " ";
const FINE = " ";

test("Espace insécable ramené à l'espace ordinaire", () => {
  assert.strictEqual(normaliserBlancs("oui" + INSECABLE + ":"), "oui :");
});

test("Insécable étroite, insécable des chiffres et fine couvertes", () => {
  const source = INSECABLE_ETROITE + INSECABLE_CHIFFRES + FINE;
  assert.strictEqual(normaliserBlancs(source), "   ");
});

test("Longueur conservée, un caractère pour un caractère", () => {
  const source = "1" + INSECABLE + "234" + INSECABLE_ETROITE + "!";
  assert.strictEqual(normaliserBlancs(source).length, source.length);
});

test("Offset trouvé dans la copie normalisée valable dans l'originale", () => {
  const texte = "Il reste 1" + INSECABLE + "234 euros ; voir plus bas.";
  const idx = normaliserBlancs(texte).indexOf("1 234 euros");
  assert.notStrictEqual(idx, -1);
  assert.strictEqual(texte.slice(idx, idx + 11), "1" + INSECABLE + "234 euros");
});

test("Texte sans espace particulier inchangé", () => {
  assert.strictEqual(normaliserBlancs("rien a signaler"), "rien a signaler");
});

test("Valeur non chaîne rendue telle quelle", () => {
  assert.strictEqual(normaliserBlancs(undefined), undefined);
  assert.strictEqual(normaliserBlancs(null), null);
});

console.log("\nComparaison indifférente à la nature des espaces :");

test("Insécable et espace ordinaire considérés égaux", () => {
  assert.strictEqual(memeTexte("bonjour" + INSECABLE + "!", "bonjour !"), true);
});

test("Textes réellement différents toujours distingués", () => {
  assert.strictEqual(memeTexte("bonjour !", "bonsoir !"), false);
});

test("Espace en trop toujours détecté", () => {
  assert.strictEqual(memeTexte("bonjour  !", "bonjour !"), false);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
