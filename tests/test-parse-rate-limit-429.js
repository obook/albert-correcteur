/* Tests -- Extraction du Retry-After et du type de limite depuis une réponse 429. */

const assert = require("assert");

/* -- Copie de la fonction à tester (depuis sources-commun/service/service-api.js, parseRateLimit429) --
   Adaptée pour fonctionner sans l'objet fetch Response : on simule un
   objet response minimal avec { headers: { get(name) -> string|null } }. */

function parseRateLimit429(response, detail) {
  const headerValue = parseInt(response.headers.get("Retry-After"), 10);
  let retryAfter = headerValue > 0 ? headerValue : 0;

  let limitType = "";
  let bodyMessage = "";
  try {
    const err = JSON.parse(detail);
    bodyMessage = (err.detail || err.message || "").toString();
    if (!retryAfter && typeof err.retry_after === "number"
      && err.retry_after > 0) {
      retryAfter = Math.ceil(err.retry_after);
    }
  } catch {
    bodyMessage = detail || "";
  }

  const lower = bodyMessage.toLowerCase();
  if (lower.includes("rpm") || lower.includes("requests per minute")) {
    limitType = "requêtes/minute (rpm)";
  } else if (lower.includes("rpd") || lower.includes("requests per day")) {
    limitType = "requêtes/jour (rpd)";
  } else if (lower.includes("tpm") || lower.includes("tokens per minute")) {
    limitType = "tokens/minute (tpm)";
  } else if (lower.includes("tpd") || lower.includes("tokens per day")) {
    limitType = "tokens/jour (tpd)";
  }

  if (!retryAfter) {
    const match = lower.match(
      /(\d+)\s+(?:requests|tokens)\s+per\s+(minute|day)/
    );
    if (match) {
      const limit = parseInt(match[1], 10);
      const window = match[2] === "minute" ? 60 : 86400;
      if (limit > 0) {
        retryAfter = Math.min(window, Math.max(2, Math.ceil(window / limit)));
      }
    }
  }

  if (!retryAfter) retryAfter = 30;
  return { retryAfter, limitType };
}

/* Helper : construit une fausse Response avec un en-tête Retry-After. */
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
  /* 60 / 50 = 1.2 -> arrondi à 2 (plancher) */
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

/* --- Source 3 : calcul depuis le message --- */

test("Calcul depuis 'requests per minute'", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 10 requests per minute",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  /* 60 / 10 = 6 */
  assert.strictEqual(retryAfter, 6);
});

test("Calcul depuis 'requests per day' (très grand)", () => {
  const response = makeResponse(null);
  const detail = JSON.stringify({
    detail: "Limit exceeded: 1000 requests per day",
  });
  const { retryAfter } = parseRateLimit429(response, detail);
  /* 86400 / 1000 = 86.4 -> 87 */
  assert.strictEqual(retryAfter, 87);
});

test("Calcul depuis 'tokens per minute'", () => {
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
  /* 60 / 1000 = 0.06 -> plancher 2 */
  assert.strictEqual(retryAfter, 2);
});

/* --- Détection du type de limite --- */

test("limitType : rpm depuis 'requests per minute'", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({
    detail: "Limit exceeded: 50 requests per minute",
  });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/minute (rpm)");
});

test("limitType : rpd depuis 'requests per day'", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({
    detail: "Limit exceeded: 1000 requests per day",
  });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "requêtes/jour (rpd)");
});

test("limitType : tpm depuis acronyme dans le message", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({ detail: "tpm exceeded" });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "tokens/minute (tpm)");
});

test("limitType : tpd depuis 'tokens per day'", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({ detail: "Limit: 100000 tokens per day" });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "tokens/jour (tpd)");
});

test("limitType vide quand aucun motif reconnu", () => {
  const response = makeResponse("5");
  const detail = JSON.stringify({ detail: "Some other error" });
  const { limitType } = parseRateLimit429(response, detail);
  assert.strictEqual(limitType, "");
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
  /* 60 / 25 = 2.4 -> 3 */
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
  /* 60 / 100 = 0.6 -> plancher 2 */
  assert.strictEqual(retryAfter, 2);
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
