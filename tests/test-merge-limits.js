/*
 * test-merge-limits.js
 * Tests : Fusion des limites API (regroupement par type, valeur minimale).
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");

function mergeLimits(rawLimits) {
  const merged = {};
  for (const l of rawLimits) {
    if (!(l.type in merged)) {
      merged[l.type] = l.value;
    } else if (l.value === null) {
      /* null = illimité, on garde la valeur existante (plus restrictive) */
    } else if (merged[l.type] === null) {
      merged[l.type] = l.value;
    } else {
      merged[l.type] = Math.min(merged[l.type], l.value);
    }
  }
  return merged;
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

console.log("Fusion des limites API :");

test("Liste vide - objet vide", () => {
  assert.deepStrictEqual(mergeLimits([]), {});
});

test("Une seule limite", () => {
  const result = mergeLimits([{ type: "rpm", value: 10 }]);
  assert.deepStrictEqual(result, { rpm: 10 });
});

test("Deux types différents", () => {
  const result = mergeLimits([
    { type: "rpm", value: 10 },
    { type: "rpd", value: 100 },
  ]);
  assert.deepStrictEqual(result, { rpm: 10, rpd: 100 });
});

test("Même type, garde le minimum", () => {
  const result = mergeLimits([
    { type: "rpm", value: 50 },
    { type: "rpm", value: 10 },
    { type: "rpm", value: 30 },
  ]);
  assert.deepStrictEqual(result, { rpm: 10 });
});

test("null = illimité, valeur numérique prioritaire", () => {
  const result = mergeLimits([
    { type: "tpm", value: null },
    { type: "tpm", value: 5000 },
  ]);
  assert.deepStrictEqual(result, { tpm: 5000 });
});

test("Valeur numérique d'abord, null ensuite - garde la valeur", () => {
  const result = mergeLimits([
    { type: "tpm", value: 5000 },
    { type: "tpm", value: null },
  ]);
  assert.deepStrictEqual(result, { tpm: 5000 });
});

test("Tout null - garde null", () => {
  const result = mergeLimits([
    { type: "tpd", value: null },
    { type: "tpd", value: null },
  ]);
  assert.deepStrictEqual(result, { tpd: null });
});

test("Cas réel - plusieurs routers avec 4 types", () => {
  const result = mergeLimits([
    { type: "rpm", value: 500 },
    { type: "rpd", value: 50000 },
    { type: "tpm", value: null },
    { type: "tpd", value: null },
    { type: "rpm", value: 50 },
    { type: "rpd", value: 1000 },
    { type: "tpm", value: 128000 },
    { type: "tpd", value: 2460000 },
    { type: "rpm", value: 10 },
    { type: "rpd", value: 1000 },
    { type: "tpm", value: 128000 },
    { type: "tpd", value: 1280000 },
  ]);
  assert.strictEqual(result.rpm, 10);
  assert.strictEqual(result.rpd, 1000);
  assert.strictEqual(result.tpm, 128000);
  assert.strictEqual(result.tpd, 1280000);
});

test("Valeur 0 - traitée comme restrictive", () => {
  const result = mergeLimits([
    { type: "rpm", value: 10 },
    { type: "rpm", value: 0 },
  ]);
  assert.strictEqual(result.rpm, 0);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
