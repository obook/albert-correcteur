/*
 * test-message-erreur.js
 * Tests : Messages d'erreur de l'API affichés à l'utilisateur (service-api.js).
 *
 * Auteur : O. Booklage
 * Date : novembre 2026
 * Licence : MIT
 */
/* Pendant une maintenance d'Albert, l'utilisateur voyait "Erreur réseau :
 * NetworkError..." ou "Erreur API (500)" sans savoir que la panne venait
 * d'Albert. Les messages renvoient maintenant vers la page d'état.
 */

const assert = require("assert");
const path = require("path");

const { messageErreurHttp, messageErreurReseau } =
  require(path.join(__dirname, "..", "sources-commun", "service", "service-api.js"));

const STATUS = "albert.status.etalab.gouv.fr";

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

console.log("Messages d'erreur de l'API :");

test("Panne réseau (TypeError) : Albert injoignable, lien vers la page d'état", () => {
  const msg = messageErreurReseau(Object.assign(new TypeError("NetworkError"), {}));
  assert.ok(msg.includes("injoignable") && msg.includes(STATUS), msg);
});

test("502, 503 et 504 : Albert injoignable", () => {
  for (const s of [502, 503, 504]) {
    assert.ok(messageErreurHttp(s, "m").includes("injoignable"), String(s));
  }
});

test("500 (proxy devant un Albert arrêté) : lien vers la page d'état", () => {
  const msg = messageErreurHttp(500, "m");
  assert.ok(msg.includes("500") && msg.includes(STATUS), msg);
});

test("404 : le modèle est nommé et un autre modèle est proposé", () => {
  const msg = messageErreurHttp(404, "openweight-large");
  assert.ok(msg.includes("openweight-large") && msg.includes("autre modèle"), msg);
});

test("Autre statut : message générique avec le code", () => {
  assert.ok(messageErreurHttp(400, "m").includes("(400)"));
});

test("Délai dépassé : message inchangé", () => {
  const err = new Error("t"); err.name = "TimeoutError";
  assert.ok(messageErreurReseau(err).startsWith("Délai dépassé"));
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
