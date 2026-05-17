/*
 * regles-locales.js - Détection locale des fautes mécaniques.
 *
 * Ce module identifie côté navigateur quelques patterns de fautes
 * ultra-fréquentes en français, sans aller solliciter l'API. Les
 * corrections produites sont ensuite fusionnées avec celles renvoyées
 * par le modèle, ce qui donne un filet de sécurité utile quand on
 * bascule sur un modèle plus petit (Mistral-Small, Ministral) qui rate
 * parfois ces fautes pourtant évidentes.
 *
 * Principe :
 *   - Une règle décrit un mot fautif et son contexte minimal (via
 *     lookahead non capturant). Le pattern doit donc matcher uniquement
 *     le mot erroné, pas le mot suivant.
 *   - findLocalCorrections(text) renvoie un tableau de corrections au
 *     même format que la réponse de l'API.
 *   - mergeCorrections(api, local) supprime les doublons par
 *     chevauchement d'offset, en gardant la version API quand les deux
 *     pointent vers la même position (l'API peut avoir un message plus
 *     contextualisé).
 *
 * Choix conservateur : on n'embarque que des patterns sans ambiguïté
 * contextuelle, pour ne jamais produire de faux positif. Les
 * homophones (a/à, et/est, ou/où, son/sont, on/ont, ce/se) nécessitent
 * une analyse contextuelle plus fine et restent à la charge du modèle.
 *
 * Auteur : O. Booklage
 * Date : Mai 2026
 * Licence : MIT
 */

"use strict";

const DETERMINANTS_PLURIELS = "les|mes|tes|ses|nos|vos|leurs|ces";

/*
 * Liste de verbes après lesquels "sa" est presque toujours une erreur
 * pour "ça" (le possessif "sa" attend un nom, pas un verbe conjugué).
 * On reste sur des verbes très usuels pour éviter les faux positifs sur
 * des cas tordus ("sa varicelle" - pas matché car "va" colle "ricelle").
 */
const VERBES_APRES_CA = "va|vient|fait|marche|ira|fera|donne|reste|tient|tombe";

/*
 * Catalogue des règles. Chaque entrée :
 *   - pattern  : RegExp avec flag /gi, matchant uniquement le mot fautif.
 *                Le contexte est validé via lookahead non capturant.
 *   - length   : longueur du mot fautif (sert au champ "length" rendu).
 *   - suggestions / message / type : conformes au format API.
 */
const REGLES_LOCALES = [
  {
    pattern: new RegExp(
      `\\btout(?=\\s+(?:${DETERMINANTS_PLURIELS})\\b)`,
      "gi"
    ),
    length: 4,
    suggestions: ["tous"],
    message: "Devant un déterminant pluriel, il faut « tous ».",
    type: "grammar",
  },
  {
    pattern: new RegExp(
      `\\btoute(?=\\s+(?:${DETERMINANTS_PLURIELS})\\b)`,
      "gi"
    ),
    length: 5,
    suggestions: ["toutes"],
    message: "Devant un déterminant pluriel, il faut « toutes ».",
    type: "grammar",
  },
  {
    pattern: new RegExp(
      `\\bsa(?=\\s+(?:${VERBES_APRES_CA})\\b)`,
      "gi"
    ),
    length: 2,
    suggestions: ["ça"],
    message: "Devant un verbe, c'est « ça » (pronom démonstratif), pas le possessif « sa ».",
    type: "grammar",
  },
];

/*
 * Listes d'exceptions aux règles de pluralisation française.
 * Source : Grevisse, règles standard.
 */
const EXCEPTIONS_AU_AUX = new Set(["landau", "sarrau"]);
const EXCEPTIONS_EU_EUX = new Set(["bleu", "pneu", "émeu", "lieu"]);
const EXCEPTIONS_AL_ALS = new Set([
  "bal", "carnaval", "chacal", "festival",
  "récital", "régal", "cérémonial",
]);

/**
 * Renvoie le pluriel d'un nom commun français selon les règles
 * orthographiques standard, ou null si le mot est déjà au pluriel ou
 * s'il sort du champ couvert (mot mixte avec apostrophe, etc.).
 *
 * @param {string} word - Forme singulier supposée.
 * @returns {string|null}
 */
function pluralForm(word) {
  if (!word || !/^[a-zàâçéèêëîïôûùüÿ]+$/i.test(word)) return null;
  // Mots se terminant par s, x, z : déjà au pluriel, invariables.
  if (/[sxz]$/i.test(word)) return null;
  const lower = word.toLowerCase();
  // -eau, -au -> +x (sauf exceptions au/aux).
  if (/eau$/i.test(word)) return word + "x";
  if (/au$/i.test(word) && !EXCEPTIONS_AU_AUX.has(lower)) return word + "x";
  // -eu -> +x (sauf bleu, pneu, émeu, lieu).
  if (/eu$/i.test(word) && !EXCEPTIONS_EU_EUX.has(lower)) return word + "x";
  // -al -> -aux (sauf bal, carnaval, chacal, festival, récital, régal).
  if (/al$/i.test(word) && !EXCEPTIONS_AL_ALS.has(lower)) {
    return word.slice(0, -2) + "aux";
  }
  // Cas général.
  return word + "s";
}

/**
 * Détecte les noms à pluraliser dans le pattern "tout/toute + dét.
 * pluriel + nom singulier". Émet une correction sur le nom.
 *
 * Le déterminant "tout/toute" lui-même est déjà signalé par les règles
 * REGLES_LOCALES classiques ; ce module se concentre uniquement sur le
 * mot suivant.
 *
 * La RegExp est instanciée localement à chaque appel : un pattern avec
 * flag /g partagé au niveau module conserve un lastIndex global qui
 * peut interférer avec d'autres appels concurrents.
 *
 * @param {string} text
 * @returns {Array}
 */
function findNounsAfterToutLes(text) {
  const pattern = /\btout(?:e)?\s+(?:les|mes|tes|ses|nos|vos|leurs|ces)\s+([a-zàâçéèêëîïôûùüÿ]+)/gi;
  const corrections = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const noun = m[1];
    const plural = pluralForm(noun);
    if (!plural || plural === noun) continue;
    /* Offset du nom = fin du match - longueur du nom. */
    const nounOffset = m.index + m[0].length - noun.length;
    corrections.push({
      word: noun,
      offset: nounOffset,
      length: noun.length,
      message: "Le nom doit être au pluriel après un déterminant pluriel.",
      suggestions: [plural],
      type: "grammar",
    });
  }
  return corrections;
}

/**
 * Cherche dans le texte les fautes mécaniques connues localement.
 *
 * @param {string} text - Texte saisi par l'utilisateur.
 * @returns {Array<{word: string, offset: number, length: number,
 *                  message: string, suggestions: string[], type: string}>}
 */
function findLocalCorrections(text) {
  if (!text) return [];
  const corrections = [];
  for (const rule of REGLES_LOCALES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      corrections.push({
        word: m[0],
        offset: m.index,
        length: rule.length,
        message: rule.message,
        suggestions: rule.suggestions.slice(),
        type: rule.type,
      });
    }
  }
  corrections.push(...findNounsAfterToutLes(text));
  return corrections;
}

/**
 * Fusionne corrections API et corrections locales en supprimant les
 * doublons par chevauchement d'offset.
 *
 * Stratégie : on garde toutes les corrections API. Pour chaque
 * correction locale, on l'ajoute si aucune correction API ne couvre
 * sa plage [offset, offset + length[.
 *
 * @param {Array} apiCorrections   - Corrections renvoyées par le modèle.
 * @param {Array} localCorrections - Corrections produites localement.
 * @returns {Array}
 */
function mergeCorrections(apiCorrections, localCorrections) {
  const apiList = Array.isArray(apiCorrections) ? apiCorrections : [];
  const localList = Array.isArray(localCorrections) ? localCorrections : [];
  if (localList.length === 0) return apiList;

  const overlapping = (a, b) => {
    const aStart = a.offset;
    const aEnd = a.offset + (a.length || 0);
    const bStart = b.offset;
    const bEnd = b.offset + (b.length || 0);
    return aStart < bEnd && bStart < aEnd;
  };

  const result = apiList.slice();
  for (const local of localList) {
    const collides = apiList.some((api) => overlapping(api, local));
    if (!collides) result.push(local);
  }
  result.sort((a, b) => a.offset - b.offset);
  return result;
}
