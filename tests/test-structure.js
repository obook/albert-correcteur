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

test("Dossier sources/popup-configuration/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-configuration")));
});

test("Dossier sources/popup-contenu/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu")));
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

test("manifest.json — scripts de fond déclarés", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.background.scripts.includes("service/service-config.js"));
  assert.ok(manifest.background.scripts.includes("service/service-menus.js"));
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

test("service/ — tous les scripts de fond existent", () => {
  const fichiers = [
    "service-config.js", "service-langue.js", "service-prompts.js",
    "service-limites.js", "service-api.js", "service-menus.js",
  ];
  for (const f of fichiers) {
    assert.ok(fs.existsSync(path.join(FIREFOX, "service", f)), `Manquant : service/${f}`);
  }
});

test("Ancien service.js monolithique supprimé", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "service", "service.js")), "service/service.js ne devrait plus exister");
});

test("popup/popup.html existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-configuration", "popup.html")));
});

test("popup/popup-settings.html existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-configuration", "popup-settings.html")));
});

test("icons/icon.svg existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon.svg")));
});

test("icons/icon-error.svg existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon-error.svg")));
});

test("icons/icon-48.png existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon-48.png")));
});

test("icons/icon-96.png existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon-96.png")));
});

test("icons/icon-128.png existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "icons", "icon-128.png")));
});

// ── Scripts ──

test("firefox-build.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "firefox-build.sh"));
  assert.ok(stat.mode & 0o111, "firefox-build.sh n'est pas exécutable");
});

test("firefox-publish.sh supprimé", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "firefox-publish.sh")), "firefox-publish.sh ne devrait plus exister");
});

test("install-firefox-dev.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "install-firefox-dev.sh"));
  assert.ok(stat.mode & 0o111, "install-firefox-dev.sh n'est pas exécutable");
});

// ── Dossiers métier ──

test("Dossier sources/etat/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "etat")));
});

test("Dossier sources/correction/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "correction")));
});

test("Dossier sources/verification/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "verification")));
});

test("Dossier sources/affichage/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "affichage")));
});

test("Dossier sources/notification/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "notification")));
});

test("Dossier sources/demarrage/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "demarrage")));
});

test("Dossier sources/service/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "service")));
});

test("css/toast.css existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "css", "toast.css")));
});

test("Ancien dossier toast/ supprimé", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "toast")), "Le dossier toast/ ne devrait plus exister");
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

test("manifest.json — icônes pointent vers des PNG", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const [size, file] of Object.entries(manifest.icons)) {
    assert.ok(file.endsWith(".png"), `Icône ${size} n'est pas un PNG : ${file}`);
  }
  assert.ok(manifest.browser_action.default_icon.endsWith(".png"), "default_icon n'est pas un PNG");
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

// ── Popup contenu ──

test("popup-contenu/albert-popup-common.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-common.js")));
});

test("popup-contenu/albert-popup-correction.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-correction.js")));
});

test("popup-contenu/albert-popup-reformulation.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-reformulation.js")));
});

test("popup-contenu/albert-popup-traduction.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-traduction.js")));
});

test("popup-contenu/albert-popup-messages.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-messages.js")));
});

test("Ancien albert-popup.js supprimé", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "albert-popup.js")), "albert-popup.js ne devrait plus exister");
});

// ── Prompts ──

test("prompts/traduction.txt existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "prompts", "traduction.txt")));
});

test("prompts/traduction.txt contient {{LANG_SOURCE}} et {{LANG_CIBLE}}", () => {
  const content = fs.readFileSync(path.join(FIREFOX, "prompts", "traduction.txt"), "utf-8");
  assert.ok(content.includes("{{LANG_SOURCE}}"), "{{LANG_SOURCE}} manquant");
  assert.ok(content.includes("{{LANG_CIBLE}}"), "{{LANG_CIBLE}} manquant");
});

// ── Licence ──

test("LICENSE existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "LICENSE")));
});

test("LICENSE contient MIT", () => {
  const content = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf-8");
  assert.ok(content.includes("MIT License"));
});

// ── Fichiers supprimés ──

test("updates.json existe et est du JSON valide", () => {
  const p = path.join(ROOT, "updates.json");
  assert.ok(fs.existsSync(p), "updates.json doit exister");
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  assert.ok(data.addons["albert-correcteur@ac-bordeaux.fr"], "doit contenir l'addon albert-correcteur");
  assert.ok(data.addons["albert-correcteur@ac-bordeaux.fr"].updates.length > 0, "doit contenir au moins une entrée de mise à jour");
});

test("MOZILLA.md supprimé", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "MOZILLA.md")), "MOZILLA.md ne devrait plus exister");
});

test("Ancien dossier popup/ supprimé", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "popup")), "Le dossier popup/ ne devrait plus exister");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
