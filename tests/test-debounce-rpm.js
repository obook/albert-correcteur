// Tests --- Calcul du debounce adaptatif depuis le rpm du compte.

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

// --- Simulation minimale de l'objet Albert ---

function createAlbert() {
  return {
    limits: null,
    DEBOUNCE_MS: 3000,
    MAX_DEBOUNCE_MS: 10000,
    THROTTLE_DEBOUNCE_MS: 8000,
    THROTTLE_MAX_DEBOUNCE_MS: 20000,
    updateDebounceFromRpm: function () {
      const limits = this.limits;
      if (!limits || !limits.rpm) return;
      const rpm = limits.rpm;
      const interval = Math.ceil(60000 / (rpm * 0.4));
      this.DEBOUNCE_MS = Math.max(1500, Math.min(interval, 6000));
      this.MAX_DEBOUNCE_MS = Math.max(4000, this.DEBOUNCE_MS * 3);
      this.THROTTLE_DEBOUNCE_MS = Math.max(this.DEBOUNCE_MS * 2, 6000);
      this.THROTTLE_MAX_DEBOUNCE_MS = Math.max(this.MAX_DEBOUNCE_MS * 2, 15000);
    },
  };
}

console.log("Calcul du debounce adaptatif (updateDebounceFromRpm) :");

// --- Sans limites ---

test("Pas de limites --- valeurs par défaut inchangées", () => {
  const A = createAlbert();
  A.updateDebounceFromRpm();
  assert.strictEqual(A.DEBOUNCE_MS, 3000);
  assert.strictEqual(A.MAX_DEBOUNCE_MS, 10000);
});

test("Limites sans rpm --- valeurs par défaut inchangées", () => {
  const A = createAlbert();
  A.limits = { rpd: 1000 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.DEBOUNCE_MS, 3000);
});

// --- rpm 10 (compte limité) ---

test("rpm 10 --- debounce >= 3000ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 10 };
  A.updateDebounceFromRpm();
  assert.ok(A.DEBOUNCE_MS >= 3000, `${A.DEBOUNCE_MS} devrait être >= 3000`);
  assert.ok(A.DEBOUNCE_MS <= 6000, `${A.DEBOUNCE_MS} devrait être <= 6000`);
});

test("rpm 10 --- max debounce = 3x debounce", () => {
  const A = createAlbert();
  A.limits = { rpm: 10 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.MAX_DEBOUNCE_MS, A.DEBOUNCE_MS * 3);
});

test("rpm 10 --- throttle debounce >= 6000ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 10 };
  A.updateDebounceFromRpm();
  assert.ok(A.THROTTLE_DEBOUNCE_MS >= 6000);
});

// --- rpm 30 ---

test("rpm 30 --- debounce = 5000ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 30 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.DEBOUNCE_MS, 5000);
});

// --- rpm 60 ---

test("rpm 60 --- debounce = 2500ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 60 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.DEBOUNCE_MS, 2500);
});

test("rpm 60 --- max debounce = 7500ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 60 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.MAX_DEBOUNCE_MS, 7500);
});

// --- rpm 100+ (compte premium) ---

test("rpm 100 --- debounce plafonné à 1500ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 100 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.DEBOUNCE_MS, 1500);
});

test("rpm 100 --- max debounce plancher à 4500ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 100 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.MAX_DEBOUNCE_MS, 4500);
});

test("rpm 200 --- debounce toujours 1500ms (plancher)", () => {
  const A = createAlbert();
  A.limits = { rpm: 200 };
  A.updateDebounceFromRpm();
  assert.strictEqual(A.DEBOUNCE_MS, 1500);
});

// --- Throttle ---

test("rpm 100 --- throttle debounce >= 2x debounce", () => {
  const A = createAlbert();
  A.limits = { rpm: 100 };
  A.updateDebounceFromRpm();
  assert.ok(A.THROTTLE_DEBOUNCE_MS >= A.DEBOUNCE_MS * 2);
});

test("rpm 100 --- throttle max debounce >= 15000ms", () => {
  const A = createAlbert();
  A.limits = { rpm: 100 };
  A.updateDebounceFromRpm();
  assert.ok(A.THROTTLE_MAX_DEBOUNCE_MS >= 15000);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
