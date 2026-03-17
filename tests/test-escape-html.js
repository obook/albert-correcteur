// Tests — Échappement HTML.

const assert = require("assert");

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

console.log("Échappement HTML :");

test("Texte sans caractères spéciaux", () => {
  assert.strictEqual(escapeHTML("Bonjour le monde"), "Bonjour le monde");
});

test("Esperluette", () => {
  assert.strictEqual(escapeHTML("A & B"), "A &amp; B");
});

test("Chevrons", () => {
  assert.strictEqual(escapeHTML("<script>alert('xss')</script>"), "&lt;script&gt;alert('xss')&lt;/script&gt;");
});

test("Guillemets doubles", () => {
  assert.strictEqual(escapeHTML('Il a dit "bonjour"'), 'Il a dit &quot;bonjour&quot;');
});

test("Tous les caractères spéciaux combinés", () => {
  assert.strictEqual(escapeHTML('<a href="x&y">'), '&lt;a href=&quot;x&amp;y&quot;&gt;');
});

test("Chaîne vide", () => {
  assert.strictEqual(escapeHTML(""), "");
});

test("Caractères accentués non touchés", () => {
  assert.strictEqual(escapeHTML("à é ï ô ü ç"), "à é ï ô ü ç");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
