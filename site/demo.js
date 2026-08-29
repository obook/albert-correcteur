/*
 * demo.js - Boucles des deux démonstrations du héros.
 *
 * Correction : la séquence passe sur les trois fautes de la phrase,
 * dans l'ordre où on les lit. Pour chacune, le panneau montre le type,
 * l'explication et le mot proposé, puis le remplacement s'applique et
 * le panneau s'efface, comme après un clic sur la suggestion dans
 * l'extension. Les trois fautes traitées, la phrase revient à son état
 * de départ et le cycle reprend.
 *
 * Traduction : la même phrase italienne passe dans les quatre langues
 * proposées, bouton et résultat changeant ensemble.
 *
 * Les deux boucles évitent l'état incohérent d'un mot déjà corrigé
 * surmonté d'un panneau qui explique encore sa faute : un visiteur qui
 * arrive en retard ou qui revient sur l'onglet retombe toujours sur un
 * état vrai.
 *
 * Précautions de mise en page, les textes n'ayant pas tous la même
 * longueur : le panneau est masqué par l'opacité seule et garde sa
 * place, et la hauteur des deux textes qui changent est figée sur leur
 * état le plus long. Sans cela, "Au jour d'aujourd'hui" devenant
 * "Aujourd'hui" fait passer la phrase de deux lignes à une, et toute la
 * page remonte au milieu du cycle.
 *
 * Rien ne bouge si le visiteur demande moins d'animations : les deux
 * cartes restent sur leur état de départ.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* --- Carte de correction --- */

  var FAUTES = [
    {
      cle: "ortho",
      fautif: "contant",
      corrige: "content",
      type: "Orthographe",
      explication: "\"contant\" ne s'écrit pas ainsi quand on parle d'être satisfait."
    },
    {
      cle: "style",
      fautif: "Au jour d'aujourd'hui",
      corrige: "Aujourd'hui",
      type: "Style",
      explication: "\"Au jour d'aujourd'hui\" dit trois fois la même chose."
    },
    {
      cle: "gram",
      fautif: "et",
      corrige: "est",
      type: "Grammaire",
      explication: "Ici il faut le verbe être, pas la conjonction."
    }
  ];

  /* Temps de lecture du panneau, et durée du fondu pendant lequel le
     mot est remplacé. Le fondu doit valoir la transition de style.css. */
  var LECTURE_MS = 2800;
  var FONDU_MS = 350;

  var phrase = document.querySelector("[data-phrase]");
  var panneau = document.querySelector("[data-panneau]");
  var type = document.querySelector("[data-type]");
  var explication = document.querySelector("[data-explication]");
  var suggestion = document.querySelector("[data-suggestion]");
  var marques = FAUTES.map(function (f) {
    return document.querySelector("[data-faute=\"" + f.cle + "\"]");
  });

  if (phrase && panneau && type && explication && suggestion
    && marques.indexOf(null) === -1) {
    lancerCorrection();
  }

  function lancerCorrection() {
    /* Un seul minuteur en vol : le redimensionnement peut ainsi couper
       la séquence en cours au lieu de la laisser tourner sur une phrase
       remise à zéro. */
    var minuteur = null;

    function plusTard(fn, ms) {
      minuteur = setTimeout(fn, ms);
    }

    /* Deux textes changent de longueur dans cette carte : la phrase
       corrigée et l'explication du panneau. Chacun est figé sur son
       état le plus long, sinon la carte gagne ou perd une ligne en
       cours de cycle et toute la page bouge. */
    function figerHauteur() {
      phrase.style.minHeight = "";
      phrase.style.minHeight = phrase.offsetHeight + "px";

      explication.style.minHeight = "";
      var maxi = 0;
      FAUTES.forEach(function (f) {
        explication.textContent = f.explication;
        maxi = Math.max(maxi, explication.offsetHeight);
      });
      explication.style.minHeight = maxi + "px";
      explication.textContent = FAUTES[0].explication;
    }

    function afficher(index) {
      var f = FAUTES[index];
      type.textContent = f.type;
      type.className = "suggestion-type type-" + f.cle;
      explication.textContent = f.explication;
      suggestion.textContent = f.corrige;
      panneau.classList.remove("efface");
    }

    function corriger(index) {
      var f = FAUTES[index];
      marques[index].textContent = f.corrige;
      marques[index].classList.remove("faute", "faute-" + f.cle);
    }

    function reinitialiser() {
      FAUTES.forEach(function (f, i) {
        marques[i].textContent = f.fautif;
        marques[i].classList.add("faute", "faute-" + f.cle);
      });
      afficher(0);
    }

    /*
     * Le remplacement et le passage à la faute suivante se font pendant
     * que le panneau est invisible. Le visiteur ne voit donc jamais un
     * mot déjà corrigé surmonté de l'explication de sa faute, et la
     * carte n'a jamais de creux : le panneau garde sa place et son
     * contenu d'un bout à l'autre du cycle.
     */
    function jouer(index) {
      var suivant = index + 1 < FAUTES.length ? index + 1 : 0;
      plusTard(function () {
        panneau.classList.add("efface");
        plusTard(function () {
          corriger(index);
          if (suivant === 0) {
            reinitialiser();
          } else {
            afficher(suivant);
          }
          panneau.classList.remove("efface");
          jouer(suivant);
        }, FONDU_MS);
      }, LECTURE_MS);
    }

    function demarrer() {
      clearTimeout(minuteur);
      reinitialiser();
      figerHauteur();
      plusTard(function () { jouer(0); }, LECTURE_MS);
    }

    /* Remesurer suppose l'état de départ, d'où la reprise complète. Tant
       que le visiteur redimensionne, la séquence reste au point mort. */
    window.addEventListener("resize", demarrer);
    demarrer();
  }

  /* --- Carte de traduction --- */

  var LANGUES = [
    { cle: "fr", texte: "Le rapport doit être remis avant vendredi." },
    { cle: "en", texte: "The report must be submitted by Friday." },
    { cle: "es", texte: "El informe debe entregarse antes del viernes." },
    { cle: "de", texte: "Der Bericht muss bis Freitag eingereicht werden." }
  ];

  var PAR_LANGUE_MS = 2400;

  var traduction = document.querySelector("[data-traduction]");
  var boutons = LANGUES.map(function (l) {
    return document.querySelector("[data-langue=\"" + l.cle + "\"]");
  });

  if (traduction && boutons.indexOf(null) === -1) {
    lancerTraduction();
  }

  function lancerTraduction() {
    var minuteur = null;
    var courante = 0;

    /* La plus longue des quatre traductions fixe la hauteur : sans
       cela, l'allemand passant sur deux lignes fait sauter la carte. */
    function figerHauteur() {
      traduction.style.minHeight = "";
      var maxi = 0;
      LANGUES.forEach(function (l) {
        traduction.textContent = l.texte;
        maxi = Math.max(maxi, traduction.offsetHeight);
      });
      traduction.style.minHeight = maxi + "px";
      traduction.textContent = LANGUES[courante].texte;
    }

    function afficher(index) {
      courante = index;
      boutons.forEach(function (b, i) {
        b.classList.toggle("choisie", i === index);
      });
      traduction.textContent = LANGUES[index].texte;
    }

    function suivante() {
      afficher((courante + 1) % LANGUES.length);
      minuteur = setTimeout(suivante, PAR_LANGUE_MS);
    }

    function demarrer() {
      clearTimeout(minuteur);
      afficher(0);
      figerHauteur();
      minuteur = setTimeout(suivante, PAR_LANGUE_MS);
    }

    window.addEventListener("resize", demarrer);
    demarrer();
  }
})();
