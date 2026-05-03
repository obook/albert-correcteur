/* Tests -- Calcul de l'usage journalier (rpd, tpd) depuis /v1/me/usage. */

const assert = require("assert");

/* -- Copie de la logique à tester (depuis sources-commun/popup-configuration/popup-limits.js,
      fonction fetchDailyUsageForModel - et sources-commun/service/service-limites.js,
      fonction fetchDailyUsage). On extrait juste le coeur de calcul,
      indépendant de fetch. --
   La fonction reçoit la liste d'évènements et l'identifiant canonique,
   et retourne { rpdUsed, tpdUsed } en sommant les évènements postérieurs
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
    const tokens = (ev.usage || {}).prompt_tokens;
    if (typeof tokens === "number") tpdUsed += tokens;
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

test("Compte les évènements du jour pour le bon modèle", () => {
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

test("Filtre les évènements d'un autre modèle", () => {
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

test("Filtre les évènements antérieurs à minuit UTC", () => {
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

test("Évènement à minuit UTC pile inclus (frontière >=)", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC,
      usage: { prompt_tokens: 10 } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 10 });
});

test("Évènement sans champ usage : compté en rpd, 0 en tpd", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100 },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 1, tpdUsed: 0 });
});

test("Évènement avec usage incomplet : tokens ignorés", () => {
  const events = [
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 100,
      usage: {} },
    { model: "openai/gpt-oss-120b", created: MIDNIGHT_UTC + 200,
      usage: { prompt_tokens: "garbage" } },
  ];
  const result = aggregateDailyUsage(events, "openai/gpt-oss-120b", NOON_UTC);
  assert.deepStrictEqual(result, { rpdUsed: 2, tpdUsed: 0 });
});

test("Évènement sans created ou avec created non-numérique : ignoré", () => {
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

test("Élements null ou non-objets dans la liste : ignorés", () => {
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

test("Comparaison stricte : alias non résolu ne match pas l'id canonique", () => {
  /* L'évènement /v1/me/usage porte toujours l'id canonique. Si on
     interroge avec l'alias serveur, sans résolution préalable, rien
     ne match. C'est pour ça que la résolution d'alias est faite
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
