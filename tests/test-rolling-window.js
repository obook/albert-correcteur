/* Tests -- Compteur d'évènements sur fenêtre glissante. */

const assert = require("assert");

/* -- Copie de la classe à tester (depuis sources-commun/verification/rolling-window.js) --
   La copie est instrumentée avec une horloge injectable pour pouvoir
   simuler le temps qui passe sans Date.now() réel. La logique testée
   reste identique : seules les références à Date.now() sont remplacées
   par l'horloge passée en argument. */

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
    const remaining = (oldest + this._windowMs - this._clock()) / 1000;
    return Math.max(0, remaining);
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

console.log("Fenêtre glissante :");

test("Fenêtre vide : total = 0", () => {
  let now = 1000;
  const win = new RollingWindow(60000, () => now);
  assert.strictEqual(win.total(), 0);
});

test("Fenêtre vide : pas d'attente", () => {
  let now = 1000;
  const win = new RollingWindow(60000, () => now);
  assert.strictEqual(win.secondsUntilNextSlot(), 0);
});

test("add() incrémente le total", () => {
  let now = 1000;
  const win = new RollingWindow(60000, () => now);
  win.add();
  win.add();
  win.add();
  assert.strictEqual(win.total(), 3);
});

test("add(N) cumule la quantité", () => {
  let now = 1000;
  const win = new RollingWindow(60000, () => now);
  win.add(150);
  win.add(50);
  assert.strictEqual(win.total(), 200);
});

test("Évènements antérieurs à la fenêtre éliminés", () => {
  let now = 1000;
  const win = new RollingWindow(60000, () => now);
  win.add();
  win.add();
  /* Avancer de 70 s : les deux évènements doivent être éjectés */
  now += 70000;
  assert.strictEqual(win.total(), 0);
});

test("Évènements à la frontière conservés", () => {
  let now = 1000;
  const win = new RollingWindow(60000, () => now);
  win.add();
  /* Avancer de 59 s : l'évènement reste dans la fenêtre */
  now += 59000;
  assert.strictEqual(win.total(), 1);
});

test("secondsUntilNextSlot : compte à rebours décroissant", () => {
  let now = 0;
  const win = new RollingWindow(60000, () => now);
  win.add();
  /* Au moment de l'ajout : 60 s avant que le slot se libère */
  assert.strictEqual(win.secondsUntilNextSlot(), 60);
  now += 30000;
  assert.strictEqual(win.secondsUntilNextSlot(), 30);
  now += 25000;
  assert.strictEqual(win.secondsUntilNextSlot(), 5);
});

test("secondsUntilNextSlot : 0 quand la fenêtre est dépassée", () => {
  let now = 0;
  const win = new RollingWindow(60000, () => now);
  win.add();
  now += 60000;
  assert.strictEqual(win.secondsUntilNextSlot(), 0);
});

test("secondsUntilNextSlot pointe vers l'évènement le plus ancien", () => {
  let now = 0;
  const win = new RollingWindow(60000, () => now);
  win.add();
  now += 10000;
  win.add();
  now += 10000;
  /* Le plus ancien date de t=0, dans 40 s il sort */
  assert.strictEqual(win.secondsUntilNextSlot(), 40);
});

test("reset() vide la fenêtre", () => {
  let now = 0;
  const win = new RollingWindow(60000, () => now);
  win.add();
  win.add();
  win.reset();
  assert.strictEqual(win.total(), 0);
  assert.strictEqual(win.secondsUntilNextSlot(), 0);
});

test("Fenêtre personnalisée (10 s)", () => {
  let now = 0;
  const win = new RollingWindow(10000, () => now);
  win.add();
  assert.strictEqual(win.secondsUntilNextSlot(), 10);
  now += 11000;
  assert.strictEqual(win.total(), 0);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
