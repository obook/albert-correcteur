/*
 * popup-models.js - Chargement et sélection des modèles depuis l'API.
 *
 * Interroge l'endpoint /v1/models pour lister les modèles de chat
 * disponibles sur le compte. Accepte les modèles texte
 * ("text-generation") et les modèles multimodaux ("image-text-to-text"),
 * et garde par sécurité tout modèle qui porte un alias openweight-*
 * connu, quel que soit son type.
 *
 * Préfère systématiquement l'alias serveur (openweight-large/medium/
 * small) à l'id canonique afin que le projet manipule un identifiant
 * stable, indépendant des renommages côté fournisseur.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* openweight-large : recommandé tant qu'une amélioration durable de la
   détection sur medium et small n'est pas trouvée. Sur ces deux derniers
   modèles, le prompt étoffé ne suffit pas à compenser les faiblesses
   constatées en pratique ; le large reste fiable au prix d'un quota tpd
   EXP plus serré (1,28 M). */
const RECOMMENDED_MODEL = "openweight-large";

const MODEL_DESCRIPTIONS = {
  "openweight-large": "Complexe (120B)",
  "openweight-medium": "Modéré (24B)",
  "openweight-small": "Simple (8B)",
  "openweight-code": "Spécialisé code (30B)",
};

/*
 * CANONICAL_TO_ALIAS et normalizeModelId sont fournis par
 * util/model-aliases.js, chargé dans popup.html avant ce script.
 */

/*
 * Types de tâche acceptés comme "modèle de chat" côté API.
 *
 * Albert renvoie un champ `type` aligné sur les pipelines HuggingFace :
 *   - "text-generation"      pour les modèles texte purs (gpt-oss-120b,
 *                            Ministral-3-8B)
 *   - "image-text-to-text"   pour les modèles multimodaux qui acceptent
 *                            aussi du texte seul (Mistral-Small-3.2-24B)
 *
 * Un modèle multimodal reste parfaitement utilisable en mode texte
 * pour la correction orthographique : on l'inclut donc dans la liste.
 */
const CHAT_TYPES = new Set(["text-generation", "image-text-to-text"]);

/*
 * Modèles écartés malgré un type accepté.
 *
 * Les modèles de reconnaissance de texte dans l'image sont annoncés
 * comme "image-text-to-text", exactement comme les modèles de chat
 * multimodaux : rien dans la réponse de l'API ne les distingue, et ils
 * encombraient la liste sans pouvoir servir à la correction.
 *
 * ponytail: filtrage sur le nom, à remplacer le jour où l'API expose
 * une capacité par modèle.
 */
const MODELES_HORS_SUJET = /ocr/i;

/**
 * Indique si une entrée de /v1/models est utilisable pour la correction.
 *
 * Le type de tâche est propre à Albert. Un endpoint compatible OpenAI,
 * proxy local ou autre, n'annonce rien de tel : ses entrées portent au
 * mieux `type: "model"`, et il ne sert que des modèles de conversation.
 *
 * @param {{id: string, type?: string, aliases?: string[]}} m
 * @returns {boolean}
 */
function estModeleDeChat(m) {
  const noms = [m.id].concat(Array.isArray(m.aliases) ? m.aliases : []);
  if (noms.some((n) => typeof n === "string" && MODELES_HORS_SUJET.test(n))) {
    return false;
  }
  if (CHAT_TYPES.has(m.type)) return true;
  if (!m.type || m.type === "model") return true;
  if (Array.isArray(m.aliases)) {
    return m.aliases.some((a) => a in MODEL_DESCRIPTIONS);
  }
  return false;
}

const modelSelect = document.getElementById("model");
const refreshBtn = document.getElementById("refresh-models");

/**
 * Renvoie l'identifiant à afficher pour un modèle de la réponse API.
 *
 * Préfère, dans l'ordre :
 *   1. un alias documenté ([[MODEL_DESCRIPTIONS]]),
 *   2. n'importe quel alias respectant la convention `openweight-*`
 *      (filet face à un futur alias non encore documenté côté projet),
 *   3. l'id canonique en dernier recours.
 *
 * @param {{id: string, aliases?: string[]}} m - Entrée de /v1/models.
 * @returns {string}
 */
function preferredIdFor(m) {
  if (!Array.isArray(m.aliases)) return m.id;

  for (const alias of m.aliases) {
    if (typeof alias === "string" && alias in MODEL_DESCRIPTIONS) {
      return alias;
    }
  }
  for (const alias of m.aliases) {
    if (typeof alias === "string"
      && alias.toLowerCase().startsWith("openweight-")) {
      return alias.toLowerCase();
    }
  }
  return m.id;
}

/**
 * Construit le libellé affiché pour un modèle dans le <select>.
 *
 * @param {string} id            - Identifiant du modèle (alias de préférence).
 * @param {string} recommendedId - Id du modèle recommandé.
 * @returns {string} Libellé formaté (ex. : "openweight-large - Complexe (120B) (recommandé)").
 */
function modelLabel(id, recommendedId) {
  const desc = MODEL_DESCRIPTIONS[id];
  const parts = [id];
  if (desc) parts.push(`- ${desc}`);
  if (id === recommendedId) parts.push("(recommandé)");
  return parts.join(" ");
}

/**
 * Charge les modèles disponibles depuis l'API et remplit le <select>.
 *
 * Filtre les modèles de type "text-generation", remplace chaque id
 * canonique par son alias serveur quand l'alias est connu, et
 * présélectionne le modèle sauvegardé (après normalisation) ou le
 * modèle recommandé.
 */
async function fetchModels() {
  const apiKey = document.getElementById("api-key").value.trim();
  const apiBase = (document.getElementById("api-base").value.trim()
    || DEFAULT_API_BASE).replace(/\/+$/, "");

  if (!apiKey) {
    showStatus("Entrez d'abord la clé API.", "err");
    return;
  }

  modelSelect.innerHTML = '<option value="">Chargement…</option>';

  try {
    const response = await fetch(`${apiBase}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      showStatus(`Erreur API (${response.status})`, "err");
      modelSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      return;
    }

    const data = await response.json();
    const rawModels = (data.data || []).filter(estModeleDeChat);

    /* Déduplique au cas où plusieurs entrées partageraient le même alias. */
    const seen = new Set();
    const models = [];
    for (const m of rawModels) {
      const id = preferredIdFor(m);
      if (seen.has(id)) continue;
      seen.add(id);
      models.push(id);
    }
    models.sort();

    if (models.length === 0) {
      modelSelect.innerHTML =
        '<option value="">Aucun modèle disponible</option>';
      return;
    }

    const saved = normalizeModelId(
      (await browser.storage.local.get("model")).model || ""
    );
    const savedAvailable = saved && models.includes(saved);

    const recommendedId = models.includes(RECOMMENDED_MODEL)
      ? RECOMMENDED_MODEL
      : "";

    modelSelect.innerHTML = "";
    for (const id of models) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = modelLabel(id, recommendedId);
      if (savedAvailable && id === saved) {
        opt.selected = true;
      } else if (!savedAvailable && id === recommendedId) {
        opt.selected = true;
      }
      modelSelect.appendChild(opt);
    }

    const plural = models.length > 1 ? "s" : "";
    showStatus(
      `${models.length} modèle${plural} disponible${plural}`,
      "ok"
    );
  } catch (err) {
    showStatus(`Erreur réseau : ${err.message}`, "err");
    modelSelect.innerHTML = '<option value="">Erreur réseau</option>';
  }
}

refreshBtn.addEventListener("click", async () => {
  await fetchModels();
  /* Rafraîchir aussi les limites : une sélection programmatique du
     <select> ne déclenche pas l'event 'change'. */
  if (document.getElementById("api-key").value.trim()) {
    fetchAndShowLimits();
  }
});
