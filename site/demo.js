/*
 * demo.js - Boucle de la démonstration du héros.
 *
 * Le panneau de suggestion est ouvert sur la faute, puis le mot est
 * remplacé et le panneau s'efface, comme après un clic sur la
 * suggestion dans l'extension. La séquence se rejoue en boucle : un
 * visiteur qui arrive en retard ou qui revient sur l'onglet retombe
 * toujours sur un état cohérent, jamais sur un mot corrigé surmonté
 * d'un panneau qui explique encore la faute.
 *
 * Le panneau est masqué par l'opacité seule : il garde sa place et la
 * carte ne change pas de hauteur. Les deux mots ont la même longueur,
 * le remplacement ne déplace donc rien non plus.
 *
 * Sans animation si le visiteur en demande moins : la page reste sur
 * son état de départ, faute soulignée et suggestion ouverte.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

(function () {
  var mot = document.querySelector("[data-mot]");
  var panneau = document.querySelector("[data-panneau]");
  if (!mot || !panneau) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var FAUTIF = "contant";
  var CORRIGE = "content";
  var AVANT_CORRECTION = 2600;
  var AVANT_REPRISE = 2400;

  function corriger() {
    mot.textContent = CORRIGE;
    mot.classList.remove("faute", "faute-ortho");
    panneau.classList.add("efface");
    setTimeout(reprendre, AVANT_REPRISE);
  }

  function reprendre() {
    mot.textContent = FAUTIF;
    mot.classList.add("faute", "faute-ortho");
    panneau.classList.remove("efface");
    setTimeout(corriger, AVANT_CORRECTION);
  }

  setTimeout(corriger, AVANT_CORRECTION);
})();
