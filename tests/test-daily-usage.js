/*
 * test-daily-usage.js
 * Tests : Calcul de l'usage journalier (rpd, tpd) depuis /v1/me/usage.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");

/* -- Copie du cœur de calcul de fetchDailyUsageForModel
      (sources-commun/popup-configuration/popup-limits.js), extrait de
      sa partie réseau. --
   La fonction reçoit la liste d'événements et l'identifiant canonique,
   et retourne { rpdUsed, tpdUsed } en sommant les événements postérieurs
   à minuit UTC du jour courant simulé. */

function aggregateDailyUsage(events, canonicalId, now) {
  if (!canonicalId) return { rpdUsed: 0, tpdUsed: 0 };
  const utcMidnight = Math.floor(
    Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate()
    ) / 1000
  );

  let rpdUsed = 0;
  let tpdUsed = 0;
  for (const ev of events) {
    if (!ev || ev.model !== canonicalId) continue;
    if (typeof ev.created !== "number" || ev.created < utcMidnight) continue;
    rpdUsed += 1;
    /* Le quota tpd d'Albert couvre le prompt et la complétion : sommer
       les deux, sans quoi l'usage affiché est très en dessous du réel. */
    const usage = ev.usage || {};
    const promptTokens = typeof usage.prompt_tokens === "number"
      ? usage.prompt_tokens : 0;
    const completionTokens = typeof usage.completion_tokens === "number"
      ? usage.completion_tokens : 0;
    tpdUsed += promptTokens + completionTokens;
  }
  return { rpdUsed, tpdUsed };
}

/* -- Tests -- */

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

console.log("Usage journalier :");

/* Référence : milieu de journée 2026-05-03 12:00 UTC */
const NOON_UTC = Date.UTC(2026, 4, 3, 12, 0, 0);
const MIDNIGHT_UTC = Math.floor(Date.UTC(2026, 4, 3, 0, 0, 0) / 1000);

test("Liste vide : compteurs à zéro", () => {
  const result = aggregateDailyUsage([], "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 0, tpdUsed: 0 });
});

test("Modèle vide : retour direct sans calcul", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 50 } },
  ];
  const result = aggregateDailyUsage(events, "", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 0, tpdUsed: 0 });
});

test("Compte les événements du jour pour le bon modèle", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 50 } },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 3600,
      usage: { prompt_tokens: 200 } },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 7200,
      usage: { prompt_tokens: 80 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 3, tpdUsed: 330 });
});

test("Filtre les événements d'un autre modèle", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 50 } },
    { model: "mistralai/ministral-3-8b-instruct-2512",
      created: MIDNIGHT_UTC + 200, usage: { prompt_tokens: 999 } },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 300,
      usage: { prompt_tokens: 30 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 2, tpdUsed: 80 });
});

test("Filtre les événements antérieurs à minuit UTC", () => {
  const events = [
    /* Hier soir : 23h59 UTC la veille */
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC - 60,
      usage: { prompt_tokens: 1000 } },
    /* Aujourd'hui */
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 60,
      usage: { prompt_tokens: 50 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 50 });
});

test("Le tpd somme les tokens de prompt et de complétion", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 60,
      usage: { prompt_tokens: 120, completion_tokens: 80 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 200 });
});

test("Complétion seule comptée quand le prompt est absent", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 60,
      usage: { completion_tokens: 45 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 45 });
});

test("Cumul prompt et complétion sur plusieurs événements", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 10,
      usage: { prompt_tokens: 100, completion_tokens: 50 } },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 20,
      usage: { prompt_tokens: 30, completion_tokens: 20 } },
    /* Sans complétion : seul le prompt compte. */
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 30,
      usage: { prompt_tokens: 10 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 3, tpdUsed: 210 });
});

test("Valeurs de tokens non numériques ignorées", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 60,
      usage: { prompt_tokens: "50", completion_tokens: null } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 0 });
});

test("Événement à minuit UTC pile inclus (frontière >=)", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC,
      usage: { prompt_tokens: 10 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 10 });
});

test("Événement sans champ usage : compté en rpd, 0 en tpd", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100 },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 0 });
});

test("Événement avec usage incomplet : tokens ignorés", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: {} },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 200,
      usage: { prompt_tokens: "garbage" } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 2, tpdUsed: 0 });
});

test("Événement sans created ou avec created non-numérique : ignoré", () => {
  const events = [
    { model: "openai/gpt-oss-120b", usage: { prompt_tokens: 50 } },
    { model: "openai/gpt-oss-120b", created: "not-a-number",
      usage: { prompt_tokens: 50 } },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 30 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 30 });
});

test("Éléments null ou non-objets dans la liste : ignorés", () => {
  const events = [
    null,
    undefined,
    "not-an-event",
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 30 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 30 });
});

test("Modèle non trouvé : compteurs à zéro", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 50 } },
  ];
  const result = aggregateDailyUsage(events, "modele-inconnu", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 0, tpdUsed: 0 });
});

test("Comparaison stricte : alias non résolu ne correspond pas à l'id canonique", () => {
  /* L'événement /v1/me/usage porte toujours l'id canonique. Si on
     interroge avec l'alias serveur, sans résolution préalable, rien
     ne correspond. C'est pourquoi la résolution d'alias est faite
     en amont dans le code de prod. */
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: { prompt_tokens: 50 } },
  ];
  const result = aggregateDailyUsage(events, "openweight-large", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 0, tpdUsed: 0 });
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
