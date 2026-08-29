/*
 * test-find-real-offset.js
 * Tests : Recherche d'offset réel (findRealOffset).
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const { normaliserBlancs } = require("../sources-commun/util/blancs.js");

/* Reproduire la fonction telle qu'elle est dans albert-apply.js */
function findRealOffset(currentText, correction, checkedText) {
  const originalWord = correction.word
    || checkedText.slice(correction.offset, correction.offset + correction.length);

  const texte = normaliserBlancs(currentText);
  const mot = normaliserBlancs(originalWord);

  if (texte.slice(correction.offset, correction.offset + mot.length) === mot) {
    return correction.offset;
  }

  let bestIdx = -1;
  let searchFrom = 0;
  while (searchFrom < texte.length) {
    const idx = texte.indexOf(mot, searchFrom);
    if (idx === -1) break;
    if (bestIdx === -1 || Math.abs(idx - correction.offset) < Math.abs(bestIdx - correction.offset)) {
      bestIdx = idx;
    }
    searchFrom = idx + 1;
  }
  return bestIdx;
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

console.log("Recherche d'offset réel (findRealOffset) :");

test("Offset exact - texte inchangé", () => {
  const text = "Bonjour le monde";
  const correction = { offset: 8, length: 2 };
  assert.strictEqual(findRealOffset(text, correction, text), 8);
});

test("Offset exact - mot en début de texte", () => {
  const text = "Bonnjour à tous";
  const correction = { offset: 0, length: 8 };
  assert.strictEqual(findRealOffset(text, correction, text), 0);
});

test("Offset exact - mot en fin de texte", () => {
  const text = "Bonjour le monde";
  const correction = { offset: 11, length: 5 };
  assert.strictEqual(findRealOffset(text, correction, text), 11);
});

test("Mot décalé - correction précédente plus courte", () => {
  const checked = "Il a manger la pomme";     /* texte original vérifié */
  const current = "Il a mangé la pomme";       /* après correction "manger" -> "mangé" */
  /* "la" était à l'offset 12, maintenant à 11 */
  const correction = { offset: 12, length: 2 };
  assert.strictEqual(findRealOffset(current, correction, checked), 11);
});

test("Mot décalé - correction précédente plus longue", () => {
  const checked = "Il a du mal à lire";
  const current = "Il a beaucoup du mal à lire"; /* insertion avant */
  const correction = { offset: 5, length: 2 };   /* "du" à l'offset 5 dans checked */
  /* "du" dans current est à l'offset 14 */
  assert.strictEqual(findRealOffset(current, correction, checked), 14);
});

test("Mot dupliqué - choisit l'occurrence la plus proche de l'offset original", () => {
  const text = "Le chat chat mange";
  const correction = { offset: 9, length: 4 }; /* le 2ème "chat" */
  assert.strictEqual(findRealOffset(text, correction, text), 9);
});

test("Mot dupliqué - première occurrence plus proche", () => {
  const text = "Le chat dort et le chat mange";
  const correction = { offset: 3, length: 4 }; /* le 1er "chat" */
  assert.strictEqual(findRealOffset(text, correction, text), 3);
});

test("Mot dupliqué avec décalage - proximité correcte", () => {
  const checked = "Le chat chat mange";
  const current = "Le felin chat mange"; /* "chat" (1er) remplacé par "felin" */
  /* Le 2ème "chat" était à offset 8 dans checked, maintenant à 9 dans current */
  const correction = { offset: 8, length: 4 };
  assert.strictEqual(findRealOffset(current, correction, checked), 9);
});

test("Mot triple - choisit le plus proche", () => {
  const text = "erreur et erreur et erreur ici";
  /* offset 0=erreur, 10=erreur, 20=erreur */
  const correction = { offset: 10, length: 6 }; /* celui du milieu */
  assert.strictEqual(findRealOffset(text, correction, text), 10);
});

test("Mot introuvable - retourne -1", () => {
  const checked = "Bonjour le monde";
  const current = "Salut la terre";
  const correction = { offset: 8, length: 2 }; /* "le" dans checked */
  assert.strictEqual(findRealOffset(current, correction, checked), -1);
});

test("Texte vide - retourne -1", () => {
  const checked = "Bonjour";
  const correction = { offset: 0, length: 7 };
  assert.strictEqual(findRealOffset("", correction, checked), -1);
});

test("Mot d'un seul caractère dupliqué - proximité", () => {
  const text = "a b a b a";
  /* offsets de "a" : 0, 4, 8 */
  const correction = { offset: 4, length: 1 };
  assert.strictEqual(findRealOffset(text, correction, text), 4);
});

test("Insécable du texte contre espace ordinaire du modèle", () => {
  /* innerText garde l'insécable, le modèle rend un espace ordinaire. */
  const texte = "Il en reste vingt ; c'est peu";
  const correction = { offset: 12, length: 7, word: "vingt ;" };
  assert.strictEqual(findRealOffset(texte, correction, texte), 12);
});

test("Insécable et mot déplacé - occurrence retrouvée", () => {
  const checked = "On a vingt ; puis trente";
  const current = "On avait vingt ; puis trente";
  const correction = { offset: 5, length: 7, word: "vingt ;" };
  assert.strictEqual(findRealOffset(current, correction, checked), 9);
});

test("Correction de longueur 0 - offset exact", () => {
  const text = "Bonjour";
  const correction = { offset: 3, length: 0 };
  /* slice(3,3) === "" et indexOf("") === 0, mais l'offset exact match d'abord */
  assert.strictEqual(findRealOffset(text, correction, text), 3);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
