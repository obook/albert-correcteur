/*
 * test-fenetre-hote.js
 * Tests : remontée des cadres pour trouver la fenêtre qui accueille
 * une popup ouverte depuis une iframe d'éditeur.
 *
 * Auteur : O. Booklage
 * Date : novembre 2026
 * Licence : MIT
 */

const assert = require("assert");

/* -- Copie de la fonction à tester (depuis
   sources-firefox/popup-contenu/albert-popup-common.js) --
   Recopiée telle quelle : le fichier d'origine s'attache à l'objet
   Albert du navigateur et ne s'importe pas depuis node. */

function fenetreHote(depart) {
  let win = depart;
  let dx = 0;
  let dy = 0;
  try {
    while (win.frameElement) {
      const cadre = win.frameElement;
      const rect = cadre.getBoundingClientRect();
      dx += rect.left + cadre.clientLeft;
      dy += rect.top + cadre.clientTop;
      win = win.parent;
    }
  } catch (e) {
    /* Parent inaccessible : garder le dernier cadre atteint. */
  }
  return { win, dx, dy };
}

/* Fenêtre factice : cadre à (left, top), bordure de 1 px. */
function fenetre(nom, parent, left, top) {
  return {
    nom,
    parent,
    frameElement: parent
      ? { getBoundingClientRect: () => ({ left, top }), clientLeft: 1, clientTop: 1 }
      : null,
  };
}

let reussis = 0;
let echoues = 0;

function verifier(intitule, obtenu, attendu) {
  try {
    assert.deepStrictEqual(obtenu, attendu);
    console.log("  ok   " + intitule);
    reussis++;
  } catch (e) {
    console.log("  ECHEC " + intitule + " : attendu " + JSON.stringify(attendu)
      + ", obtenu " + JSON.stringify(obtenu));
    echoues++;
  }
}

function resume(r) {
  return { nom: r.win.nom, dx: r.dx, dy: r.dy };
}

console.log("\nFenêtre d'accueil des popups\n");

const haut = fenetre("haut", null);
verifier("une page sans cadre garde sa fenêtre, sans décalage",
  resume(fenetreHote(haut)), { nom: "haut", dx: 0, dy: 0 });

const editeur = fenetre("editeur", haut, 495, 321);
verifier("une iframe d'éditeur remonte à la page, bordure comprise",
  resume(fenetreHote(editeur)), { nom: "haut", dx: 496, dy: 322 });

const milieu = fenetre("milieu", haut, 100, 50);
const profond = fenetre("profond", milieu, 10, 20);
verifier("les décalages de cadres imbriqués s'additionnent",
  resume(fenetreHote(profond)), { nom: "haut", dx: 112, dy: 72 });

const autreOrigine = fenetre("autre", null);
const sousAutre = fenetre("sous-autre", autreOrigine, 30, 40);
autreOrigine.frameElement = null; /* parent d'une autre origine */
verifier("un parent d'une autre origine arrête la remontée",
  resume(fenetreHote(sousAutre)), { nom: "autre", dx: 31, dy: 41 });

const refus = fenetre("refus", null);
Object.defineProperty(refus, "frameElement", {
  get() { throw new Error("SecurityError"); },
});
const sousRefus = fenetre("sous-refus", refus, 5, 5);
verifier("un accès refusé garde le dernier cadre atteint",
  resume(fenetreHote(sousRefus)), { nom: "refus", dx: 6, dy: 6 });

console.log("\n" + reussis + " test(s) réussi(s), "
  + echoues + " échec(s)\n");
process.exit(echoues > 0 ? 1 : 0);
