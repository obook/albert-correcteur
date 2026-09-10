/*
 * test-popup-globals.js
 * Test : deux scripts d'une même page ne déclarent pas le même nom.
 *
 * Les <script src> d'une page partagent un seul espace de noms : la
 * dernière déclaration l'emporte, sans le moindre avertissement.
 * popup-limits.js avait ainsi une fonction fetchModels qui écrasait
 * celle de popup-models.js, chargée juste avant : le bouton de
 * rechargement et l'enregistrement appelaient la mauvaise, et la liste
 * des modèles restait vide.
 *
 * Le repérage est textuel (déclarations en début de ligne), ce qui suffit
 * pour le style du projet : une fonction ou une constante de module y est
 * toujours écrite sans indentation.
 *
 * Auteur : O. Booklage
 * Date : septembre 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..", "sources-commun");
const PAGES = path.join(RACINE, "popup-configuration");

/* Noms déclarés au premier niveau d'un fichier. */
function declarations(fichier) {
  const source = fs.readFileSync(fichier, "utf8");
  const noms = [];
  const motif = /^(?:async\s+function|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let trouve;
  while ((trouve = motif.exec(source)) !== null) noms.push(trouve[1]);
  return noms;
}

/* Scripts inclus par une page, dans l'ordre de chargement. */
function scriptsDeLaPage(page) {
  const html = fs.readFileSync(page, "utf8");
  const motif = /<script src="([^"]+)"><\/script>/g;
  const fichiers = [];
  let trouve;
  while ((trouve = motif.exec(html)) !== null) {
    fichiers.push(path.join(path.dirname(page), trouve[1]));
  }
  return fichiers;
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

console.log("\n--- Espace de noms partagé des pages de la popup ---\n");

for (const page of fs.readdirSync(PAGES).filter((f) => f.endsWith(".html"))) {
  test(`${page} : aucun nom déclaré deux fois`, () => {
    const origine = new Map();
    const collisions = [];
    for (const script of scriptsDeLaPage(path.join(PAGES, page))) {
      for (const nom of declarations(script)) {
        const precedent = origine.get(nom);
        if (precedent) {
          collisions.push(`${nom} (${precedent} puis ${path.basename(script)})`);
        } else {
          origine.set(nom, path.basename(script));
        }
      }
    }
    assert.deepStrictEqual(collisions, []);
  });
}

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
