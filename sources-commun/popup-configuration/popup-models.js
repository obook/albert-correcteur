/*
 * popup-models.js - Chargement et sélection des modèles depuis l'API.
 *
 * Interroge l'endpoint /v1/models pour lister les modèles de type
 * "text-generation" disponibles sur le compte. Enrichit les
 * libellés avec des descriptions connues et marque le modèle
 * recommandé (openweight-large par défaut).
 *
 * Gère également la résolution des alias : si le modèle recommandé
 * n'existe pas en tant qu'id direct, il est cherché via les alias
 * déclarés dans la réponse API.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

const RECOMMENDED_MODEL = "openweight-large";

const MODEL_DESCRIPTIONS = {
  "openweight-large": "Complexe (120B)",
  "openweight-medium": "Modéré (24B)",
  "openweight-small": "Simple (8B)",
};

const modelSelect = document.getElementById("model");
const refreshBtn = document.getElementById("refresh-models");

/**
 * Construit le libellé affiché pour un modèle dans le <select>.
 *
 * Cherche une description connue par id direct ou par alias.
 * Ajoute "(recommandé)" si le modèle correspond au modèle
 * recommandé résolu.
 *
 * @param {string} id            - Identifiant du modèle.
 * @param {Object} aliasToId     - Table alias → id résolu.
 * @param {string} recommendedId - Id résolu du modèle recommandé.
 * @returns {string} Libellé formaté (ex. : "openweight-large - Complexe (120B) (recommandé)").
 */
function modelLabel(id, aliasToId, recommendedId) {
  let desc = MODEL_DESCRIPTIONS[id];
  if (!desc) {
    for (const [alias, target] of Object.entries(aliasToId)) {
      if (target === id && MODEL_DESCRIPTIONS[alias]) {
        desc = MODEL_DESCRIPTIONS[alias];
        break;
      }
    }
  }
  const parts = [id];
  if (desc) parts.push(`\u2014 ${desc}`);
  if (id === recommendedId) parts.push("(recommandé)");
  return parts.join(" ");
}

/**
 * Charge les modèles disponibles depuis l'API et remplit le <select>.
 *
 * Filtre les modèles de type "text-generation", résout les alias,
 * et présélectionne le modèle sauvegardé ou le modèle recommandé.
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
    const rawModels = (data.data || [])
      .filter((m) => m.type === "text-generation");

    /* Construire une table alias -> id pour enrichir les descriptions. */
    const aliasToId = {};
    for (const m of rawModels) {
      if (Array.isArray(m.aliases)) {
        for (const a of m.aliases) aliasToId[a] = m.id;
      }
    }

    const models = rawModels.map((m) => m.id).sort();

    if (models.length === 0) {
      modelSelect.innerHTML =
        '<option value="">Aucun modèle disponible</option>';
      return;
    }

    const saved = (await browser.storage.local.get("model")).model || "";
    const savedAvailable = saved && models.includes(saved);

    /* Résoudre le modèle recommandé : id direct ou via alias. */
    const recommendedId = models.includes(RECOMMENDED_MODEL)
      ? RECOMMENDED_MODEL
      : aliasToId[RECOMMENDED_MODEL] || "";

    modelSelect.innerHTML = "";
    for (const id of models) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = modelLabel(id, aliasToId, recommendedId);
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

refreshBtn.addEventListener("click", () => fetchModels());
