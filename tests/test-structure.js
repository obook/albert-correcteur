// Tests — Vérification de la structure du projet.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FIREFOX = path.join(ROOT, "sources");

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

console.log("Structure du projet :");

// ── Dossiers ──

test("Dossier sources/ existe", () => {
  assert.ok(fs.existsSync(FIREFOX));
});

test("Dossier sources/css/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "css")));
});

test("Dossier sources/icons/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons")));
});

test("Dossier sources/popup/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup")));
});

test("Dossier sources/prompts/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "prompts")));
});

// ── Manifest ──

test("manifest.json existe et est du JSON valide", () => {
  const content = fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8");
  const manifest = JSON.parse(content);
  assert.ok(manifest);
});

test("manifest.json — manifest_version = 2", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.strictEqual(manifest.manifest_version, 2);
});

test("manifest.json — a un ID gecko", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.browser_specific_settings.gecko.id);
});

test("manifest.json — background script déclaré", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.background.scripts.includes("background.js"));
});

test("manifest.json — content scripts déclarés", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  const cs = manifest.content_scripts[0];
  assert.ok(cs.js.length > 0);
  assert.ok(cs.css.length > 0);
});

test("manifest.json — tous les JS content scripts existent", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const jsFile of manifest.content_scripts[0].js) {
    assert.ok(fs.existsSync(path.join(FIREFOX, jsFile)), `Manquant : ${jsFile}`);
  }
});

test("manifest.json — tous les CSS content scripts existent", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const cssFile of manifest.content_scripts[0].css) {
    assert.ok(fs.existsSync(path.join(FIREFOX, cssFile)), `Manquant : ${cssFile}`);
  }
});

test("manifest.json — options_ui déclaré", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.options_ui);
  assert.ok(manifest.options_ui.page);
});

test("manifest.json — popup déclarée", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.browser_action.default_popup);
});

// ── Fichiers clés ──

test("background.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "background.js")));
});

test("popup/popup.html existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup", "popup.html")));
});

test("popup/popup-settings.html existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup", "popup-settings.html")));
});

test("icons/icon.svg existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon.svg")));
});

test("icons/icon-ok.svg existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon-ok.svg")));
});

test("Pas de PNG résiduels dans icons/", () => {
  const icons = fs.readdirSync(path.join(FIREFOX, "icons"));
  const pngs = icons.filter((f) => f.endsWith(".png"));
  assert.strictEqual(pngs.length, 0, `PNG résiduels : ${pngs.join(", ")}`);
});

// ── Scripts ──

test("firefox-build.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "firefox-build.sh"));
  assert.ok(stat.mode & 0o111, "firefox-build.sh n'est pas exécutable");
});

test("firefox-publish.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "firefox-publish.sh"));
  assert.ok(stat.mode & 0o111, "firefox-publish.sh n'est pas exécutable");
});

test("install-firefox-dev.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "install-firefox-dev.sh"));
  assert.ok(stat.mode & 0o111, "install-firefox-dev.sh n'est pas exécutable");
});

// ── Dossier toast ──

test("Dossier sources/toast/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "toast")));
});

test("toast/albert-toast.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "toast", "albert-toast.js")));
});

test("toast/toast.css existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "toast", "toast.css")));
});

// ── Manifest : permissions ──

test("manifest.json — permission contextMenus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.permissions.includes("contextMenus"), "Permission contextMenus manquante");
});

test("manifest.json — permission storage", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.permissions.includes("storage"), "Permission storage manquante");
});

// ── Manifest : icônes SVG uniquement ──

test("manifest.json — icônes pointent vers des SVG", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const [size, file] of Object.entries(manifest.icons)) {
    assert.ok(file.endsWith(".svg"), `Icône ${size} n'est pas un SVG : ${file}`);
  }
  assert.ok(manifest.browser_action.default_icon.endsWith(".svg"), "default_icon n'est pas un SVG");
});

// ── Fichiers résiduels ──

test("content.css absent (découpé en css/)", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "content.css")), "content.css ne devrait plus exister");
});

test("Pas de fichier popup.js résiduel dans firefox/", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "firefox")), "Le dossier firefox/ ne devrait plus exister");
});

// ── Page de test ──

test("Dossier exemple/ existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "exemple")));
});

test("exemple/test.html existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "exemple", "test.html")));
});

// ── Tests ──

test("Dossier tests/ existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "tests")));
});

test("tests/run-all.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "tests", "run-all.sh"));
  assert.ok(stat.mode & 0o111, "run-all.sh n'est pas exécutable");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
