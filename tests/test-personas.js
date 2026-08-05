/*
 * test-personas.js
 * Tests unitaires.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */
/* Tests - Intégrité du catalogue de personas (util/personas.js). */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const personasPath = path.join(
  __dirname, "..",
  "sources-commun", "util", "personas.js"
);
const src = fs.readFileSync(personasPath, "utf8");

/* Le fichier déclare PERSONAS, DEFAULT_PERSONA_ID et getPersonaById au
   scope global du service worker (déclarations const/function). Le
   problème : const/let ne s'attachent pas à globalThis. On suffixe
   donc le source avec une exposition explicite via globalThis avant
   l'exécution dans un contexte vm isolé. */
const exposed = src + `
;globalThis.PERSONAS = PERSONAS;
globalThis.DEFAULT_PERSONA_ID = DEFAULT_PERSONA_ID;
globalThis.getPersonaById = getPersonaById;
`;
const ctx = vm.createContext({});
vm.runInContext(exposed, ctx);
const { PERSONAS, DEFAULT_PERSONA_ID, getPersonaById } = ctx;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("  ✓ " + name);
    passed++;
  } catch (err) {
    console.log("  ✗ " + name + " : " + err.message);
    failed++;
  }
}

test("PERSONAS est un tableau non vide", () => {
  assert.ok(Array.isArray(PERSONAS));
  assert.ok(PERSONAS.length >= 1);
});

test("Chaque persona a tous les champs requis", () => {
  for (const p of PERSONAS) {
    for (const field of ["id", "label", "description", "tone", "example"]) {
      assert.ok(typeof p[field] === "string" && p[field].length > 0,
        "Persona " + JSON.stringify(p) + " : champ '" + field + "' manquant ou vide");
    }
  }
});

test("Tous les ids sont en kebab-case sans accent", () => {
  const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const p of PERSONAS) {
    assert.ok(kebab.test(p.id), "id '" + p.id + "' non conforme");
  }
});

test("Tous les ids sont uniques", () => {
  const ids = PERSONAS.map((p) => p.id);
  const unique = new Set(ids);
  assert.strictEqual(unique.size, ids.length,
    "ids dupliqués : " + JSON.stringify(ids));
});

test("DEFAULT_PERSONA_ID existe dans PERSONAS", () => {
  const found = PERSONAS.find((p) => p.id === DEFAULT_PERSONA_ID);
  assert.ok(found, "DEFAULT_PERSONA_ID '" + DEFAULT_PERSONA_ID
    + "' ne correspond à aucun persona");
});

test("getPersonaById(id) retourne le bon persona", () => {
  for (const p of PERSONAS) {
    assert.strictEqual(getPersonaById(p.id).id, p.id);
  }
});

test("getPersonaById(inconnu) retourne le premier persona", () => {
  assert.strictEqual(getPersonaById("identifiant-inconnu").id, PERSONAS[0].id);
});

test("getPersonaById(vide) retourne le premier persona", () => {
  assert.strictEqual(getPersonaById("").id, PERSONAS[0].id);
  assert.strictEqual(getPersonaById(null).id, PERSONAS[0].id);
  assert.strictEqual(getPersonaById(undefined).id, PERSONAS[0].id);
});

test("Le persona 'neutre' existe (utilisé comme fallback UX)", () => {
  assert.ok(PERSONAS.find((p) => p.id === "neutre"),
    "Le persona 'neutre' doit exister, c'est le défaut affiché à l'utilisateur");
});

console.log("\n" + passed + " passé(s), " + failed + " échoué(s)");
process.exit(failed > 0 ? 1 : 0);
