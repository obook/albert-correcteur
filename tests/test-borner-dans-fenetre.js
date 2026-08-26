/*
 * test-borner-dans-fenetre.js
 * Tests : bornage de la position d'une popup déplacée à la souris.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");

/* -- Copie de la fonction à tester (depuis
   sources-commun/popup-contenu/popup-layout.js) --
   Fonction pure, recopiée telle quelle : le fichier d'origine s'attache
   à l'objet Albert du navigateur et ne s'importe pas depuis node. */

function bornerDansFenetre(valeur, taillePopup, tailleFenetre) {
  const maximum = Math.max(0, tailleFenetre - taillePopup);
  return Math.min(Math.max(valeur, 0), maximum);
}

let reussis = 0;
let echoues = 0;

function verifier(intitule, obtenu, attendu) {
  try {
    assert.strictEqual(obtenu, attendu);
    console.log("  ok   " + intitule);
    reussis++;
  } catch (e) {
    console.log("  ECHEC " + intitule + " : attendu " + attendu
      + ", obtenu " + obtenu);
    echoues++;
  }
}

console.log("\nBornage de la position d'une popup\n");

verifier("une position déjà dans la fenêtre ne bouge pas",
  bornerDansFenetre(300, 380, 1000), 300);

verifier("une position négative revient au bord gauche",
  bornerDansFenetre(-120, 380, 1000), 0);

verifier("une position qui ferait déborder à droite est ramenée au bord",
  bornerDansFenetre(900, 380, 1000), 620);

verifier("le bord exact est une position valide",
  bornerDansFenetre(620, 380, 1000), 620);

verifier("une popup plus large que la fenêtre est collée au bord gauche",
  bornerDansFenetre(50, 1200, 1000), 0);

verifier("une popup exactement aussi large que la fenêtre reste à zéro",
  bornerDansFenetre(300, 1000, 1000), 0);

verifier("le même calcul vaut pour la verticale",
  bornerDansFenetre(700, 240, 800), 560);

console.log("\n" + reussis + " test(s) réussi(s), "
  + echoues + " échec(s)\n");

process.exit(echoues === 0 ? 0 : 1);
