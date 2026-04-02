/* Tests -- Logique de selection du modele recommande et libelles. */

const assert = require("assert");

const RECOMMENDED_MODEL = "openweight-large";

const MODEL_DESCRIPTIONS = {
  "openweight-large": "Complexe (120B)",
  "openweight-medium": "Modéré (24B)",
  "openweight-small": "Simple (8B)",
};

/**
 * Reproduit la logique de modelLabel() dans popup-models.js.
 */
function modelLabel(id, aliasToId, recommendedId) {
  let desc = MODEL_DESCRIPTIONS[id];
  if (!desc) {
    for (const [alias, target] of Object.entries(aliasToId)) {
      if (target === id && MODEL_DESCRIPTIONS[alias]) {
        desc = MODEL_DESCRIPTIONS[alias];
        break;
      }
    }
  }
  const parts = [id];
  if (desc) parts.push(`\u2014 ${desc}`);
  if (id === recommendedId) parts.push("(recommandé)");
  return parts.join(" ");
}

/**
 * Résout le modèle recommandé : id direct ou via alias.
 */
function resolveRecommended(models, aliasToId) {
  if (models.includes(RECOMMENDED_MODEL)) return RECOMMENDED_MODEL;
  return aliasToId[RECOMMENDED_MODEL] || "";
}

/**
 * Reproduit la logique de selection dans popup-models.js.
 */
function buildModelOptions(models, savedModel, aliasToId) {
  const a2i = aliasToId || {};
  const savedAvailable = savedModel && models.includes(savedModel);
  const recommendedId = resolveRecommended(models, a2i);
  return models.map((id) => ({
    id,
    label: modelLabel(id, a2i, recommendedId),
    selected: savedAvailable
      ? id === savedModel
      : id === recommendedId,
  }));
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

console.log("Selection du modele recommande et libelles :");

/* Modeles avec openweight-large comme id direct. */
const MODELS_DIRECT = [
  "mistralai/Ministral-3-8B-Instruct-2512",
  "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  "openai/gpt-oss-120b",
  "openweight-large",
  "openweight-small",
];

/* Modeles reels de l'API : openweight-large est un alias. */
const MODELS_API = [
  "Qwen/Qwen3-Coder-30B-A3B-Instruct",
  "mistralai/Ministral-3-8B-Instruct-2512",
  "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  "openai/gpt-oss-120b",
];

const ALIAS_API = {
  "openweight-code": "Qwen/Qwen3-Coder-30B-A3B-Instruct",
  "openweight-small": "mistralai/Ministral-3-8B-Instruct-2512",
  "openweight-medium": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  "albert-large": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  "openweight-large": "openai/gpt-oss-120b",
};

/* -- Modele sauvegarde disponible -- */

test("Modele sauvegarde disponible --- il est selectionne", () => {
  const opts = buildModelOptions(MODELS_DIRECT, "openweight-small");
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "openweight-small");
});

test("Modele sauvegarde disponible --- le recommande n'est pas selectionne", () => {
  const opts = buildModelOptions(MODELS_DIRECT, "openweight-small");
  const rec = opts.find((o) => o.id === "openweight-large");
  assert.strictEqual(rec.selected, false);
});

/* -- Modele sauvegarde absent ou vide -- */

test("Pas de modele sauvegarde --- le recommande est selectionne", () => {
  const opts = buildModelOptions(MODELS_DIRECT, "");
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "openweight-large");
});

test("Modele sauvegarde inexistant --- le recommande est selectionne", () => {
  const opts = buildModelOptions(MODELS_DIRECT, "modele-supprime");
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "openweight-large");
});

/* -- Recommande absent de la liste -- */

test("Recommande absent de la liste sans alias --- aucun modele preselectionne", () => {
  const sansRec = MODELS_DIRECT.filter((m) => m !== "openweight-large");
  const opts = buildModelOptions(sansRec, "");
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 0);
});

test("Recommande absent + sauvegarde disponible --- sauvegarde selectionne", () => {
  const sansRec = MODELS_DIRECT.filter((m) => m !== "openweight-large");
  const opts = buildModelOptions(sansRec, "openweight-small");
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "openweight-small");
});

/* -- Resolution par alias (cas reel de l'API) -- */

test("Recommande via alias --- gpt-oss-120b preselectionne", () => {
  const opts = buildModelOptions(MODELS_API, "", ALIAS_API);
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "openai/gpt-oss-120b");
});

test("Recommande via alias + sauvegarde disponible --- sauvegarde prioritaire", () => {
  const opts = buildModelOptions(MODELS_API, "mistralai/Mistral-Small-3.2-24B-Instruct-2506", ALIAS_API);
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "mistralai/Mistral-Small-3.2-24B-Instruct-2506");
});

test("Recommande via alias + sauvegarde absente --- recommande selectionne", () => {
  const opts = buildModelOptions(MODELS_API, "modele-disparu", ALIAS_API);
  const selected = opts.filter((o) => o.selected);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].id, "openai/gpt-oss-120b");
});

/* -- Libelles avec descriptions -- */

test("Modele recommande direct --- description + (recommandé)", () => {
  const label = modelLabel("openweight-large", {}, "openweight-large");
  assert.strictEqual(label, "openweight-large \u2014 Complexe (120B) (recommandé)");
});

test("Modele connu medium --- description sans suffixe", () => {
  const label = modelLabel("openweight-medium", {}, "openweight-large");
  assert.strictEqual(label, "openweight-medium \u2014 Modéré (24B)");
});

test("Modele connu small --- description", () => {
  const label = modelLabel("openweight-small", {}, "openweight-large");
  assert.strictEqual(label, "openweight-small \u2014 Simple (8B)");
});

test("Modele inconnu --- libelle brut", () => {
  const label = modelLabel("mon-modele-custom", {}, "openweight-large");
  assert.strictEqual(label, "mon-modele-custom");
});

/* -- Libelles via alias (cas reel) -- */

test("Alias large resolu comme recommande --- description + (recommandé)", () => {
  const recId = resolveRecommended(MODELS_API, ALIAS_API);
  const label = modelLabel("openai/gpt-oss-120b", ALIAS_API, recId);
  assert.strictEqual(
    label,
    "openai/gpt-oss-120b \u2014 Complexe (120B) (recommandé)"
  );
});

test("Alias medium --- description retrouvee", () => {
  const label = modelLabel("mistralai/Mistral-Small-3.2-24B-Instruct-2506", ALIAS_API, "");
  assert.strictEqual(
    label,
    "mistralai/Mistral-Small-3.2-24B-Instruct-2506 \u2014 Modéré (24B)"
  );
});

test("Alias small --- description retrouvee", () => {
  const label = modelLabel("mistralai/Ministral-3-8B-Instruct-2512", ALIAS_API, "");
  assert.strictEqual(
    label,
    "mistralai/Ministral-3-8B-Instruct-2512 \u2014 Simple (8B)"
  );
});

test("Modele code sans description connue --- libelle brut", () => {
  const label = modelLabel("Qwen/Qwen3-Coder-30B-A3B-Instruct", ALIAS_API, "");
  assert.strictEqual(label, "Qwen/Qwen3-Coder-30B-A3B-Instruct");
});

/* -- Cas limite : liste vide -- */

test("Liste vide --- aucune option", () => {
  const opts = buildModelOptions([], "openweight-large");
  assert.strictEqual(opts.length, 0);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
