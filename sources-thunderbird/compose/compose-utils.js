/*
 * compose-utils.js - Fonctions utilitaires pour le compose Thunderbird.
 *
 * Fonctions courantes utilisées par les autres modules compose :
 *   - getComposeBody()          : accès au body éditable.
 *   - getBodyText()             : texte brut du corps.
 *   - filterIgnoredCorrections() : filtre par dictionnaire personnel.
 *   - findRealOffset()          : recherche d'un mot dans le texte.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/**
 * Renvoie l'élément éditable du message en cours de composition.
 *
 * Le compose script est injecté directement dans le document de
 * l'éditeur : son corps est la zone éditable. L'accès passe malgré tout
 * par cet accesseur, seul point à reprendre si Thunderbird venait à
 * placer l'éditeur dans un cadre imbriqué, comme le font certaines
 * versions en mode texte brut.
 *
 * @returns {HTMLElement} Corps du message.
 */
Albert.getComposeBody = function () {
  return document.body;
};

/**
 * Renvoie le texte à soumettre : le message sans les parties citées.
 *
 * Citation, ligne « X a écrit : » et signature sont écartées
 * (util/citations.js). Sur une réponse ordinaire elles représentent
 * l'essentiel du corps, et les soumettre allongeait l'attente d'autant.
 *
 * Le découpage est mémorisé avec son texte : les offsets renvoyés par
 * l'API valent pour ce texte réduit, et compose-check.js ne peut les
 * ramener vers innerText que si les intervalles correspondent bien au
 * texte soumis.
 *
 * @returns {string} Contenu textuel rédigé par l'utilisateur.
 */
Albert.getBodyText = function () {
  const hors = Albert.texteHorsCitation(Albert.getComposeBody());
  Albert.horsCitation = hors;
  return hors.texte;
};

Albert.filterIgnoredCorrections = function (corrections) {
  if (!corrections || !corrections.length) return corrections;
  return corrections.filter(
    (c) => !Albert.ignoredWords.has(c.word.toLowerCase())
  );
};

/* getPopupThemeClass vit dans util/popup-base.js : la version d'ici
   ignorait le thème "automatique" et restait sombre sous un système
   clair. */

/* Recherche sur des copies normalisées : innerText garde les espaces
   insécables du corps du message là où le modèle rend un espace
   ordinaire dans word. La substitution valant un caractère pour un, les
   offsets obtenus restent valables dans text (cf. util/blancs.js). */
Albert.findRealOffset = function (text, word, apiOffset) {
  const texte = Albert.normaliserBlancs(text);
  const mot = Albert.normaliserBlancs(word);
  const idx = texte.indexOf(mot, Math.max(0, apiOffset - 10));
  if (idx !== -1) return idx;
  return texte.indexOf(mot);
};

/* Temps de réponse d'Albert pour l'infobulle du badge ("" si inconnu). */
Albert.texteDuree = function (ms) {
  if (typeof ms !== "number") return "";
  return ` (réponse d'Albert en ${Math.max(1, Math.round(ms / 1000))} s)`;
};
