/*
 * test-recalibrate-offsets.js
 * Tests : Recalibrage des offsets retournés par le LLM.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");

/**
 * Reproduit la logique de recalibrage dans service-api.js.
 * Corrige offset et length à partir du champ word si nécessaire.
 */
function recalibrateCorrections(corrections, text) {
  for (const c of corrections) {
    if (!c.word || typeof c.offset !== "number") continue;
    const atOffset = text.slice(c.offset, c.offset + c.word.length);
    if (atOffset === c.word) {
      c.length = c.word.length;
    } else {
      let bestIdx = -1;
      let from = 0;
      while (from < text.length) {
        const idx = text.indexOf(c.word, from);
        if (idx === -1) break;
        if (bestIdx === -1
          || Math.abs(idx - c.offset) < Math.abs(bestIdx - c.offset)) {
          bestIdx = idx;
        }
        from = idx + 1;
      }
      if (bestIdx !== -1) {
        c.offset = bestIdx;
        c.length = c.word.length;
      }
    }
  }
  return corrections;
}

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

const TEXT = "Je pence que sa va marcher. Les faute d'ortographe seront detectées.";

console.log("Recalibrage des offsets LLM :");

/* -- Offset et length corrects -- */

test("Offset et length corrects : aucun changement", () => {
  const c = [{ word: "pence", offset: 3, length: 5, suggestions: ["pense"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 3);
  assert.strictEqual(c[0].length, 5);
});

/* -- Length incorrect -- */

test("Length trop grand : corrigé à la longueur du word", () => {
  const c = [{ word: "pence", offset: 3, length: 8, suggestions: ["pense"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 3);
  assert.strictEqual(c[0].length, 5);
});

test("Length trop petit : corrigé à la longueur du word", () => {
  const c = [{ word: "ortographe", offset: 40, length: 7, suggestions: ["orthographe"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 40);
  assert.strictEqual(c[0].length, 10);
});

/* -- Offset décalé -- */

test("Offset décalé de 1 : recalculé à la bonne position", () => {
  const c = [{ word: "pence", offset: 4, length: 5, suggestions: ["pense"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 3);
  assert.strictEqual(c[0].length, 5);
});

test("Offset décalé de 2 : recalculé à la bonne position", () => {
  const c = [{ word: "sa", offset: 15, length: 2, suggestions: ["ça"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 13);
  assert.strictEqual(c[0].length, 2);
});

test("Offset à 0 pour un mot plus loin : recalculé", () => {
  const c = [{ word: "detectées", offset: 0, length: 9, suggestions: ["détectées"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 58);
  assert.strictEqual(c[0].length, 9);
});

/* -- Offset et length tous les deux faux -- */

test("Offset et length faux : les deux sont corrigés", () => {
  const c = [{ word: "faute", offset: 30, length: 7, suggestions: ["fautes"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 32);
  assert.strictEqual(c[0].length, 5);
});

/* -- Word introuvable -- */

test("Word introuvable : offset et length inchangés", () => {
  const c = [{ word: "inexistant", offset: 10, length: 10, suggestions: ["mot"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 10);
  assert.strictEqual(c[0].length, 10);
});

/* -- Plusieurs corrections -- */

test("Plusieurs corrections : chacune recalibrée indépendamment", () => {
  const c = [
    { word: "pence", offset: 4, length: 5, suggestions: ["pense"] },
    { word: "ortographe", offset: 38, length: 7, suggestions: ["orthographe"] },
  ];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 3);
  assert.strictEqual(c[0].length, 5);
  assert.strictEqual(c[1].offset, 40);
  assert.strictEqual(c[1].length, 10);
});

/* -- Cas limites -- */

test("Correction sans word : ignorée", () => {
  const c = [{ offset: 3, length: 5, suggestions: ["pense"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].offset, 3);
  assert.strictEqual(c[0].length, 5);
});

test("Correction sans offset : ignorée", () => {
  const c = [{ word: "pence", length: 5, suggestions: ["pense"] }];
  recalibrateCorrections(c, TEXT);
  assert.strictEqual(c[0].length, 5);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
