/*
 * test-auto-fallback.js
 * Tests : Auto-fallback de modèle après 429 répétés.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");

/* -- Copie de la logique à tester (depuis sources-commun/service/service-fallback.js) --
   La copie est instrumentée avec une horloge injectable et expose les
   maps internes (consecutive429, fallbackUntil) en paramètre pour
   pouvoir simuler des séquences indépendantes par test. */

const FALLBACK_TRIGGER_429 = 2;
const FALLBACK_DURATION_MS = 60000;

/* Doit refléter exactement la FALLBACK_CHAIN de service-fallback.js.
   Les ids canoniques (gpt-oss-120b, etc.) sont normalisés en alias par
   loadConfig() avant d'atteindre cette table, donc seuls les alias y
   figurent. */
const FALLBACK_CHAIN = {
  "openweight-large": "openweight-medium",
  "openweight-medium": "openweight-small",
};

function createFallbackState() {
  return {
    consecutive429: new Map(),
    fallbackUntil: new Map(),
  };
}

function selectEffectiveModel(state, primary, now) {
  const until = state.fallbackUntil.get(primary);
  if (until && until > now) {
    return FALLBACK_CHAIN[primary] || primary;
  }
  return primary;
}

function record429(state, primary, now) {
  if (!primary) return;
  const next = (state.consecutive429.get(primary) || 0) + 1;
  state.consecutive429.set(primary, next);
  const fallback = FALLBACK_CHAIN[primary];
  if (next >= FALLBACK_TRIGGER_429 && fallback) {
    state.fallbackUntil.set(primary, now + FALLBACK_DURATION_MS);
    state.consecutive429.set(primary, 0);
  }
}

function recordSuccess(state, primary) {
  if (!primary) return;
  state.consecutive429.delete(primary);
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

console.log("Auto-fallback de modèle :");

test("Aucun 429 : modèle principal sélectionné", () => {
  const state = createFallbackState();
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 1000),
    "openweight-large"
  );
});

test("Un seul 429 : pas encore de bascule", () => {
  const state = createFallbackState();
  record429(state, "openweight-large", 1000);
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 1000),
    "openweight-large"
  );
});

test("Deux 429 consécutifs : bascule vers le fallback", () => {
  const state = createFallbackState();
  record429(state, "openweight-large", 1000);
  record429(state, "openweight-large", 2000);
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 3000),
    "openweight-medium"
  );
});

test("Bascule active pendant 60 s puis retour", () => {
  const state = createFallbackState();
  record429(state, "openweight-large", 1000);
  record429(state, "openweight-large", 2000);
  /* 30 s plus tard : toujours en fallback */
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 32000),
    "openweight-medium"
  );
  /* 70 s après le second 429 : fallback expiré, retour au principal */
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 72000),
    "openweight-large"
  );
});

test("Succès intercalé : compteur reset, pas de bascule", () => {
  const state = createFallbackState();
  record429(state, "openweight-large", 1000);
  recordSuccess(state, "openweight-large");
  record429(state, "openweight-large", 2000);
  /* Un seul 429 reste comptabilisé (le précédent a été reset) */
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 3000),
    "openweight-large"
  );
});

test("Compteur reset après bascule : un nouveau 429 ne re-bascule pas", () => {
  const state = createFallbackState();
  record429(state, "openweight-large", 1000);
  record429(state, "openweight-large", 2000);
  /* Bascule active. Un seul 429 supplémentaire ne suffit pas pour
     repousser la fenêtre, il faut deux nouveaux 429 consécutifs. */
  record429(state, "openweight-large", 3000);
  assert.strictEqual(state.consecutive429.get("openweight-large"), 1);
});

test("Bascule chaînable : large -> medium puis medium -> small", () => {
  const state = createFallbackState();
  record429(state, "openweight-medium", 1000);
  record429(state, "openweight-medium", 2000);
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-medium", 3000),
    "openweight-small"
  );
});

test("Pas de fallback connu : pas de bascule (small)", () => {
  const state = createFallbackState();
  record429(state, "openweight-small", 1000);
  record429(state, "openweight-small", 2000);
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-small", 3000),
    "openweight-small"
  );
  /* Et le compteur ne se reset pas non plus, puisque pas de fallback */
  assert.strictEqual(state.consecutive429.get("openweight-small"), 2);
});

/* Note : il existait ici un test "Id canonique reconnu (gpt-oss-120b
   -> openweight-medium)" qui validait des entrées canoniques dans
   FALLBACK_CHAIN. Ces entrées ont été supprimées du module de
   production : la normalisation canonique -> alias est faite en amont
   par normalizeModelId() dans service-config.js. La couverture
   correspondante doit aller dans une suite dédiée à
   normalizeModelId, pas ici. */

test("Modèle inconnu : pas de bascule, comportement transparent", () => {
  const state = createFallbackState();
  record429(state, "modele-tiers-quelconque", 1000);
  record429(state, "modele-tiers-quelconque", 2000);
  assert.strictEqual(
    selectEffectiveModel(state, "modele-tiers-quelconque", 3000),
    "modele-tiers-quelconque"
  );
});

test("Modèle null/undefined ignoré silencieusement", () => {
  const state = createFallbackState();
  record429(state, null, 1000);
  record429(state, undefined, 1000);
  recordSuccess(state, null);
  assert.strictEqual(state.consecutive429.size, 0);
});

test("Compteurs indépendants entre modèles", () => {
  const state = createFallbackState();
  record429(state, "openweight-large", 1000);
  record429(state, "openweight-medium", 1000);
  /* Aucun n'a deux 429 consécutifs : pas de bascule */
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-large", 2000),
    "openweight-large"
  );
  assert.strictEqual(
    selectEffectiveModel(state, "openweight-medium", 2000),
    "openweight-medium"
  );
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
