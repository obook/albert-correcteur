// Tests — Détection automatique de la langue.

const assert = require("assert");

// ── Copie des fonctions à tester (depuis service/service.js) ──

const LANG_WORDS = {
  fr: ["le", "la", "les", "de", "des", "un", "une", "du", "est", "et", "en", "que", "qui", "dans", "pour", "pas", "sur", "avec", "ce", "sont", "nous", "vous", "ils", "mais", "plus", "être", "avoir", "cette", "tout", "aussi"],
  en: ["the", "is", "are", "was", "were", "of", "and", "to", "in", "that", "it", "for", "not", "on", "with", "this", "but", "from", "they", "have", "has", "been", "would", "will", "can", "which", "their", "there", "about"],
  es: ["el", "la", "los", "las", "de", "en", "que", "es", "un", "una", "por", "con", "para", "del", "como", "más", "pero", "sus", "está", "son", "tiene", "todo", "esta", "también", "nos", "fue", "hay", "muy", "entre"],
  de: ["der", "die", "das", "und", "ist", "ein", "eine", "für", "mit", "auf", "den", "dem", "sich", "des", "nicht", "von", "sind", "wird", "auch", "als", "ich", "wir", "aber", "nach", "noch", "wie", "bei", "nur", "kann"],
};

function detectLanguage(text) {
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, "").split(/\s+/);
  const scores = {};
  for (const [lang, markers] of Object.entries(LANG_WORDS)) {
    scores[lang] = words.filter((w) => markers.includes(w)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] < 2) return "fr";
  return best[0];
}

// ── Tests ──

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

console.log("Détection de langue :");

test("Français — phrase simple", () => {
  assert.strictEqual(detectLanguage("Bonjour, je suis content de vous revoir dans le jardin."), "fr");
});

test("Français — texte avec erreurs", () => {
  assert.strictEqual(detectLanguage("Bonnjour a tous ! Je suis contant de vous revoir."), "fr");
});

test("Français — texte court avec assez de marqueurs", () => {
  assert.strictEqual(detectLanguage("Les enfants sont dans la cour."), "fr");
});

test("Anglais — phrase simple", () => {
  assert.strictEqual(detectLanguage("The children are playing in the garden with their friends."), "en");
});

test("Anglais — texte avec erreurs", () => {
  assert.strictEqual(detectLanguage("I was very hapyy to see that the informations was correct."), "en");
});

test("Espagnol — phrase simple", () => {
  assert.strictEqual(detectLanguage("Los niños están en el parque con sus amigos."), "es");
});

test("Espagnol — texte avec erreurs", () => {
  assert.strictEqual(detectLanguage("Ayer yo fue al mercado y compré mucho frutas para la familia."), "es");
});

test("Allemand — phrase simple", () => {
  assert.strictEqual(detectLanguage("Die Kinder sind in der Schule und sie lernen viel."), "de");
});

test("Allemand — texte avec erreurs", () => {
  assert.strictEqual(detectLanguage("Ich habe gestern ein sehr gutes Buch gelest und das war toll."), "de");
});

test("Texte trop court — fallback français", () => {
  assert.strictEqual(detectLanguage("Hello world"), "fr");
});

test("Texte vide — fallback français", () => {
  assert.strictEqual(detectLanguage(""), "fr");
});

test("Un seul mot — fallback français", () => {
  assert.strictEqual(detectLanguage("Bonjour"), "fr");
});

test("Ponctuation ignorée", () => {
  assert.strictEqual(detectLanguage("Les enfants, dans la cour, sont contents!"), "fr");
});

test("Majuscules ignorées", () => {
  assert.strictEqual(detectLanguage("THE CHILDREN ARE PLAYING IN THE GARDEN."), "en");
});

test("Mélange — majorité française", () => {
  assert.strictEqual(detectLanguage("Le projet est dans le repository et les tests sont OK."), "fr");
});

test("Mélange — majorité anglaise", () => {
  assert.strictEqual(detectLanguage("The project is in the repository and the tests are OK."), "en");
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
