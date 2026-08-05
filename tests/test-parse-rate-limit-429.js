/*
 * test-parse-rate-limit-429.js
 * Tests : extraction du Retry-After, du type de limite et du message
 * depuis une réponse 429 d'Albert.
 *
 * Le module de production est chargé et évalué tel quel, sans copie :
 * une copie finit toujours par diverger, et c'est précisément ce qui
 * s'était produit ici (les branches de limite journalière manquaient,
 * si bien que le test validait un comportement que le code n'avait
 * plus).
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

/* Le module s'exécute dans un service worker et n'exporte rien : on
   l'évalue et on récupère les symboles nécessaires aux tests. */
const source = fs.readFileSync(
  path.join(__dirname, "..", "sources-commun", "service", "service-rate-limit.js"),
  "utf8"
);
const { parseRateLimit429, secondsUntilNextUtcMidnight, DAILY_RETRY_CAP_S } =
  new Function(
    source
    + "\nreturn { parseRateLimit429, secondsUntilNextUtcMidnight, DAILY_RETRY_CAP_S };"
  )();

/* Construit une fausse Response avec un en-tête Retry-After. */
function makeResponse(retryAfterHeader) {
  return {
    headers: {
      get(name) {
        if (name === "Retry-After") return retryAfterHeader;
        return null;
      },
    },
  };
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

console.log("Extraction du Retry-After 429 :");

/* --- Source 1 : en-tête HTTP --- */

test("En-tête Retry-After prioritaire sur tout le reste", () => {
  const response = makeResponse("45");
  const detail = JSON.stringify({
    detail: "Limit exceeded: 50 requests per minute",
    retry_after: 99,
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(retryAfter, 45);
});

test("En-tête absent : retombée sur le calcul du corps", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 50 requests per minute",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  /* 60 / 50 = 1,2 -> arrondi à 2 (plancher) */
  assert.strictEqual(retryAfter, 2);
});

test("En-tête zéro ou négatif : ignoré", () => {
  const response = makeResponse("0");
  const detail = JSON.stringify({ retry_after: 12 });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(retryAfter, 12);
});

/* --- Source 2 : champ retry_after du JSON --- */

test("Champ retry_after du JSON utilisé si en-tête absent", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({ retry_after: 17 });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(retryAfter, 17);
});

test("retry_after fractionnaire arrondi vers le haut", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({ retry_after: 4.2 });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(retryAfter, 5);
});

/* --- Source 3 : calcul depuis le message, limite à la minute --- */

test("Calcul depuis « requests per minute »", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 10 requests per minute",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  /* 60 / 10 = 6 */
  assert.strictEqual(retryAfter, 6);
});

test("Calcul depuis « tokens per minute »", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 30 tokens per minute",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  /* 60 / 30 = 2 */
  assert.strictEqual(retryAfter, 2);
});

test("Plancher de 2 secondes appliqué (limite très élevée)", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 1000 requests per minute",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  /* 60 / 1000 = 0,06 -> plancher 2 */
  assert.strictEqual(retryAfter, 2);
});

/* --- Source 4 : limite journalière, alignée sur minuit UTC --- */

test("Limite journalière : délai jusqu'à minuit UTC, plafonné", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 1000 requests per day",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  const attendu = Math.min(secondsUntilNextUtcMidnight(), DAILY_RETRY_CAP_S);
  assert.strictEqual(retryAfter, attendu);
  /* Le délai ne doit jamais provenir de la division 86400 / 1000. */
  assert.notStrictEqual(retryAfter, 87);
  assert.ok(retryAfter <= DAILY_RETRY_CAP_S,
    `délai ${retryAfter}s au-delà du plafond ${DAILY_RETRY_CAP_S}s`);
});

test("Limite journalière en tokens : même traitement", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({ detail: "Limit: 100000 tokens per day" });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.ok(retryAfter <= DAILY_RETRY_CAP_S);
  assert.ok(retryAfter >= 1);
});

test("Limite journalière : l'en-tête Retry-After reste prioritaire", () => {
  const response = makeResponse("120");
  const detail = JSON.stringify({ detail: "rpd exceeded" });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(retryAfter, 120);
});

/* --- Détection du type de limite --- */

test("limitType : rpm depuis « requests per minute »", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({
    detail: "Limit exceeded: 50 requests per minute",
  });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/minute (rpm)");
});

test("limitType : rpd depuis « requests per day »", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({
    detail: "Limit exceeded: 1000 requests per day",
  });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/jour (rpd)");
});

test("limitType : tpm depuis l'acronyme dans le message", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({ detail: "tpm exceeded" });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "tokens/minute (tpm)");
});

test("limitType : tpd depuis « tokens per day »", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({ detail: "Limit: 100000 tokens per day" });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "tokens/jour (tpd)");
});

test("limitType vide quand aucun motif n'est reconnu", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({ detail: "Some other error" });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "");
});

/* --- Message affiché à l'utilisateur --- */

test("Message : limite à la minute avec type identifié", () => {
  const response = makeResponse("30");
  const detail = JSON.stringify({
    detail: "Limit exceeded: 50 requests per minute",
  });
  const { message } = parseRateLimit429(response, detail);
  assert.strictEqual(message,
    "Limite requêtes/minute (rpm) dépassée. Pause de 30s.");
});

test("Message : limite sans type identifié", () => {
  const response = makeResponse("30");
  const detail = JSON.stringify({ detail: "Some other error" });
  const { message } = parseRateLimit429(response, detail);
  assert.strictEqual(message, "Limite de débit dépassée. Pause de 30s.");
});

test("Message : quota journalier avec type identifié", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({ detail: "Limit: 1000 requests per day" });
  const { message } = parseRateLimit429(response, detail);
  assert.ok(message.startsWith("Quota requêtes/jour (rpd) épuisé."),
    `message inattendu : ${message}`);
  assert.ok(message.includes("minuit UTC"));
});

test("Message : marqueur rpd seul, message bien formé", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({ detail: "rpd" });
  const { limitType, message } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/jour (rpd)");
  assert.ok(!message.includes("  "), `double espace dans : ${message}`);
});

test("Tout marqueur journalier produit un message bien formé", () => {
  /* Invariant à préserver : les mêmes marqueurs pilotent isDailyLimit et
     limitType, donc un quota journalier porte toujours un type et le
     message ne peut pas se réduire à « Quota  épuisé. ». Ce test échoue
     si un futur marqueur journalier est ajouté sans son libellé. */
  const response = makeResponse(null);
  const marqueurs = [
    "rpd", "tpd", "requests per day", "tokens per day",
    "RPD", "Limit exceeded: 1000 requests per day",
  ];
  for (const marqueur of marqueurs) {
    const { message } = parseRateLimit429(
      response, JSON.stringify({ detail: marqueur })
    );
    assert.ok(message.startsWith("Quota "),
      `message non journalier pour « ${marqueur} » : ${message}`);
    assert.ok(!message.includes("  "),
      `double espace pour « ${marqueur} » : ${message}`);
    assert.ok(!message.startsWith("Quota  "),
      `type manquant pour « ${marqueur} » : ${message}`);
  }
});

/* --- Filets de sécurité --- */

test("Aucune source disponible : 30 s par défaut", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({ detail: "rate limited" });
  const { retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(retryAfter, 30);
});

test("Corps non-JSON : pris comme texte brut pour limitType", () => {
  const response = makeResponse(null);
  const detail = "Limit exceeded: 25 requests per minute";
  const { retryAfter, limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/minute (rpm)");
  /* 60 / 25 = 2,4 -> 3 */
  assert.strictEqual(retryAfter, 3);
});

test("Corps vide : 30 s par défaut, limitType vide", () => {
  const response = makeResponse(null);
  const { retryAfter, limitType } = parseRateLimit429(response, "");
  assert.strictEqual(retryAfter, 30);
  assert.strictEqual(limitType, "");
});

test("Champ message à la place de detail (variante)", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    message: "Limit exceeded: 100 requests per minute",
  });
  const { limitType, retryAfter } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/minute (rpm)");
  /* 60 / 100 = 0,6 -> plancher 2 */
  assert.strictEqual(retryAfter, 2);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
