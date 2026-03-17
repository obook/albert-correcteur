// Tests — Vérification des limites de débit (rate limiting).

const assert = require("assert");

// ── Simulation de l'état Albert ──

function createState() {
  return {
    limits: null,
    requestTimestamps: [],
    requestCountToday: 0,
    requestDayStart: 0,
  };
}

function checkRateLimit(state) {
  const limits = state.limits;
  if (!limits) return null;

  const now = Date.now();

  const todayStart = new Date().setHours(0, 0, 0, 0);
  if (state.requestDayStart !== todayStart) {
    state.requestDayStart = todayStart;
    state.requestCountToday = 0;
  }

  state.requestTimestamps = state.requestTimestamps.filter(
    (t) => now - t < 60000
  );

  if (limits.rpm && state.requestTimestamps.length >= limits.rpm) {
    return "rpm";
  }

  if (limits.rpd && state.requestCountToday >= limits.rpd) {
    return "rpd";
  }

  return null;
}

function recordRequest(state) {
  state.requestTimestamps.push(Date.now());
  state.requestCountToday++;
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

console.log("Limites de débit :");

test("Pas de limites configurées — toujours OK", () => {
  const state = createState();
  assert.strictEqual(checkRateLimit(state), null);
});

test("Limites configurées, aucune requête — OK", () => {
  const state = createState();
  state.limits = { rpm: 10, rpd: 100 };
  assert.strictEqual(checkRateLimit(state), null);
});

test("rpm atteint — bloqué", () => {
  const state = createState();
  state.limits = { rpm: 3, rpd: 100 };
  for (let i = 0; i < 3; i++) recordRequest(state);
  assert.strictEqual(checkRateLimit(state), "rpm");
});

test("rpm non atteint — OK", () => {
  const state = createState();
  state.limits = { rpm: 10, rpd: 100 };
  for (let i = 0; i < 5; i++) recordRequest(state);
  assert.strictEqual(checkRateLimit(state), null);
});

test("rpd atteint — bloqué", () => {
  const state = createState();
  state.limits = { rpm: 1000, rpd: 5 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0);
  state.requestCountToday = 5;
  assert.strictEqual(checkRateLimit(state), "rpd");
});

test("rpd non atteint — OK", () => {
  const state = createState();
  state.limits = { rpm: 1000, rpd: 100 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0);
  state.requestCountToday = 50;
  assert.strictEqual(checkRateLimit(state), null);
});

test("Timestamps expirés (>60s) — nettoyés", () => {
  const state = createState();
  state.limits = { rpm: 3, rpd: 100 };
  // Ajouter des timestamps de plus d'une minute
  const old = Date.now() - 70000;
  state.requestTimestamps = [old, old, old];
  assert.strictEqual(checkRateLimit(state), null);
  assert.strictEqual(state.requestTimestamps.length, 0);
});

test("Changement de jour — compteur réinitialisé", () => {
  const state = createState();
  state.limits = { rpm: 1000, rpd: 5 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0) - 86400000; // hier
  state.requestCountToday = 100;
  assert.strictEqual(checkRateLimit(state), null);
  assert.strictEqual(state.requestCountToday, 0);
});

test("recordRequest incrémente les compteurs", () => {
  const state = createState();
  recordRequest(state);
  recordRequest(state);
  assert.strictEqual(state.requestTimestamps.length, 2);
  assert.strictEqual(state.requestCountToday, 2);
});

test("rpm vérifié avant rpd", () => {
  const state = createState();
  state.limits = { rpm: 2, rpd: 2 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0);
  recordRequest(state);
  recordRequest(state);
  // rpm et rpd atteints, rpm vérifié en premier
  assert.strictEqual(checkRateLimit(state), "rpm");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
