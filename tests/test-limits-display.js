/*
 * test-limits-display.js
 * Tests : la section "Limites du compte" est bien révélée après un
 * appel réussi à /v1/me/info, et reste masquée quand l'endpoint
 * répond en erreur.
 *
 * La source popup-limits.js est chargée telle quelle, jamais recopiée.
 * Le bug corrigé ici venait de l'attribut hidden posé sur la section :
 * la règle UA [hidden] est en !important, donc style.display = "block"
 * ne la révélait plus.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

/* ---------------------------------------------------------------
 * DOM minimal
 * --------------------------------------------------------------- */

function elementFactice() {
  return {
    hidden: false,
    className: "",
    textContent: "",
    value: "",
    style: {},
    enfants: [],
    appendChild(e) { this.enfants.push(e); },
    addEventListener() {},
  };
}

/**
 * Charge popup-limits.js avec un DOM et un fetch factices.
 *
 * @param {Object} reponses - Map { chemin -> {ok, body} } pour fetch.
 * @returns {{fetchAndShowLimits: Function, elements: Object}}
 */
function chargerPopupLimits(reponses) {
  const racine = path.join(__dirname, "..", "sources-commun");
  const alias = fs.readFileSync(
    path.join(racine, "util", "model-aliases.js"), "utf8"
  );
  const limits = fs.readFileSync(
    path.join(racine, "popup-configuration", "popup-limits.js"), "utf8"
  );

  const elements = {};
  for (const id of ["limits-section", "limits-info", "api-key", "api-base", "model"]) {
    elements[id] = elementFactice();
  }
  const document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = elementFactice();
      return elements[id];
    },
    createElement: () => elementFactice(),
  };

  const appels = [];
  const entetes = [];
  const fetchFactice = async (url, opts) => {
    appels.push(url);
    entetes.push((opts && opts.headers) || {});
    const sansRequete = url.split("?")[0];
    const chemin = Object.keys(reponses).find((c) => sansRequete.endsWith(c));
    if (!chemin) return { ok: false, status: 404 };
    const r = reponses[chemin];
    const body = typeof r.body === "function" ? r.body(url) : r.body;
    return { ok: r.ok !== false, status: r.status || 200, json: async () => body };
  };

  const usine = new Function(
    "document", "fetch",
    alias + "\n" + limits
    + "\nreturn { fetchAndShowLimits, listerModelesApi, modelNames,"
    + " fetchDailyUsageForModel };"
  );
  return { ...usine(document, fetchFactice), elements, appels, entetes };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✓ ${name}`);
    passed++;
  }).catch((e) => {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  });
}

async function main() {
  console.log("Affichage des limites du compte :");

  await test("Section révélée après une réponse valide", async () => {
    const { fetchAndShowLimits, elements } = chargerPopupLimits({
      "/v1/me/info": {
        body: {
          limits: [
            { router_id: 1, type: "rpm", value: 10 },
            { router_id: 1, type: "rpd", value: 1000 },
          ],
        },
      },
      "/v1/models": { body: { data: [] } },
      "/v1/me/usage": { body: { data: [] } },
    });
    elements["api-key"].value = "sk-test";
    elements["model"].value = "openweight-large";

    await fetchAndShowLimits();

    assert.strictEqual(elements["limits-section"].hidden, false,
      "la section doit être révélée");
    assert.ok(elements["limits-info"].enfants.length >= 2,
      "les lignes de quota doivent être ajoutées");
  });

  await test("Motif affiché si /v1/me/info échoue", async () => {
    const { fetchAndShowLimits, elements } = chargerPopupLimits({
      "/v1/me/info": { ok: false, status: 401, body: {} },
    });
    elements["api-key"].value = "sk-test";
    elements["limits-section"].hidden = true;

    await fetchAndShowLimits();

    assert.strictEqual(elements["limits-section"].hidden, false);
    assert.ok(elements["limits-info"].textContent.includes("401"),
      "le code HTTP doit apparaître");
  });

  await test("Endpoint sans /v1/me/info : message dédié, pas d'erreur", async () => {
    const { fetchAndShowLimits, elements } = chargerPopupLimits({});
    elements["api-key"].value = "sk-test";
    elements["limits-section"].hidden = true;

    await fetchAndShowLimits();

    assert.strictEqual(elements["limits-section"].hidden, false);
    assert.ok(!elements["limits-info"].textContent.includes("404"),
      "un endpoint compatible OpenAI n'est pas une panne");
  });

  await test("Motif affiché si la liste de limites est vide", async () => {
    const { fetchAndShowLimits, elements } = chargerPopupLimits({
      "/v1/me/info": { body: { limits: [] } },
    });
    elements["api-key"].value = "sk-test";
    elements["limits-section"].hidden = true;

    await fetchAndShowLimits();

    assert.strictEqual(elements["limits-section"].hidden, false);
    assert.ok(elements["limits-info"].textContent.length > 0);
  });

  await test("Clé vide (proxy local) : limites demandées sans Authorization", async () => {
    const { fetchAndShowLimits, elements, entetes } = chargerPopupLimits({
      "/v1/me/info": { body: { limits: [{ router_id: 1, type: "rpm", value: 10 }] } },
    });
    elements["api-key"].value = "";
    elements["limits-section"].hidden = true;

    await fetchAndShowLimits();

    assert.strictEqual(elements["limits-section"].hidden, false);
    assert.ok(entetes.every((h) => !("Authorization" in h)));
  });

  /* Espaces de noms réels relevés le 25 août 2026 : le proxy sert son
     propre id préfixé, /v1/me/usage les identifiants amont d'Albert. */
  const MODELES_PROXY = {
    data: [{
      id: "anthropic-albert/openweight-code",
      aliases: ["openweight-code", "qwen3-coder-30b-A3b-instruct"],
    }],
  };
  const EVENEMENT = (modele) => ({
    model: modele,
    created: Math.floor(Date.now() / 1000),
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  });

  await test("Usage compté derrière un proxy qui renomme les modèles", async () => {
    const { listerModelesApi, modelNames, fetchDailyUsageForModel } = chargerPopupLimits({
      "/v1/models": { body: MODELES_PROXY },
      "/v1/me/usage": { body: { data: [
        EVENEMENT("qwen3-coder-30b-A3b-instruct"),
        EVENEMENT("qwen3-coder-30b-A3b-instruct"),
        EVENEMENT("openai/gpt-oss-120b"),
      ] } },
    });

    const noms = modelNames(await listerModelesApi("http://p", "sk"), "openweight-code");
    const usage = await fetchDailyUsageForModel("http://p", "sk", noms);

    assert.strictEqual(usage.rpdUsed, 2, "les deux événements du modèle");
    assert.strictEqual(usage.tpdUsed, 240, "prompt + completion sommés");
  });

  await test("Usage compté contre l'API directe (id canonique)", async () => {
    const { listerModelesApi, modelNames, fetchDailyUsageForModel } = chargerPopupLimits({
      "/v1/models": { body: { data: [{
        id: "openai/gpt-oss-120b", aliases: ["openweight-large"],
      }] } },
      "/v1/me/usage": { body: { data: [EVENEMENT("openai/gpt-oss-120b")] } },
    });

    const noms = modelNames(await listerModelesApi("http://a", "sk"), "openweight-large");
    const usage = await fetchDailyUsageForModel("http://a", "sk", noms);

    assert.strictEqual(usage.rpdUsed, 1);
  });

  await test("Pagination : au-delà de 100 événements", async () => {
    const pleine = Array.from({ length: 100 }, () => EVENEMENT("m"));
    const { fetchDailyUsageForModel, appels } = chargerPopupLimits({
      "/v1/me/usage": { body: (url) => ({
        data: url.includes("offset=0") ? pleine : [EVENEMENT("m")],
      }) },
    });

    const usage = await fetchDailyUsageForModel(
      "http://a", "sk", new Set(["m"])
    );

    assert.strictEqual(usage.rpdUsed, 101, "les deux pages comptées");
    assert.ok(appels[0].includes("limit=100"), "limite maximale demandée");
    assert.ok(appels[0].includes("start_time="), "borne de minuit UTC posée");
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
