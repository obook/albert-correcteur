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
 * Date : Mai 2026
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
