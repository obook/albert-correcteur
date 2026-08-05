/*
 * popup-limits.js - Affichage des limites du compte API.
 *
 * Trois sections affichées dans le bloc "Limites du compte" :
 *
 *   1. Limites du compte (depuis /v1/me/info)
 *      Quotas rpm/rpd/tpm/tpd. Si plusieurs limites du même type
 *      existent, la valeur la plus restrictive est affichée.
 *
 *   2. Usage journalier réel (depuis /v1/me/usage)
 *      Compte les requêtes et tokens consommés depuis minuit UTC
 *      pour le modèle sélectionné. La résolution d'alias en id
 *      canonique est faite via /v1/models pour faire correspondre les
 *      événements d'usage qui portent toujours l'id canonique.
 *
 *   3. Paliers documentés EXP/PROD pour le modèle sélectionné
 *      Lus dans la table DOCUMENTED_MODEL_LIMITS. Permet de
 *      repérer si le compte est sur le palier expérimental ou
 *      production.
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

const limitsSection = document.getElementById("limits-section");
const limitsInfo = document.getElementById("limits-info");

const LIMIT_LABELS = {
  rpm: "Requêtes / minute",
  rpd: "Requêtes / jour",
  tpm: "Tokens / minute",
  tpd: "Tokens / jour",
};

/*
 * Paliers documentés Albert par modèle (source : page tarifs publique
 * https://albert.sites.beta.gouv.fr/prices/).
 *
 * Indexés uniquement par alias serveur. Toute entrée reçue sous forme
 * d'id canonique est convertie en alias par normalizeModelId() (cf.
 * popup-models.js) avant le lookup.
 *
 * Une valeur null représente un quota "illimité" selon la documentation.
 */
const DOCUMENTED_MODEL_LIMITS = {
  "openweight-large": {
    exp:  { rpm: 10, rpd: 1000,   tpm: 128000, tpd: 1280000 },
    prod: { rpm: 50, rpd: 5000,   tpm: 246000, tpd: null },
  },
  "openweight-medium": {
    exp:  { rpm: 50,  rpd: 1000,  tpm: 128000, tpd: 2460000 },
    prod: { rpm: 100, rpd: 50000, tpm: 246000, tpd: null },
  },
  "openweight-small": {
    exp:  { rpm: 50,  rpd: 1000,  tpm: 128000, tpd: 2460000 },
    prod: { rpm: 100, rpd: 50000, tpm: 246000, tpd: null },
  },
};

/**
 * Cherche les paliers documentés pour un identifiant de modèle.
 *
 * Normalise l'identifiant en alias serveur ([[normalizeModelId]] de
 * popup-models.js) pour gérer les configurations héritées qui auraient
 * été enregistrées sous un id canonique.
 *
 * @param {string} modelId - Alias ou id canonique du modèle.
 * @returns {{exp: Object, prod: Object} | null}
 */
function documentedLimitsFor(modelId) {
  if (!modelId) return null;
  const alias = normalizeModelId(modelId);
  return DOCUMENTED_MODEL_LIMITS[alias] || null;
}

/**
 * Formate une valeur de quota pour l'affichage.
 *
 * @param {number|null} value - Valeur brute (null = illimité).
 * @returns {string}
 */
function formatLimitValue(value) {
  if (value === null || value === undefined) return "illimité";
  return value.toLocaleString("fr-FR");
}

/**
 * Construit la ligne d'un palier documenté (EXP ou PROD).
 *
 * @param {string} title  - Libellé du palier.
 * @param {Object} tier   - {rpm, rpd, tpm, tpd}.
 * @returns {HTMLElement}
 */
function buildTierRow(title, tier) {
  const row = document.createElement("div");
  row.className = "tier-row";

  const titleEl = document.createElement("div");
  titleEl.className = "tier-title";
  titleEl.textContent = title;
  row.appendChild(titleEl);

  const grid = document.createElement("div");
  grid.className = "tier-grid";
  for (const key of ["rpm", "rpd", "tpm", "tpd"]) {
    const cell = document.createElement("span");
    cell.className = "tier-cell";
    cell.textContent = `${key} ${formatLimitValue(tier[key])}`;
    grid.appendChild(cell);
  }
  row.appendChild(grid);
  return row;
}

/**
 * Récupère la map { alias serveur -> id canonique } via l'API.
 * Utilisée pour résoudre l'identifiant sélectionné dans le <select>
 * en celui qui apparaît dans /v1/me/usage.
 *
 * @param {string} apiBase - URL de base de l'API.
 * @param {string} apiKey  - Clé API.
 * @returns {Promise<Object>}
 */
async function fetchModelAliases(apiBase, apiKey) {
  try {
    const response = await fetch(`${apiBase}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return {};
    const data = await response.json();
    const aliases = {};
    for (const m of data.data || []) {
      if (!m.id || !Array.isArray(m.aliases)) continue;
      for (const a of m.aliases) {
        if (typeof a === "string" && a) aliases[a] = m.id;
      }
    }
    return aliases;
  } catch {
    return {};
  }
}

/**
 * Calcule l'usage journalier (rpd, tpd) pour un modèle depuis /v1/me/usage.
 * Renvoie null si l'endpoint n'est pas disponible.
 *
 * @param {string} apiBase    - URL de base de l'API.
 * @param {string} apiKey     - Clé API.
 * @param {string} canonicalId - Id canonique du modèle.
 * @returns {Promise<{rpdUsed: number, tpdUsed: number} | null>}
 */
async function fetchDailyUsageForModel(apiBase, apiKey, canonicalId) {
  if (!canonicalId) return null;
  try {
    const response = await fetch(`${apiBase}/v1/me/usage`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const events = Array.isArray(data.data) ? data.data : [];
    const utcMidnight = Math.floor(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      ) / 1000
    );

    let rpdUsed = 0;
    let tpdUsed = 0;
    for (const ev of events) {
      if (!ev || ev.model !== canonicalId) continue;
      if (typeof ev.created !== "number" || ev.created < utcMidnight) continue;
      rpdUsed += 1;
      /* Le quota tpd côté Albert couvre prompt + completion. Sommer les
         deux pour ne pas sous-évaluer l'usage affiché. */
      const usage = ev.usage || {};
      const promptTokens = typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens : 0;
      const completionTokens = typeof usage.completion_tokens === "number"
        ? usage.completion_tokens : 0;
      tpdUsed += promptTokens + completionTokens;
    }
    return { rpdUsed, tpdUsed };
  } catch {
    return null;
  }
}

/**
 * Récupère et affiche les limites du compte dans la section dédiée.
 *
 * Trois sections : limites du compte, usage journalier réel pour le
 * modèle sélectionné, paliers documentés EXP/PROD.
 */
async function fetchAndShowLimits() {
  const apiKey = document.getElementById("api-key").value.trim();
  const apiBase = (document.getElementById("api-base").value.trim()
    || DEFAULT_API_BASE).replace(/\/+$/, "");
  if (!apiKey) return;

  try {
    const response = await fetch(`${apiBase}/v1/me/info`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return;

    const data = await response.json();
    const rawLimits = data.limits || [];
    if (rawLimits.length === 0) return;

    /*
     * Regrouper par type et garder la valeur
     * la plus restrictive (minimum)
     */
    const merged = {};
    for (const l of rawLimits) {
      if (!(l.type in merged)) {
        merged[l.type] = l.value;
      } else if (l.value === null) {
        /* null = illimité, on garde la valeur existante (plus restrictive) */
      } else if (merged[l.type] === null) {
        merged[l.type] = l.value;
      } else {
        merged[l.type] = Math.min(merged[l.type], l.value);
      }
    }

    limitsInfo.textContent = "";
    for (const [type, value] of Object.entries(merged)) {
      const label = LIMIT_LABELS[type] || type;
      const display = formatLimitValue(value);
      const cls = value === null
        ? "limit-value unlimited" : "limit-value";
      const row = document.createElement("div");
      row.className = "limit-row";
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      const valueSpan = document.createElement("span");
      valueSpan.className = cls;
      valueSpan.textContent = display;
      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      limitsInfo.appendChild(row);
    }

    const modelSelect = document.getElementById("model");
    const selectedModel = modelSelect ? modelSelect.value : "";

    /*
     * Section "Usage du jour" : interroger /v1/me/usage avec
     * résolution d'alias -> id canonique, car les événements
     * d'usage sont indexés par id canonique.
     */
    if (selectedModel) {
      const aliases = await fetchModelAliases(apiBase, apiKey);
      const canonical = aliases[selectedModel] || selectedModel;
      const usage = await fetchDailyUsageForModel(apiBase, apiKey, canonical);
      if (usage) {
        const usageTitle = document.createElement("div");
        usageTitle.className = "tier-section-title";
        usageTitle.textContent = "Usage du jour pour ce modèle";
        limitsInfo.appendChild(usageTitle);

        const usageRow = document.createElement("div");
        usageRow.className = "tier-grid usage-grid";
        const rpdLimit = merged.rpd;
        const tpdLimit = merged.tpd;
        const rpdText = rpdLimit
          ? `rpd ${formatLimitValue(usage.rpdUsed)} / ${formatLimitValue(rpdLimit)}`
          : `rpd ${formatLimitValue(usage.rpdUsed)}`;
        const tpdText = tpdLimit
          ? `tpd ${formatLimitValue(usage.tpdUsed)} / ${formatLimitValue(tpdLimit)}`
          : `tpd ${formatLimitValue(usage.tpdUsed)}`;
        for (const text of [rpdText, tpdText]) {
          const cell = document.createElement("span");
          cell.className = "tier-cell";
          cell.textContent = text;
          usageRow.appendChild(cell);
        }
        limitsInfo.appendChild(usageRow);
      }
    }

    /* Paliers documentés (EXP/PROD) si connus pour le modèle. */
    const tiers = documentedLimitsFor(selectedModel);
    if (tiers) {
      const sep = document.createElement("div");
      sep.className = "tier-section-title";
      sep.textContent = "Paliers documentés pour ce modèle";
      limitsInfo.appendChild(sep);
      limitsInfo.appendChild(buildTierRow("Expérimental", tiers.exp));
      limitsInfo.appendChild(buildTierRow("Production", tiers.prod));
    }

    limitsSection.style.display = "block";
  } catch {
    /* Silencieux si l'endpoint n'est pas disponible */
  }
}
