/*
 * test-grist.js
 * Tests : recherche par le sens dans une table Grist (option
 * "rechercheGrist") - lecture de l'URL du document et classement avec
 * cache des vecteurs.
 *
 * Les fichiers sont chargés tels quels dans un contexte vm, avec des
 * doublures pour browser, fetch et la configuration.
 *
 * Auteur : O. Booklage
 * Date : novembre 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

function charger(fichier, globales, exposer) {
  const src = fs.readFileSync(path.join(ROOT, fichier), "utf8");
  const ctx = vm.createContext({
    browser: { runtime: { onMessage: { addListener() {} } } },
    ...globales,
  });
  vm.runInContext(src + `;globalThis.__f = ${exposer};`, ctx);
  return ctx.__f;
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

/* -- Adresse de l'API du document -- */

function apiPour(url, estGrist = true) {
  const u = new URL(url);
  return charger("sources-firefox/grist/grist-lecture.js", {
    window: { wrappedJSObject: estGrist ? { gristConfig: {} } : {} },
    location: { origin: u.origin, pathname: u.pathname },
  }, "gristApiDocument")();
}

/* -- Recherche : vecteurs factices, un axe par mot-clé -- */

const AXES = ["chaise", "ordinateur", "traduction"];
const vecteur = (t) => AXES.map((a) => (t.toLowerCase().includes(a) ? 1 : 0.01));

function banc() {
  const stockage = {};
  const envoyes = [];
  const rechercher = charger("sources-firefox/service/service-grist.js", {
    browser: {
      runtime: { onMessage: { addListener() {} } },
      storage: {
        local: {
          get: async (k) => (k in stockage ? { [k]: stockage[k] } : {}),
          set: async (o) => Object.assign(stockage, o),
        },
      },
    },
    loadConfig: async () => ({ apiBase: "http://albert.test", apiKey: "" }),
    enteteApi: () => ({}),
    API_TIMEOUT_MS: 1000,
    AbortSignal: { timeout: () => undefined },
    AlbertLog: { warn() {} },
    fetch: async (url, opts) => {
      const { input } = JSON.parse(opts.body);
      envoyes.push(...input);
      return {
        ok: true,
        json: async () => ({ data: input.map((t, index) => ({ index, embedding: vecteur(t) })) }),
      };
    },
  }, "rechercherGrist");
  return { rechercher, stockage, envoyes };
}

const LIGNES = ["39112000-0 - Chaises", "30213100-6 - Ordinateurs portables",
  "79530000-8 - Services de traduction"];

(async () => {
  console.log("Recherche Grist :");

  await test("URL d'un document sous /o/<org>/", () => {
    assert.strictEqual(apiPour("https://grist.numerique.gouv.fr/o/justice/vfJJco6LFRuG/Nomenclature/p/2"),
      "https://grist.numerique.gouv.fr/o/justice/api/docs/vfJJco6LFRuG");
  });

  await test("URL d'un document sans organisation, et forme /doc/<id>", () => {
    assert.strictEqual(apiPour("https://docs.getgrist.com/vfJJco6LFRuG/Nomenclature"),
      "https://docs.getgrist.com/api/docs/vfJJco6LFRuG");
    assert.strictEqual(apiPour("https://docs.getgrist.com/doc/vfJJco6LFRuGzKr9fu6SZ4"),
      "https://docs.getgrist.com/api/docs/vfJJco6LFRuGzKr9fu6SZ4");
  });

  await test("Pas de document : accueil, espace de travail, site non Grist", () => {
    assert.strictEqual(apiPour("https://grist.numerique.gouv.fr/o/justice/"), null);
    assert.strictEqual(apiPour("https://grist.numerique.gouv.fr/o/justice/ws/12/"), null);
    assert.strictEqual(apiPour("https://exemple.fr/o/x/vfJJco6LFRuG/doc", false), null);
  });

  await test("La ligne la plus proche de la question arrive en tête", async () => {
    const { rechercher } = banc();
    const r = await rechercher({ docKey: "d/T", lignes: LIGNES, question: "acheter une chaise" });
    assert.strictEqual(r.resultats[0].texte, "39112000-0 - Chaises");
    assert.strictEqual(r.resultats.length, 3);
  });

  await test("Le cache évite de recalculer les lignes connues et oublie les supprimées", async () => {
    const { rechercher, stockage, envoyes } = banc();
    await rechercher({ docKey: "d/T", lignes: LIGNES, question: "q1" });
    envoyes.length = 0;
    const lignes2 = [LIGNES[0], "48000000-8 - Logiciels"];
    await rechercher({ docKey: "d/T", lignes: lignes2, question: "q2" });
    assert.deepStrictEqual(envoyes, ["48000000-8 - Logiciels", "q2"]);
    const cache = Object.values(stockage)[0];
    assert.deepStrictEqual(Object.keys(cache).sort(), lignes2.slice().sort());
  });

  await test("Une erreur de l'API remonte en message", async () => {
    const rechercher = charger("sources-firefox/service/service-grist.js", {
      browser: { runtime: { onMessage: { addListener() {} } },
        storage: { local: { get: async () => ({}), set: async () => {} } } },
      loadConfig: async () => ({ apiBase: "x", apiKey: "" }),
      enteteApi: () => ({}),
      API_TIMEOUT_MS: 1,
      AbortSignal: { timeout: () => undefined },
      AlbertLog: { warn() {} },
      fetch: async () => ({ ok: false, status: 401 }),
    }, "rechercherGrist");
    const r = await rechercher({ docKey: "d/T", lignes: LIGNES, question: "q" });
    assert.match(r.error, /401/);
  });

  await test("Une table au-delà du plafond est refusée sans appel à l'API", async () => {
    const { rechercher, envoyes } = banc();
    const r = await rechercher({ docKey: "d/T", lignes: Array.from({ length: 2001 }, (_, i) => "l" + i), question: "q" });
    assert.match(r.error, /2000/);
    assert.strictEqual(envoyes.length, 0);
  });

  await test("Une réponse de l'API mal formée donne un message clair", async () => {
    const rechercher = charger("sources-firefox/service/service-grist.js", {
      browser: { runtime: { onMessage: { addListener() {} } },
        storage: { local: { get: async () => ({}), set: async () => {} } } },
      loadConfig: async () => ({ apiBase: "x", apiKey: "" }),
      enteteApi: () => ({}),
      API_TIMEOUT_MS: 1,
      AbortSignal: { timeout: () => undefined },
      AlbertLog: { warn() {} },
      fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
    }, "rechercherGrist");
    const r = await rechercher({ docKey: "d/T", lignes: LIGNES, question: "q" });
    assert.match(r.error, /Réponse inattendue/);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  process.exit(failed ? 1 : 0);
})();
