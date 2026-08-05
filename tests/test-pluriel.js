/* Tests -- Pluralisation française (pluralForm de regles-locales.js). */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

/* Le module n'exporte rien (il est chargé comme script de fond) :
   on l'évalue et on récupère la fonction testée. */
const source = fs.readFileSync(
  path.join(__dirname, "..", "sources-commun", "verification", "regles-locales.js"),
  "utf8"
);
const pluralForm = new Function(source + "\nreturn pluralForm;")();

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

function verifier(singulier, plurielAttendu) {
  test(`${singulier} -> ${plurielAttendu === null ? "(aucun)" : plurielAttendu}`, () => {
    assert.strictEqual(pluralForm(singulier), plurielAttendu);
  });
}

console.log("Pluralisation française :");

/* Règle générale en -eu. « lieu » la suit : il figurait à tort parmi les
   exceptions, ce qui faisait proposer « lieus » au lieu de « lieux ». */
verifier("lieu", "lieux");
verifier("cheveu", "cheveux");
verifier("jeu", "jeux");
verifier("neveu", "neveux");

/* Exceptions réelles de la règle en -eu. */
verifier("bleu", "bleus");
verifier("pneu", "pneus");
verifier("émeu", "émeus");

/* Autres règles, en garde-fou contre une régression de voisinage. */
verifier("bateau", "bateaux");
verifier("tuyau", "tuyaux");
verifier("landau", "landaus");
verifier("cheval", "chevaux");
verifier("festival", "festivals");
verifier("maison", "maisons");

/* Mots déjà au pluriel ou invariables : aucune suggestion. */
verifier("lieux", null);
verifier("nez", null);
verifier("croix", null);

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
