// service-prompts.js --- Chargement et construction des prompts.

"use strict";

const promptCache = {};

async function loadPromptTemplate(name) {
  if (promptCache[name]) return promptCache[name];
  const url = browser.runtime.getURL(`prompts/${name}.txt`);
  const response = await fetch(url);
  const text = await response.text();
  promptCache[name] = text;
  return text;
}

async function buildPrompt(mode, lang) {
  const name = mode === "reformulation" ? "reformulation" : "correction";
  const template = await loadPromptTemplate(name);
  const langName = LANG_NAMES[lang] || "français";
  return template.replace(/\{\{LANG\}\}/g, langName);
}

async function buildTranslationPrompt(langSource, langCible) {
  const template = await loadPromptTemplate("traduction");
  const srcName = LANG_NAMES[langSource] || "français";
  const tgtName = LANG_NAMES[langCible] || "français";
  return template.replace(/\{\{LANG_SOURCE\}\}/g, srcName).replace(/\{\{LANG_CIBLE\}\}/g, tgtName);
}
