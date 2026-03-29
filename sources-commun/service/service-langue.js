/* service-langue.js --- Détection de langue locale (sans appel externe, RGPD). */

"use strict";

const LANG_WORDS = {
  fr: [
    "le", "la", "les", "de", "des", "un", "une", "du", "est", "et",
    "en", "que", "qui", "dans", "pour", "pas", "sur", "avec", "ce",
    "sont", "nous", "vous", "ils", "mais", "plus", "être", "avoir",
    "cette", "tout", "aussi"
  ],
  en: [
    "the", "is", "are", "was", "were", "of", "and", "to", "in",
    "that", "it", "for", "not", "on", "with", "this", "but", "from",
    "they", "have", "has", "been", "would", "will", "can", "which",
    "their", "there", "about"
  ],
  es: [
    "el", "la", "los", "las", "de", "en", "que", "es", "un", "una",
    "por", "con", "para", "del", "como", "más", "pero", "sus",
    "está", "son", "tiene", "todo", "esta", "también", "nos", "fue",
    "hay", "muy", "entre"
  ],
  de: [
    "der", "die", "das", "und", "ist", "ein", "eine", "für", "mit",
    "auf", "den", "dem", "sich", "des", "nicht", "von", "sind",
    "wird", "auch", "als", "ich", "wir", "aber", "nach", "noch",
    "wie", "bei", "nur", "kann"
  ],
};

const LANG_NAMES = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
  de: "allemand"
};

function detectLanguage(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/);
  const scores = {};

  for (const [lang, markers] of Object.entries(LANG_WORDS)) {
    scores[lang] = words.filter((w) => markers.includes(w)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  /* Seuil minimum : au moins 2 mots reconnus */
  if (best[1] < 2) return "fr";
  return best[0];
}
