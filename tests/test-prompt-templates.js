/*
 * test-prompt-templates.js
 * Tests : Templates de prompts (chargement et substitution).
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const LANG_NAMES = { fr: "français", en: "anglais", es: "espagnol", de: "allemand" };
const PROMPTS_DIR = path.join(__dirname, "..", "sources-commun", "prompts");

function buildPrompt(template, lang) {
  const langName = LANG_NAMES[lang] || "français";
  return template.replace(/\{\{LANG\}\}/g, langName);
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

console.log("Templates de prompts :");

test("Le fichier correction.txt existe", () => {
  assert.ok(fs.existsSync(path.join(PROMPTS_DIR, "correction.txt")));
});

test("Le fichier reformulation.txt existe", () => {
  assert.ok(fs.existsSync(path.join(PROMPTS_DIR, "reformulation.txt")));
});

test("correction.txt contient le placeholder {{LANG}}", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  assert.ok(content.includes("{{LANG}}"));
});

test("reformulation.txt contient le placeholder {{LANG}}", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "reformulation.txt"), "utf-8");
  assert.ok(content.includes("{{LANG}}"));
});

test("correction.txt - substitution français", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  const result = buildPrompt(template, "fr");
  assert.ok(result.includes("français"));
  assert.ok(!result.includes("{{LANG}}"));
});

test("correction.txt - substitution anglais", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  const result = buildPrompt(template, "en");
  assert.ok(result.includes("anglais"));
  assert.ok(!result.includes("{{LANG}}"));
});

test("correction.txt - substitution espagnol", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  const result = buildPrompt(template, "es");
  assert.ok(result.includes("espagnol"));
});

test("correction.txt - substitution allemand", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  const result = buildPrompt(template, "de");
  assert.ok(result.includes("allemand"));
});

test("reformulation.txt - substitution français", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "reformulation.txt"), "utf-8");
  const result = buildPrompt(template, "fr");
  assert.ok(result.includes("français"));
  assert.ok(!result.includes("{{LANG}}"));
});

test("Langue inconnue - fallback français", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  const result = buildPrompt(template, "xx");
  assert.ok(result.includes("français"));
});

test("correction.txt contient le format JSON attendu", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  assert.ok(content.includes('"offset"'));
  assert.ok(content.includes('"length"'));
  assert.ok(content.includes('"message"'));
  assert.ok(content.includes('"suggestions"'));
  assert.ok(content.includes('"type"'));
  assert.ok(content.includes('"corrections"'));
});

test("reformulation.txt contient le format JSON attendu", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "reformulation.txt"), "utf-8");
  assert.ok(content.includes('"offset"'));
  assert.ok(content.includes('"length"'));
  assert.ok(content.includes('"suggestions"'));
  assert.ok(content.includes('"corrections"'));
});

test("Toutes les occurrences de {{LANG}} sont remplacées", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "correction.txt"), "utf-8");
  const count = (template.match(/\{\{LANG\}\}/g) || []).length;
  assert.ok(count >= 2, `Attendu au moins 2 occurrences de {{LANG}}, trouvé ${count}`);
  const result = buildPrompt(template, "fr");
  assert.strictEqual((result.match(/\{\{LANG\}\}/g) || []).length, 0);
});

/* -- Traduction -- */

test("traduction.txt existe", () => {
  assert.ok(fs.existsSync(path.join(PROMPTS_DIR, "traduction.txt")));
});

test("traduction.txt contient {{LANG_SOURCE}} et {{LANG_CIBLE}}", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "traduction.txt"), "utf-8");
  assert.ok(content.includes("{{LANG_SOURCE}}"));
  assert.ok(content.includes("{{LANG_CIBLE}}"));
});

test("traduction.txt - substitution français → anglais", () => {
  const template = fs.readFileSync(path.join(PROMPTS_DIR, "traduction.txt"), "utf-8");
  const result = template
    .replace(/\{\{LANG_SOURCE\}\}/g, LANG_NAMES["fr"])
    .replace(/\{\{LANG_CIBLE\}\}/g, LANG_NAMES["en"]);
  assert.ok(result.includes("français"));
  assert.ok(result.includes("anglais"));
  assert.ok(!result.includes("{{LANG_SOURCE}}"));
  assert.ok(!result.includes("{{LANG_CIBLE}}"));
});

test("traduction.txt contient le format JSON attendu", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "traduction.txt"), "utf-8");
  assert.ok(content.includes('"translation"'));
});

test("traduction.txt gère les langues inconnues", () => {
  const content = fs.readFileSync(path.join(PROMPTS_DIR, "traduction.txt"), "utf-8");
  assert.ok(content.toLowerCase().includes("incorrect") || content.toLowerCase().includes("identifie"), "Le prompt doit gérer les langues mal détectées");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
