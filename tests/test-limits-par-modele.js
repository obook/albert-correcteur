/*
 * test-limits-par-modele.js
 * Tests : rattachement des plafonds du compte au modèle qui les porte.
 *
 * Albert ne nomme jamais le modèle dans /v1/me/info ni le routeur dans
 * /v1/models : le rattachement se fait par rang de création. Les données
 * du premier cas sont celles relevées sur le compte le 8 septembre 2026,
 * réduites aux quatre premiers rangs.
 *
 * Auteur : O. Booklage
 * Date : septembre 2026
 * Licence : MIT
 */

const assert = require("assert");
const {
  limitsForModel,
} = require("../sources-commun/util/model-aliases.js");

/* Quatre routeurs relevés sur le compte, volontairement mélangés :
   c'est le tri par router_id qui doit rétablir l'ordre. */
const LIMITES = [
  { router_id: 338, type: "rpm", value: 100 },
  { router_id: 338, type: "rpd", value: 50000 },
  { router_id: 338, type: "tpm", value: 246000 },
  { router_id: 338, type: "tpd", value: null },
  { router_id: 337, type: "rpm", value: 50 },
  { router_id: 337, type: "rpd", value: 5000 },
  { router_id: 337, type: "tpm", value: 246000 },
  { router_id: 337, type: "tpd", value: null },
  { router_id: 342, type: "rpm", value: 2000 },
  { router_id: 342, type: "rpd", value: 200000 },
  { router_id: 339, type: "rpm", value: 100 },
  { router_id: 339, type: "rpd", value: 50000 },
];

/* Les quatre modèles correspondants, eux aussi dans le désordre. */
const MODELES = [
  { id: "bge-m3", created: 1765384417, aliases: ["openweight-embeddings"] },
  { id: "openai/gpt-oss-120b", created: 1765375160, aliases: ["openweight-large"] },
  {
    id: "ministral-3-8b-instruct-2512",
    created: 1765384336,
    aliases: ["openweight-small"],
  },
  {
    id: "qwen3-coder-30b-A3b-instruct",
    created: 1765384283,
    aliases: ["Qwen/Qwen3-Coder-30B-A3B-Instruct", "openweight-code"],
  },
];

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

console.log("Plafonds rattachés au modèle :");

/* Le cas qui motive tout le reste : le minimum du compte vaut 50, mais
   c'est celui d'openweight-large. openweight-code est à 100. */
test("openweight-code obtient ses propres plafonds, pas le minimum", () => {
  const limites = limitsForModel(LIMITES, MODELES, "openweight-code");
  assert.strictEqual(limites.rpm, 100);
  assert.strictEqual(limites.rpd, 50000);
  assert.strictEqual(limites.tpm, 246000);
  assert.strictEqual(limites.tpd, null, "null = illimité");
});

test("openweight-large obtient les siens, plus bas", () => {
  const limites = limitsForModel(LIMITES, MODELES, "openweight-large");
  assert.strictEqual(limites.rpm, 50);
  assert.strictEqual(limites.rpd, 5000);
});

test("Le modèle d'embeddings tombe bien sur le routeur à 2000", () => {
  const limites = limitsForModel(LIMITES, MODELES, "openweight-embeddings");
  assert.strictEqual(limites.rpm, 2000);
});

test("Id canonique accepté au lieu de l'alias", () => {
  const limites = limitsForModel(
    LIMITES, MODELES, "Qwen/Qwen3-Coder-30B-A3B-Instruct"
  );
  assert.strictEqual(limites.rpm, 100);
});

/* Derrière llm-proxy, l'id est préfixé et inconnu de la table d'alias :
   c'est la liste servie qui le rattache, par son propre alias. */
test("Id préfixé par un proxy, rattaché par ses alias", () => {
  const servis = MODELES.map((m) => (m.id.includes("qwen3-coder")
    ? { ...m, id: "anthropic-albert/openweight-code" }
    : m));
  const limites = limitsForModel(
    LIMITES, servis, "anthropic-albert/openweight-code"
  );
  assert.strictEqual(limites.rpm, 100);
});

test("Longueurs différentes : aucune déduction", () => {
  assert.strictEqual(
    limitsForModel(LIMITES, MODELES.slice(0, 3), "openweight-code"), null
  );
});

test("Modèle absent de la liste servie : aucune déduction", () => {
  assert.strictEqual(
    limitsForModel(LIMITES, MODELES, "un-modele-inconnu"), null
  );
});

test("Listes vides ou modèle vide : aucune déduction", () => {
  assert.strictEqual(limitsForModel([], [], "openweight-code"), null);
  assert.strictEqual(limitsForModel(LIMITES, MODELES, ""), null);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
