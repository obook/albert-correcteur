/*
 * service-prompts.js - Chargement et construction des prompts système.
 *
 * Les prompts sont stockés dans des fichiers .txt embarqués dans
 * l'extension (dossier prompts/). Ce module les charge via
 * browser.runtime.getURL, les met en cache, et remplace les
 * placeholders ({{LANG}}, {{LANG_SOURCE}}, {{LANG_CIBLE}}) par
 * les noms de langues détectés.
 *
 * Prompts disponibles :
 *   - correction.txt        : version étoffée (XML, few-shot exhaustifs)
 *                             utilisée par défaut sur les modèles
 *                             medium/small qui ont besoin d'exemples
 *                             concrets pour ne pas rater les fautes.
 *   - correction-large.txt  : version compacte (règles condensées, pas
 *                             de few-shot) pour openweight-large.
 *                             Économise des tokens sur le modèle dont
 *                             le quota tpd EXP est le plus serré.
 *   - reformulation.txt     : prompt de reformulation de texte.
 *   - traduction.txt        : prompt de traduction.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

const promptCache = {};

/**
 * Charge un fichier prompt depuis les ressources de l'extension (avec cache).
 *
 * @param {string} name - Nom du prompt (sans extension .txt).
 * @returns {Promise<string>} Contenu du fichier prompt.
 */
async function loadPromptTemplate(name) {
  if (promptCache[name]) return promptCache[name];
  const url = browser.runtime.getURL(`prompts/${name}.txt`);
  const response = await fetch(url);
  /* Sans ce contrôle, un fichier absent ou renommé fournit une chaîne
     vide qui part en cache et sert d'instruction système : l'extension
     paraît fonctionner mais les corrections deviennent absurdes. */
  if (!response.ok) {
    throw new Error(`Prompt "${name}" introuvable (${response.status}).`);
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`Prompt "${name}" vide.`);
  }
  promptCache[name] = text;
  return text;
}

/**
 * Choisit le fichier de correction adapté au modèle actif.
 *
 * Le large (gpt-oss-120b) reçoit une version compacte qui économise
 * des tokens. Les modèles plus petits (medium, small) reçoivent la
 * version étoffée avec few-shot exhaustifs.
 *
 * @param {string} modelAlias - Alias serveur du modèle (openweight-*).
 * @returns {string} Nom du prompt à charger.
 */
function correctionPromptName(modelAlias) {
  if (modelAlias === "openweight-large") return "correction-large";
  return "correction";
}

/**
 * Construit le prompt système pour la correction ou la reformulation.
 *
 * @param {string} mode        - "correction" ou "reformulation".
 * @param {string} lang        - Code langue détecté (fr, en, es, de).
 * @param {string} modelAlias  - Alias du modèle actif (sert au choix
 *                               de prompt pour la correction).
 * @param {string} personaId   - Id de persona (mode "reformulation"
 *                               uniquement) ; ignoré sinon. Si vide
 *                               ou inconnu, le persona "neutre" est
 *                               appliqué.
 * @returns {Promise<string>}  - Prompt système prêt à envoyer.
 */
async function buildPrompt(mode, lang, modelAlias, personaId) {
  const name = mode === "reformulation"
    ? "reformulation"
    : correctionPromptName(modelAlias);
  const template = await loadPromptTemplate(name);
  const langName = LANG_NAMES[lang] || "français";
  let prompt = template.replace(/\{\{LANG\}\}/g, langName);

  if (mode === "reformulation") {
    /* getPersonaById est défini dans util/personas.js (chargé en amont
       via manifest.background.scripts). */
    const persona = getPersonaById(personaId);
    prompt = prompt.replace(/\{\{PERSONA_TONE\}\}/g, persona.tone);
  }
  return prompt;
}

/**
 * Construit le prompt système pour la traduction.
 *
 * @param {string} langSource - Code langue source (fr, en, es, de).
 * @param {string} langCible  - Code langue cible.
 * @returns {Promise<string>} Prompt système prêt à envoyer.
 */
async function buildTranslationPrompt(langSource, langCible) {
  const template = await loadPromptTemplate("traduction");
  const srcName = LANG_NAMES[langSource] || "français";
  const tgtName = LANG_NAMES[langCible] || "français";
  return template
    .replace(/\{\{LANG_SOURCE\}\}/g, srcName)
    .replace(/\{\{LANG_CIBLE\}\}/g, tgtName);
}
