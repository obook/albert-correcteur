/* Tests -- Construction du HTML souligné (buildHighlightedHTML). */

const assert = require("assert");

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHighlightedHTML(text, corrections) {
  const sorted = corrections
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => a.offset - b.offset);

  let html = "";
  let cursor = 0;

  for (const c of sorted) {
    if (c.offset < cursor) continue;
    if (c.offset > cursor) {
      html += escapeHTML(text.slice(cursor, c.offset));
    }
    const errorText = text.slice(c.offset, c.offset + c.length);
    const typeClass = `albert-error-${c.type || "grammar"}`;
    html += `<span class="albert-error ${typeClass}" data-idx="${c.idx}">${escapeHTML(errorText)}</span>`;
    cursor = c.offset + c.length;
  }

  if (cursor < text.length) {
    html += escapeHTML(text.slice(cursor));
  }

  return html;
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

console.log("Construction du HTML souligné :");

test("Aucune correction — texte inchangé", () => {
  assert.strictEqual(buildHighlightedHTML("Bonjour le monde", []), "Bonjour le monde");
});

test("Une correction spelling", () => {
  const result = buildHighlightedHTML("Bonnjour à tous", [
    { offset: 0, length: 8, type: "spelling", message: "Orthographe", suggestions: ["Bonjour"] },
  ]);
  assert.ok(result.includes('class="albert-error albert-error-spelling"'));
  assert.ok(result.includes("Bonnjour"));
  assert.ok(result.includes("à tous"));
});

test("Une correction grammar", () => {
  const result = buildHighlightedHTML("Il a manger", [
    { offset: 5, length: 6, type: "grammar", message: "Grammaire", suggestions: ["mangé"] },
  ]);
  assert.ok(result.includes("albert-error-grammar"));
  assert.ok(result.includes("manger"));
  assert.ok(result.startsWith("Il a "));
});

test("Une correction style", () => {
  const result = buildHighlightedHTML("C'est bien", [
    { offset: 6, length: 4, type: "style", message: "Style", suggestions: ["excellent"] },
  ]);
  assert.ok(result.includes("albert-error-style"));
});

test("Deux corrections non chevauchantes", () => {
  const result = buildHighlightedHTML("Bonnjour a tous", [
    { offset: 0, length: 8, type: "spelling", message: "", suggestions: [] },
    { offset: 9, length: 1, type: "grammar", message: "", suggestions: [] },
  ]);
  assert.ok(result.includes('data-idx="0"'));
  assert.ok(result.includes('data-idx="1"'));
});

test("Corrections désordonnées — triées par offset", () => {
  const result = buildHighlightedHTML("Bonnjour a tous", [
    { offset: 9, length: 1, type: "grammar", message: "", suggestions: [] },
    { offset: 0, length: 8, type: "spelling", message: "", suggestions: [] },
  ]);
  /* L'index original est préservé */
  assert.ok(result.indexOf('data-idx="1"') < result.indexOf('data-idx="0"'));
});

test("Corrections chevauchantes — la seconde est ignorée", () => {
  const result = buildHighlightedHTML("Bonnjour", [
    { offset: 0, length: 5, type: "spelling", message: "", suggestions: [] },
    { offset: 3, length: 5, type: "grammar", message: "", suggestions: [] },
  ]);
  /* Seule la première correction est appliquée */
  assert.ok(result.includes('data-idx="0"'));
  assert.ok(!result.includes('data-idx="1"'));
});

test("Type par défaut grammar", () => {
  const result = buildHighlightedHTML("erreur ici", [
    { offset: 0, length: 6, message: "", suggestions: [] },
  ]);
  assert.ok(result.includes("albert-error-grammar"));
});

test("Caractères HTML dans le texte — échappés", () => {
  const result = buildHighlightedHTML("<script>alert('xss')</script>", []);
  assert.ok(!result.includes("<script>"));
  assert.ok(result.includes("&lt;script&gt;"));
});

test("Correction à la fin du texte", () => {
  const result = buildHighlightedHTML("Bonjour monde", [
    { offset: 8, length: 5, type: "spelling", message: "", suggestions: [] },
  ]);
  assert.ok(result.endsWith("</span>"));
  assert.ok(result.includes("monde"));
});

test("Correction au début du texte", () => {
  const result = buildHighlightedHTML("Bonnjour le monde", [
    { offset: 0, length: 8, type: "spelling", message: "", suggestions: [] },
  ]);
  assert.ok(result.startsWith('<span class="albert-error'));
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
