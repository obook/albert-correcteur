/* Tests -- Vérification des limites de débit (rate limiting). */

const assert = require("assert");

/* -- Copie des fonctions à tester (depuis sources-firefox/verification/albert-limites.js) --
   La copie utilise la classe RollingWindow définie dans
   sources-commun/verification/rolling-window.js, instrumentée ici
   avec une horloge injectable pour pouvoir simuler le temps. */

class RollingWindow {
  constructor(windowMs = 60000, clock = () => Date.now()) {
    this._windowMs = windowMs;
    this._clock = clock;
    this._events = [];
  }
  add(count = 1) {
    this._events.push({ ts: this._clock(), count });
  }
  total() {
    this._evict();
    let sum = 0;
    for (const ev of this._events) sum += ev.count;
    return sum;
  }
  secondsUntilNextSlot() {
    this._evict();
    if (this._events.length === 0) return 0;
    const oldest = this._events[0].ts;
    return Math.max(0, (oldest + this._windowMs - this._clock()) / 1000);
  }
  reset() {
    this._events = [];
  }
  _evict() {
    const cutoff = this._clock() - this._windowMs;
    while (this._events.length && this._events[0].ts < cutoff) {
      this._events.shift();
    }
  }
}

function createState(clock = () => Date.now()) {
  return {
    limits: null,
    requestWindow: new RollingWindow(60000, clock),
    requestCountToday: 0,
    requestDayStart: 0,
    _clock: clock,
  };
}

function checkRateLimit(state) {
  const limits = state.limits;
  if (!limits) return null;

  const todayStart = new Date(state._clock()).setHours(0, 0, 0, 0);
  if (state.requestDayStart !== todayStart) {
    state.requestDayStart = todayStart;
    state.requestCountToday = 0;
  }

  if (limits.rpm && state.requestWindow.total() >= limits.rpm) {
    return "rpm";
  }
  if (limits.rpd && state.requestCountToday >= limits.rpd) {
    return "rpd";
  }
  return null;
}

function recordRequest(state) {
  state.requestWindow.add();
  state.requestCountToday++;
}

/* -- Tests -- */

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

test("Pas de limites configurées : toujours OK", () => {
  const state = createState();
  assert.strictEqual(checkRateLimit(state), null);
});

test("Limites configurées, aucune requête : OK", () => {
  const state = createState();
  state.limits = { rpm: 10, rpd: 100 };
  assert.strictEqual(checkRateLimit(state), null);
});

test("rpm atteint : bloqué", () => {
  const state = createState();
  state.limits = { rpm: 3, rpd: 100 };
  for (let i = 0; i < 3; i++) recordRequest(state);
  assert.strictEqual(checkRateLimit(state), "rpm");
});

test("rpm non atteint : OK", () => {
  const state = createState();
  state.limits = { rpm: 10, rpd: 100 };
  for (let i = 0; i < 5; i++) recordRequest(state);
  assert.strictEqual(checkRateLimit(state), null);
});

test("rpd atteint : bloqué", () => {
  const state = createState();
  state.limits = { rpm: 1000, rpd: 5 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0);
  state.requestCountToday = 5;
  assert.strictEqual(checkRateLimit(state), "rpd");
});

test("rpd non atteint : OK", () => {
  const state = createState();
  state.limits = { rpm: 1000, rpd: 100 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0);
  state.requestCountToday = 50;
  assert.strictEqual(checkRateLimit(state), null);
});

test("Évènements expirés (>60 s) : éjectés", () => {
  let now = 1000;
  const state = createState(() => now);
  state.limits = { rpm: 3, rpd: 100 };
  for (let i = 0; i < 3; i++) recordRequest(state);
  assert.strictEqual(checkRateLimit(state), "rpm");
  /* Avancer de 70 s : la fenêtre se vide, requêtes à nouveau possibles */
  now += 70000;
  assert.strictEqual(checkRateLimit(state), null);
});

test("Changement de jour : compteur réinitialisé", () => {
  const state = createState();
  state.limits = { rpm: 1000, rpd: 5 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0) - 86400000;
  state.requestCountToday = 100;
  assert.strictEqual(checkRateLimit(state), null);
  assert.strictEqual(state.requestCountToday, 0);
});

test("recordRequest incrémente la fenêtre et le compteur du jour", () => {
  const state = createState();
  recordRequest(state);
  recordRequest(state);
  assert.strictEqual(state.requestWindow.total(), 2);
  assert.strictEqual(state.requestCountToday, 2);
});

test("rpm vérifié avant rpd", () => {
  const state = createState();
  state.limits = { rpm: 2, rpd: 2 };
  state.requestDayStart = new Date().setHours(0, 0, 0, 0);
  recordRequest(state);
  recordRequest(state);
  assert.strictEqual(checkRateLimit(state), "rpm");
});

test("Calcul du temps d'attente quand rpm atteint", () => {
  let now = 1000;
  const state = createState(() => now);
  state.limits = { rpm: 2, rpd: 100 };
  recordRequest(state);
  now += 30000;
  recordRequest(state);
  assert.strictEqual(checkRateLimit(state), "rpm");
  /* L'évènement le plus ancien date de t=1000, fenêtre 60 s :
     il sortira dans 30 s. */
  const wait = Math.ceil(state.requestWindow.secondsUntilNextSlot());
  assert.strictEqual(wait, 30);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
