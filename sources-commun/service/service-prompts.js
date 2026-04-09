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
 *   - correction.txt    : prompt de correction orthographique/grammaticale.
 *   - reformulation.txt : prompt de reformulation de texte.
 *   - traduction.txt    : prompt de traduction.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
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
  const text = await response.text();
  promptCache[name] = text;
  return text;
}

/**
 * Construit le prompt système pour la correction ou la reformulation.
 *
 * @param {string} mode - "correction" ou "reformulation".
 * @param {string} lang - Code langue détecté (fr, en, es, de).
 * @returns {Promise<string>} Prompt système prêt à envoyer.
 */
async function buildPrompt(mode, lang) {
  const name = mode === "reformulation" ? "reformulation" : "correction";
  const template = await loadPromptTemplate(name);
  const langName = LANG_NAMES[lang] || "français";
  return template.replace(/\{\{LANG\}\}/g, langName);
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
