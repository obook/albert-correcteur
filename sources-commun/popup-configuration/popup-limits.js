/*
 * popup-limits.js - Affichage des limites du compte API.
 *
 * Trois sections affichées dans le bloc "Limites du compte" :
 *
 *   1. Plafonds du modèle sélectionné (depuis /v1/me)
 *      Quotas rpm/rpd/tpm/tpd, rattachés au modèle par
 *      [[limitsForModel]]. Si le rattachement échoue, la valeur la
 *      plus restrictive du compte est affichée, sous un titre qui le
 *      dit : elle appartient alors à un autre modèle.
 *
 *   2. Usage journalier réel (depuis /v1/usage)
 *      Requêtes et tokens consommés depuis minuit UTC pour le modèle
 *      sélectionné. Albert les compte sous le nom de son routeur :
 *      /v1/models fournit tous les noms du modèle, et chacun est
 *      interrogé, ce qui vaut aussi derrière un proxy qui renomme.
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
 * https://ia.numerique.gouv.fr/outils-ia/albert-api/tarifs-et-limites/,
 * page lue le 2026-08-29).
 *
 * Indexés uniquement par alias serveur. Toute entrée reçue sous forme
 * d'id canonique est convertie en alias par normalizeModelId() (cf.
 * popup-models.js) avant le lookup.
 *
 * Une valeur null représente un quota "illimité" selon la documentation.
 *
 * Correspondance openweight-code -> Qwen/Qwen3-Coder-30B-A3B-Instruct
 * relevée sur /v1/models le 2026-08-29.
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
  "openweight-code": {
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
 * Liste des modèles servis, vide si l'appel échoue.
 *
 * Elle sert deux fois : à rattacher les plafonds du compte au modèle
 * choisi et à retrouver ses autres noms pour l'usage du jour.
 *
 * Le nom est explicite parce que les scripts de la popup partagent un
 * seul espace de noms : appelée fetchModels, elle écrasait la fonction
 * homonyme de popup-models.js, chargée juste avant, et le bouton de
 * rechargement comme l'enregistrement partaient dans celle-ci, qui
 * renvoie un tableau au lieu de remplir la liste déroulante.
 *
 * @param {string} apiBase - URL de base de l'API.
 * @param {string} apiKey  - Clé API.
 * @returns {Promise<Array>}
 */
async function listerModelesApi(apiBase, apiKey) {
  try {
    const response = await fetch(`${apiBase}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch {
    /* Les deux appelants savent se passer de la liste. */
    return [];
  }
}

/**
 * Renvoie tous les noms (id et alias) que /v1/models attache au
 * modèle sélectionné, dans leur casse d'origine.
 *
 * /v1/usage filtre par nom exact du routeur, qui n'est pas forcément
 * celui du <select> : l'API Albert sert son id canonique, un proxy sert
 * le sien, préfixé. Interroger l'ensemble des noms évite de parier sur
 * un espace de noms plutôt qu'un autre.
 *
 * @param {Array} models         - Champ `data` de /v1/models.
 * @param {string} selectedModel - Identifiant choisi dans le <select>.
 * @returns {Set<string>}
 */
function modelNames(models, selectedModel) {
  const choisi = selectedModel.toLowerCase();
  const noms = new Set([selectedModel]);
  for (const m of models) {
    const entree = [m.id]
      .concat(Array.isArray(m.aliases) ? m.aliases : [])
      .filter((n) => typeof n === "string" && n);
    if (entree.some((n) => n.toLowerCase() === choisi)) {
      for (const n of entree) noms.add(n);
    }
  }
  return noms;
}

/**
 * Calcule l'usage journalier (rpd, tpd) pour un modèle depuis /v1/usage.
 * Renvoie null si l'endpoint n'est pas disponible.
 *
 * Albert renvoie un total par jour UTC et par nom exact de routeur :
 * une requête par nom, et le plus grand total. Aujourd'hui un seul nom
 * répond ; si Albert résout un jour les alias, une somme doublerait.
 *
 * @param {string} apiBase  - URL de base de l'API.
 * @param {string} apiKey  - Clé API.
 * @param {Set<string>} noms - Noms du modèle, dans leur casse d'origine.
 * @returns {Promise<{rpdUsed: number, tpdUsed: number} | null>}
 */
async function fetchDailyUsageForModel(apiBase, apiKey, noms) {
  if (!noms || noms.size === 0) return null;

  const maintenant = new Date();
  const utcMidnight = Math.floor(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate()
    ) / 1000
  );
  const fin = Math.floor(maintenant.getTime() / 1000);

  try {
    const reponses = await Promise.all([...noms].map((nom) => fetch(
      `${apiBase}/v1/usage?start_time=${utcMidnight}&end_time=${fin}`
        + `&model=${encodeURIComponent(nom)}`,
      { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
    )));
    if (reponses.some((r) => !r.ok)) return null;

    const nombre = (v) => (typeof v === "number" ? v : 0);
    let rpdUsed = 0;
    let tpdUsed = 0;
    for (const response of reponses) {
      const data = await response.json();
      let rpd = 0;
      let tpd = 0;
      for (const jour of Array.isArray(data.data) ? data.data : []) {
        if (!jour) continue;
        rpd += nombre(jour.requests);
        /* Le quota tpd côté Albert couvre prompt + completion. Sommer les
           deux pour ne pas sous-évaluer l'usage affiché. */
        tpd += nombre(jour.prompt_tokens) + nombre(jour.completion_tokens);
      }
      rpdUsed = Math.max(rpdUsed, rpd);
      tpdUsed = Math.max(tpdUsed, tpd);
    }
    return { rpdUsed, tpdUsed };
  } catch {
    return null;
  }
}

/**
 * Affiche un message unique dans la section, et la déplie.
 *
 * Un échec muet était indiscernable d'une extension cassée : la section
 * disparaissait sans dire pourquoi.
 *
 * @param {string} texte - Motif de l'absence de limites.
 */
function showLimitsMessage(texte) {
  limitsInfo.textContent = texte;
  limitsSection.hidden = false;
  limitsSection.open = true;
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

  /* Clé facultative pour un proxy (llm-proxy), qui ajoute la sienne.
     Sans clé ni URL personnalisée, Albert répondrait 401. */
  if (!apiKey && apiBase === DEFAULT_API_BASE) return;
  try {
    const response = await fetch(`${apiBase}/v1/me`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) {
      /* /v1/me est propre à Albert : un endpoint compatible OpenAI
         répond 404 sans que rien ne soit en panne. */
      showLimitsMessage(response.status === 404
        ? "Cet endpoint ne publie pas les limites du compte."
        : `Limites indisponibles (HTTP ${response.status}).`);
      return;
    }

    const data = await response.json();
    const rawLimits = data.limits || [];
    if (rawLimits.length === 0) {
      showLimitsMessage("Aucune limite déclarée pour ce compte.");
      return;
    }

    const modelSelect = document.getElementById("model");
    const selectedModel = modelSelect ? modelSelect.value : "";
    const models = await listerModelesApi(apiBase, apiKey);

    /*
     * Les plafonds du modèle choisi, rattachés par [[limitsForModel]].
     * À défaut, le plus bas du compte : c'est celui d'un autre modèle,
     * d'où le titre qui change pour ne pas le faire passer pour le sien.
     */
    const parModele = limitsForModel(rawLimits, models, selectedModel);
    const merged = parModele || limitsMinimum(rawLimits);

    limitsInfo.textContent = "";
    const titre = document.createElement("div");
    titre.className = "tier-section-title";
    titre.textContent = parModele
      ? "Plafonds de ce modèle"
      : "Plus bas plafond du compte, modèle non rattaché";
    limitsInfo.appendChild(titre);

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

    /*
     * Section "Usage du jour" : interroger /v1/usage sous chacun
     * des noms du modèle, car Albert indexe l'usage par nom de
     * routeur.
     */
    if (selectedModel) {
      const noms = modelNames(models, selectedModel);
      const usage = await fetchDailyUsageForModel(apiBase, apiKey, noms);
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

    /* La section porte l'attribut hidden : la lever par style.display
       ne suffit pas, la règle UA [hidden] est en !important. */
    limitsSection.hidden = false;
  } catch (err) {
    showLimitsMessage(`Limites indisponibles : ${err.message}`);
  }
}
