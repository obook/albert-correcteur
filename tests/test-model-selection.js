/*
 * test-model-selection.js
 * Tests : choix de l'identifiant affiché pour un modèle, libellé du
 * sélecteur et présélection du modèle recommandé.
 *
 * Les fonctions de production sont chargées depuis popup-models.js,
 * jamais recopiées : la copie précédente avait divergé sur trois points
 * à la fois (modèle recommandé, séparateur du libellé, résolution par
 * alias qui n'existe plus), si bien que la suite validait un
 * comportement que la popup n'avait plus.
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

/* ---------------------------------------------------------------
 * DOM minimal : popup-models.js récupère deux éléments et pose un
 * écouteur au chargement. On fournit juste de quoi l'évaluer.
 * --------------------------------------------------------------- */

function elementFactice() {
  return {
    innerHTML: "",
    addEventListener() {},
    appendChild() {},
  };
}

function chargerPopupModels() {
  const racine = path.join(__dirname, "..", "sources-commun");
  const alias = fs.readFileSync(
    path.join(racine, "util", "model-aliases.js"), "utf8"
  );
  const models = fs.readFileSync(
    path.join(racine, "popup-configuration", "popup-models.js"), "utf8"
  );
  const contexte = {
    document: {
      getElementById: () => elementFactice(),
      createElement: () => elementFactice(),
    },
    browser: { storage: { local: { get: async () => ({}) } } },
    showStatus: () => {},
  };
  const usine = new Function(
    "document", "browser", "showStatus",
    alias + "\n" + models
    + "\nreturn { RECOMMENDED_MODEL, MODEL_DESCRIPTIONS, modelLabel,"
    + " preferredIdFor, estModeleDeChat };"
  );
  return usine(contexte.document, contexte.browser, contexte.showStatus);
}

const {
  RECOMMENDED_MODEL, MODEL_DESCRIPTIONS, modelLabel, preferredIdFor,
  estModeleDeChat,
} = chargerPopupModels();

/* Reproduit les trois lignes de sélection de loadModels() : le modèle
   enregistré s'il est disponible, sinon le recommandé s'il est présent. */
function construireOptions(modeles, modeleEnregistre) {
  const enregistreDisponible = modeleEnregistre
    && modeles.includes(modeleEnregistre);
  const recommande = modeles.includes(RECOMMENDED_MODEL)
    ? RECOMMENDED_MODEL
    : "";
  return modeles.map((id) => ({
    id,
    label: modelLabel(id, recommande),
    selected: enregistreDisponible ? id === modeleEnregistre : id === recommande,
  }));
}

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

console.log("Sélection du modèle recommandé et libellés :");

/* --- Garde-fou contre une nouvelle divergence test / production --- */

test("Le modèle recommandé est lu depuis la production", () => {
  assert.ok(typeof RECOMMENDED_MODEL === "string" && RECOMMENDED_MODEL.length > 0);
  assert.ok(RECOMMENDED_MODEL in MODEL_DESCRIPTIONS,
    `le modèle recommandé « ${RECOMMENDED_MODEL} » n'a pas de description`);
});

/* --- Identifiant préféré pour une entrée de /v1/models --- */

test("Alias documenté préféré à l'identifiant canonique", () => {
  const entree = {
    id: "openai/gpt-oss-120b",
    aliases: ["openweight-large"],
  };
  assert.strictEqual(preferredIdFor(entree), "openweight-large");
});

test("Alias openweight non documenté accepté en repli", () => {
  const entree = {
    id: "editeur/modele-futur",
    aliases: ["OpenWeight-Futur"],
  };
  assert.strictEqual(preferredIdFor(entree), "openweight-futur");
});

test("Sans alias : l'identifiant canonique est conservé", () => {
  const entree = { id: "editeur/modele-sans-alias" };
  assert.strictEqual(preferredIdFor(entree), "editeur/modele-sans-alias");
});

test("Alias hors convention ignoré", () => {
  const entree = { id: "editeur/modele", aliases: ["autre-nom"] };
  assert.strictEqual(preferredIdFor(entree), "editeur/modele");
});

/* --- Libellés --- */

test("Libellé : identifiant, description et mention recommandé", () => {
  const label = modelLabel(RECOMMENDED_MODEL, RECOMMENDED_MODEL);
  assert.strictEqual(
    label,
    `${RECOMMENDED_MODEL} - ${MODEL_DESCRIPTIONS[RECOMMENDED_MODEL]} (recommandé)`
  );
});

test("Libellé : séparateur en tiret simple, pas en tiret cadratin", () => {
  const label = modelLabel("openweight-medium", RECOMMENDED_MODEL);
  assert.ok(label.includes(" - "), `séparateur inattendu dans : ${label}`);
  assert.ok(!label.includes("—"), `tiret cadratin dans : ${label}`);
});

test("Libellé : pas de mention recommandé pour les autres modèles", () => {
  const label = modelLabel("openweight-small", RECOMMENDED_MODEL);
  assert.ok(!label.includes("(recommandé)"));
});

test("Libellé : identifiant brut si aucune description connue", () => {
  const label = modelLabel("editeur/modele-inconnu", RECOMMENDED_MODEL);
  assert.strictEqual(label, "editeur/modele-inconnu");
});

/* --- Présélection dans le sélecteur --- */

const MODELES = ["openweight-large", "openweight-medium", "openweight-small"];

test("Modèle enregistré disponible : il est présélectionné", () => {
  const options = construireOptions(MODELES, "openweight-medium");
  const choisi = options.find((o) => o.selected);
  assert.strictEqual(choisi.id, "openweight-medium");
});

test("Aucun modèle enregistré : le recommandé est présélectionné", () => {
  const options = construireOptions(MODELES, "");
  const choisi = options.find((o) => o.selected);
  assert.strictEqual(choisi.id, RECOMMENDED_MODEL);
});

test("Modèle enregistré indisponible : repli sur le recommandé", () => {
  const options = construireOptions(MODELES, "openweight-disparu");
  const choisi = options.find((o) => o.selected);
  assert.strictEqual(choisi.id, RECOMMENDED_MODEL);
});

test("Recommandé absent de la liste : aucune présélection", () => {
  const modeles = ["openweight-medium", "openweight-small"];
  const options = construireOptions(modeles, "");
  assert.strictEqual(options.filter((o) => o.selected).length, 0);
});

test("Une seule option sélectionnée dans tous les cas", () => {
  for (const enregistre of ["", "openweight-small", "inexistant"]) {
    const options = construireOptions(MODELES, enregistre);
    assert.ok(options.filter((o) => o.selected).length <= 1,
      `plusieurs options sélectionnées pour « ${enregistre} »`);
  }
});

test("Liste vide : aucune option", () => {
  assert.strictEqual(construireOptions([], "").length, 0);
});

/* --- Filtrage des entrées de /v1/models --- */

test("Type de tâche Albert : chat gardé, embeddings écarté", () => {
  assert.ok(estModeleDeChat({ id: "openai/gpt-oss-120b", type: "text-generation" }));
  assert.ok(!estModeleDeChat({ id: "BAAI/bge-m3", type: "text-embeddings-inference" }));
});

/* Réponse d'un proxy local : type "model", et un modèle hors catalogue
   Albert qui doit sortir dans la liste comme les autres. */
test("Endpoint compatible OpenAI : entrées sans type de tâche gardées", () => {
  const reponse = [
    { id: "anthropic-albert/openweight-large", type: "model",
      aliases: ["openweight-large"] },
    { id: "anthropic-albert/deepseek-v4-flash", type: "model",
      aliases: ["deepseek-v4-flash"] },
    { id: "anthropic-albert/openweight-ocr", type: "model",
      aliases: ["openweight-ocr"] },
    { id: "gpt-4o-mini" },
  ];
  assert.deepStrictEqual(
    reponse.filter(estModeleDeChat).map(preferredIdFor),
    ["openweight-large", "anthropic-albert/deepseek-v4-flash", "gpt-4o-mini"]
  );
});

/* Charge utile réelle de llm-proxy : le type de tâche est dans
   model_type, `type` valant "model" comme chez OpenAI. Sans lecture de
   model_type, les modèles de transcription et d'embeddings passaient
   pour des modèles de chat. */
test("Proxy local : le type de tâche est lu dans model_type", () => {
  const reponse = [
    { id: "anthropic-albert/openweight-large", type: "model",
      model_type: "text-generation", aliases: ["openweight-large"] },
    { id: "anthropic-albert/openweight-medium", type: "model",
      model_type: "image-text-to-text", aliases: ["openweight-medium"] },
    { id: "openweight-audio", type: "model",
      model_type: "automatic-speech-recognition", aliases: ["openweight-audio"] },
    { id: "openweight-embeddings", type: "model",
      model_type: "text-embeddings-inference", aliases: ["openweight-embeddings"] },
  ];
  assert.deepStrictEqual(
    reponse.filter(estModeleDeChat).map(preferredIdFor),
    ["openweight-large", "openweight-medium"]
  );
});

console.log(`\n${passed} passé(s), ${failed} échoué(s)`);
process.exit(failed > 0 ? 1 : 0);
