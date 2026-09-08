/*
 * model-aliases.js - Normalisation des identifiants de modèle Albert.
 *
 * Source de vérité unique partagée entre le service worker
 * (sources-commun/service/) et la popup de configuration
 * (sources-commun/popup-configuration/) pour la table
 * canonique -> alias et la fonction de normalisation.
 *
 * Albert API expose chaque modèle de chat sous deux formes :
 *   - un id canonique  : "mistralai/Mistral-Small-3.2-24B-Instruct-2506"
 *   - un alias stable  : "openweight-medium"
 *
 * Le projet manipule systématiquement l'alias en interne, pour ne pas
 * dépendre des renommages côté fournisseur. Cette table sert à
 * normaliser une configuration héritée enregistrée sous l'id canonique.
 *
 * Chargé :
 *   - dans le service worker via manifest.background.scripts
 *   - dans popup.html et popup-settings.html via <script src="...">
 *
 * Auteur : O. Booklage
 * Date : mai 2026
 * Licence : MIT
 */

"use strict";

/* URL de l'API Albert par défaut. Déclarée ici, avec les autres
   constantes partagées, pour qu'un changement d'URL n'ait qu'un seul
   point d'application : elle était auparavant écrite à l'identique dans
   le service worker et dans la popup de configuration. */
const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

/* Clés en minuscules pour permettre une recherche insensible à la casse. */
const CANONICAL_TO_ALIAS = {
  "openai/gpt-oss-120b": "openweight-large",
  "mistralai/mistral-small-3.2-24b-instruct-2506": "openweight-medium",
  "mistralai/ministral-3-8b-instruct-2512": "openweight-small",
  "qwen/qwen3-coder-30b-a3b-instruct": "openweight-code",
};

/**
 * Normalise un identifiant de modèle vers son alias serveur stable.
 *
 * - Un id canonique connu (toute casse) est converti en alias.
 * - Un alias déjà reconnu est renvoyé en minuscules.
 * - Tout autre identifiant est renvoyé tel quel.
 *
 * @param {string} id - Alias ou id canonique du modèle.
 * @returns {string}
 */
function normalizeModelId(id) {
  if (!id) return id;
  const lower = id.toLowerCase();
  if (lower in CANONICAL_TO_ALIAS) return CANONICAL_TO_ALIAS[lower];
  if (lower.startsWith("openweight-")) return lower;
  return id;
}

/**
 * Plafonds du compte qui s'appliquent vraiment à un modèle donné.
 *
 * Albert publie ses limites par routeur sans jamais nommer le modèle
 * (/v1/me/info) et ses modèles sans jamais nommer le routeur
 * (/v1/models). Les deux listes suivent le même ordre de création : le
 * routeur de rang N porte les plafonds du modèle de rang N. C'est la
 * règle qu'applique llm-proxy, vérifiée sur le compte : le rang 1 sort
 * les plafonds documentés d'openweight-large, le rang 2 ceux
 * d'openweight-code ; les deux routeurs à 2000 rpm tombent sur les
 * modèles d'embeddings et de reclassement.
 *
 * L'appariement n'est tenté que si les deux listes ont la même longueur.
 * Sinon la déduction serait une invention : l'appelant retombe alors sur
 * le minimum tous routeurs confondus, qui sous-estime sans mentir.
 *
 * @param {Array} limits   - Champ `limits` de /v1/me/info.
 * @param {Array} models   - Champ `data` de /v1/models.
 * @param {string} modelId - Alias ou id canonique du modèle cherché.
 * @returns {{rpm, rpd, tpm, tpd}|null} null si le rattachement échoue.
 */
function limitsForModel(limits, models, modelId) {
  const routeurs = new Map();
  for (const l of limits || []) {
    if (!routeurs.has(l.router_id)) routeurs.set(l.router_id, {});
    routeurs.get(l.router_id)[l.type] = l.value;
  }

  const rangs = [...routeurs.keys()].sort((a, b) => a - b);
  const modeles = [...(models || [])].sort((a, b) => a.created - b.created);
  if (rangs.length === 0 || rangs.length !== modeles.length) return null;

  /* Le modèle est cherché sous tous ses noms : la configuration retient
     l'alias, l'API sert l'id canonique, un proxy sert le sien. */
  const cherche = normalizeModelId(modelId || "").toLowerCase();
  if (!cherche) return null;
  const rang = modeles.findIndex((m) => [m.id]
    .concat(Array.isArray(m.aliases) ? m.aliases : [])
    .some((nom) => typeof nom === "string"
      && normalizeModelId(nom).toLowerCase() === cherche));

  return rang < 0 ? null : routeurs.get(rangs[rang]);
}

/**
 * Le plus bas plafond de chaque type, tous routeurs confondus.
 *
 * Repli quand le rattachement échoue : sous-estimer le quota ralentit
 * la frappe, le surestimer déclenche des 429. Un `null` vaut "illimité"
 * et cède donc devant n'importe quelle valeur chiffrée.
 *
 * @param {Array} rawLimits - Champ `limits` de /v1/me/info.
 * @returns {Object} Objet { rpm, rpd, tpm, tpd }.
 */
function limitsMinimum(rawLimits) {
  const limits = {};
  for (const l of rawLimits || []) {
    if (!(l.type in limits) || limits[l.type] === null) {
      limits[l.type] = l.value;
    } else if (l.value !== null) {
      limits[l.type] = Math.min(limits[l.type], l.value);
    }
  }
  return limits;
}

/* Export pour les tests Node. En navigateur, les scripts classiques
   partagent déjà la portée globale : rien à publier. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeModelId, limitsForModel, limitsMinimum, DEFAULT_API_BASE,
  };
}
