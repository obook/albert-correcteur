/*
 * test-structure.js
 * Tests : Vérification de la structure du projet.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SHARED = path.join(ROOT, "sources-commun");
const FIREFOX = path.join(ROOT, "sources-firefox");
const THUNDERBIRD = path.join(ROOT, "sources-thunderbird");

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

/* -- Dossiers -- */

test("Dossier sources-commun/ existe", () => {
  assert.ok(fs.existsSync(SHARED));
});

test("Dossier sources-firefox/ existe", () => {
  assert.ok(fs.existsSync(FIREFOX));
});

test("Dossier sources-firefox/css/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "css")));
});

test("Dossier sources-commun/icons/ existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "icons")));
});

test("Dossier sources-commun/popup-configuration/ existe (partagé)", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "popup-configuration")));
});

test("Dossier sources-firefox/popup-contenu/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu")));
});

test("Dossier sources-commun/prompts/ existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "prompts")));
});

/* -- Manifest -- */

test("manifest.json existe et est du JSON valide", () => {
  const content = fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8");
  const manifest = JSON.parse(content);
  assert.ok(manifest);
});

test("manifest.json - manifest_version = 2", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.strictEqual(manifest.manifest_version, 2);
});

test("manifest.json - a un ID gecko", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.browser_specific_settings.gecko.id);
});

test("manifest.json - scripts de fond déclarés", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.background.scripts.includes("service/service-config.js"));
  assert.ok(manifest.background.scripts.includes("service/service-menus.js"));
});

test("manifest.json - content scripts déclarés", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  const cs = manifest.content_scripts[0];
  assert.ok(cs.js.length > 0);
  assert.ok(cs.css.length > 0);
});

test("manifest.json - tous les JS content scripts existent", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const jsFile of manifest.content_scripts[0].js) {
    const inFirefox = fs.existsSync(path.join(FIREFOX, jsFile));
    const inShared = fs.existsSync(path.join(SHARED, jsFile));
    assert.ok(inFirefox || inShared, `Manquant : ${jsFile}`);
  }
});

test("manifest.json - tous les CSS content scripts existent", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const cssFile of manifest.content_scripts[0].css) {
    const inFirefox = fs.existsSync(path.join(FIREFOX, cssFile));
    const inShared = fs.existsSync(path.join(SHARED, cssFile));
    assert.ok(inFirefox || inShared, `Manquant : ${cssFile}`);
  }
});

test("manifest.json - options_ui déclaré", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.options_ui);
  assert.ok(manifest.options_ui.page);
});

test("manifest.json - popup déclarée", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.browser_action.default_popup);
});

/* -- Fichiers clés -- */

test("service/ - tous les scripts partagés existent", () => {
  const fichiers = [
    "service-config.js", "service-langue.js", "service-prompts.js",
    "service-limites.js", "service-fallback.js", "service-rate-limit.js",
    "service-api.js",
  ];
  for (const f of fichiers) {
    assert.ok(fs.existsSync(path.join(SHARED, "service", f)), `Manquant : sources-commun/service/${f}`);
  }
});

test("service/ - service-menus.js existe dans sources-firefox", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "service", "service-menus.js")), "Manquant : sources-firefox/service/service-menus.js");
});

test("Ancien service.js monolithique supprimé", () => {
  assert.ok(!fs.existsSync(path.join(SHARED, "service", "service.js")), "service/service.js ne devrait plus exister");
});

test("popup/popup.html existe (partagé)", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "popup-configuration", "popup.html")));
});

test("popup/popup-settings.html existe (partagé)", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "popup-configuration", "popup-settings.html")));
});

test("icons/icon.svg existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "icons", "icon.svg")));
});

test("icons/icon-error.svg existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "icons", "icon-error.svg")));
});

test("icons/icon-48.png existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "icons", "icon-48.png")));
});

test("icons/icon-96.png existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "icons", "icon-96.png")));
});

test("icons/icon-128.png existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "icons", "icon-128.png")));
});

/* -- Scripts -- */

test("build.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "build.sh"));
  assert.ok(stat.mode & 0o111, "build.sh n'est pas exécutable");
});

test("firefox-publish.sh supprimé", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "firefox-publish.sh")), "firefox-publish.sh ne devrait plus exister");
});

test("install-firefox-dev.sh supprimé", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "install-firefox-dev.sh")), "install-firefox-dev.sh ne devrait plus exister");
});

/* -- Dossiers métier -- */

test("Dossier sources-firefox/etat/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "etat")));
});

test("Dossier sources-firefox/correction/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "correction")));
});

test("Dossier sources-firefox/verification/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "verification")));
});

test("Dossier sources-firefox/affichage/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "affichage")));
});

test("Dossier sources-commun/notification/ existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "notification")));
});

test("Toast partagé entre les cibles, sans copie spécifique", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "notification", "toast.js")),
    "sources-commun/notification/toast.js manquant");
  assert.ok(!fs.existsSync(path.join(FIREFOX, "notification")),
    "sources-firefox/notification/ aurait dû disparaître avec la factorisation");
  assert.ok(!fs.existsSync(path.join(THUNDERBIRD, "compose", "compose-toast.js")),
    "compose-toast.js aurait dû disparaître avec la factorisation");
});

test("Dossier sources-firefox/demarrage/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "demarrage")));
});

test("Dossier sources-commun/service/ existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "service")));
});

test("Dossier sources-firefox/service/ existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "service")));
});

test("css/toast.css existe (partagé)", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "css", "toast.css")));
});

test("Ancien dossier toast/ supprimé", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "toast")), "Le dossier toast/ ne devrait plus exister");
});

/* -- Popups partagées entre les cibles -- */

test("util/popup-base.js et util/ui-root.js sont communs aux cibles", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "util", "popup-base.js")));
  assert.ok(fs.existsSync(path.join(SHARED, "util", "ui-root.js")));
});

test("Plus aucune copie de la popup de traduction par cible", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-traduction.js")));
  assert.ok(!fs.existsSync(path.join(THUNDERBIRD, "compose", "compose-popup-traduction.js")));
  assert.ok(!fs.existsSync(path.join(THUNDERBIRD, "message", "message-traduction.html")));
});

/* -- Manifest Thunderbird : tout ce qui est déclaré existe.
   Les compose scripts et les scripts de message ne passent pas par le
   manifest ; leurs listes vivent dans deux fichiers du service. Un
   fichier manquant n'y serait vu qu'au chargement de l'extension. -- */

function fichiersListes(fichierService, nomListe) {
  const source = fs.readFileSync(path.join(THUNDERBIRD, "service", fichierService), "utf-8");
  const bloc = source.match(new RegExp(nomListe + "\\s*=\\s*\\[([^\\]]*)\\]"));
  assert.ok(bloc, `${nomListe} introuvable dans ${fichierService}`);
  return [...bloc[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function existeDansThunderbird(fichier) {
  return fs.existsSync(path.join(THUNDERBIRD, fichier))
    || fs.existsSync(path.join(SHARED, fichier));
}

test("manifest Thunderbird - tous les scripts de fond existent", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(THUNDERBIRD, "manifest.json"), "utf-8"));
  for (const js of manifest.background.scripts) {
    assert.ok(existeDansThunderbird(js), `Manquant : ${js}`);
  }
});

test("manifest Thunderbird - un bouton dans la barre principale et un dans la rédaction", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(THUNDERBIRD, "manifest.json"), "utf-8"));
  assert.ok(manifest.browser_action, "browser_action manquant");
  /* Le bouton de rédaction, retiré en août 2026 au profit d'un bouton
     unique, est revenu : la barre principale le relègue trop loin à
     droite et c'est en écrivant qu'on change la langue ou le thème. */
  assert.ok(manifest.compose_action, "compose_action manquant");
  assert.strictEqual(manifest.compose_action.default_popup, manifest.browser_action.default_popup,
    "les deux boutons ouvrent la même popup");
});

test("manifest Thunderbird - messagesModify pour les scripts de message", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(THUNDERBIRD, "manifest.json"), "utf-8"));
  assert.ok(manifest.permissions.includes("messagesModify"));
});

test("Thunderbird - tous les compose scripts et leurs CSS existent", () => {
  for (const f of fichiersListes("service-compose-scripts.js", "COMPOSE_JS")) {
    assert.ok(existeDansThunderbird(f), `Manquant : ${f}`);
  }
  for (const f of fichiersListes("service-compose-scripts.js", "COMPOSE_CSS")) {
    assert.ok(existeDansThunderbird(f), `Manquant : ${f}`);
  }
});

test("Thunderbird - tous les scripts de message et leurs CSS existent", () => {
  for (const f of fichiersListes("service-message-scripts.js", "MESSAGE_JS")) {
    assert.ok(existeDansThunderbird(f), `Manquant : ${f}`);
  }
  for (const f of fichiersListes("service-message-scripts.js", "MESSAGE_CSS")) {
    assert.ok(existeDansThunderbird(f), `Manquant : ${f}`);
  }
});

/* -- Manifest : permissions -- */

test("manifest.json - permission contextMenus", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.permissions.includes("contextMenus"), "Permission contextMenus manquante");
});

test("manifest.json - permission storage", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  assert.ok(manifest.permissions.includes("storage"), "Permission storage manquante");
});

/* -- Manifest : icônes au format PNG -- */

test("manifest.json - icônes pointent vers des PNG", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX, "manifest.json"), "utf-8"));
  for (const [size, file] of Object.entries(manifest.icons)) {
    assert.ok(file.endsWith(".png"), `Icône ${size} n'est pas un PNG : ${file}`);
  }
  assert.ok(manifest.browser_action.default_icon.endsWith(".png"), "default_icon n'est pas un PNG");
});

/* -- Fichiers résiduels -- */

test("content.css absent (découpé en css/)", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "content.css")), "content.css ne devrait plus exister");
});

test("Pas de fichier popup.js résiduel dans firefox/", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "firefox")), "Le dossier firefox/ ne devrait plus exister");
});

/* -- Page de test -- */

test("Dossier exemple/ existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "exemple")));
});

test("exemple/test.html existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "exemple", "test.html")));
});

test("exemple/servir-test.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "exemple", "servir-test.sh"));
  assert.ok(stat.mode & 0o111, "servir-test.sh n'est pas exécutable");
});

test("util/blancs.js est chargé par les trois cibles, après l'état", () => {
  /* Le module sert au content script comme au service worker : oublier
     un des chargements laisse Albert.normaliserBlancs indéfini et fait
     échouer toute application de correction.
     L'ordre compte autant que la présence : albert-state.js et
     compose-state.js remplacent l'objet Albert en entier, charger
     blancs.js avant eux revient à ne pas le charger. */
  const firefox = JSON.parse(fs.readFileSync(
    path.join(ROOT, "sources-firefox", "manifest.json"), "utf8"));
  const chromium = JSON.parse(fs.readFileSync(
    path.join(ROOT, "sources-chromium", "manifest.json"), "utf8"));
  const thunderbird = JSON.parse(fs.readFileSync(
    path.join(ROOT, "sources-thunderbird", "manifest.json"), "utf8"));
  const worker = fs.readFileSync(
    path.join(ROOT, "sources-chromium", "service", "service-worker.js"), "utf8");
  const compose = fs.readFileSync(
    path.join(ROOT, "sources-thunderbird", "service", "service-compose-scripts.js"), "utf8");

  assert.ok(fs.existsSync(path.join(ROOT, "sources-commun", "util", "blancs.js")));
  assert.ok(firefox.background.scripts.includes("util/blancs.js"));
  assert.ok(thunderbird.background.scripts.includes("util/blancs.js"));
  assert.ok(worker.includes("../util/blancs.js"), "absent de importScripts (Chromium)");

  /* Content scripts : présent et placé après l'état. */
  for (const [nom, liste] of [["Firefox", firefox.content_scripts[0].js],
    ["Chromium", chromium.content_scripts[0].js]]) {
    const iBlancs = liste.indexOf("util/blancs.js");
    const iEtat = liste.indexOf("etat/albert-state.js");
    assert.ok(iBlancs !== -1, nom + " : util/blancs.js absent");
    assert.ok(iBlancs > iEtat, nom + " : util/blancs.js chargé avant albert-state.js");
  }

  /* Scripts de composition Thunderbird : même contrainte d'ordre. */
  const iBlancs = compose.indexOf("util/blancs.js");
  const iEtat = compose.indexOf("compose/compose-state.js");
  assert.ok(iBlancs !== -1, "absent des scripts de composition");
  assert.ok(iBlancs > iEtat, "util/blancs.js chargé avant compose-state.js");
});

/* -- Tests -- */

test("Dossier tests/ existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "tests")));
});

test("tests/run-all.sh existe et est exécutable", () => {
  const stat = fs.statSync(path.join(ROOT, "tests", "run-all.sh"));
  assert.ok(stat.mode & 0o111, "run-all.sh n'est pas exécutable");
});

/* -- Popup contenu -- */

test("popup-contenu/albert-popup-common.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-common.js")));
});

test("popup-contenu/albert-popup-correction.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-correction.js")));
});

test("popup-contenu/albert-popup-reformulation.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-reformulation.js")));
});

test("popup-contenu/popup-traduction.js est commun aux cibles", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "popup-contenu", "popup-traduction.js")));
});

test("popup-contenu/popup-layout.js est commun aux cibles", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "popup-contenu", "popup-layout.js")));
});

test("popup-contenu/albert-popup-messages.js existe", () => {
  assert.ok(fs.existsSync(path.join(FIREFOX, "popup-contenu", "albert-popup-messages.js")));
});

test("Ancien albert-popup.js supprimé", () => {
  assert.ok(!fs.existsSync(path.join(FIREFOX, "albert-popup.js")), "albert-popup.js ne devrait plus exister");
});

/* -- Prompts -- */

test("prompts/traduction.txt existe", () => {
  assert.ok(fs.existsSync(path.join(SHARED, "prompts", "traduction.txt")));
});

test("prompts/traduction.txt contient {{LANG_SOURCE}} et {{LANG_CIBLE}}", () => {
  const content = fs.readFileSync(path.join(SHARED, "prompts", "traduction.txt"), "utf-8");
  assert.ok(content.includes("{{LANG_SOURCE}}"), "{{LANG_SOURCE}} manquant");
  assert.ok(content.includes("{{LANG_CIBLE}}"), "{{LANG_CIBLE}} manquant");
});

/* -- Licence -- */

test("LICENSE existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "LICENSE")));
});

test("LICENSE contient MIT", () => {
  const content = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf-8");
  assert.ok(content.includes("MIT License"));
});

/* -- Fichiers supprimés -- */

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
  assert.ok(!fs.existsSync(path.join(FIREFOX, "popup")), "Le dossier popup/ ne devrait plus exister dans sources-firefox/");
  assert.ok(!fs.existsSync(path.join(SHARED, "popup")), "Le dossier popup/ ne devrait plus exister dans sources-commun/");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
