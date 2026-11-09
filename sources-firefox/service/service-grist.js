/*
 * service-grist.js - Recherche par le sens dans une table Grist (option
 * "rechercheGrist", désactivée par défaut, Firefox seul).
 *
 * Reçoit de la fenêtre de l'extension les lignes de la table, lues dans
 * la page par grist/grist-lecture.js, et la question de l'utilisateur.
 * Calcule les vecteurs avec /v1/embeddings (même URL et même clé que la
 * correction) et renvoie les lignes les plus proches de la question.
 *
 * Les vecteurs des lignes restent en cache dans storage.local, indexés
 * par le texte de la ligne : seules les lignes nouvelles ou modifiées
 * repartent vers l'API.
 *
 * Message accepté :
 *   - "gristSearch" { docKey, lignes, question }
 *       -> { resultats: [{ texte, score }] } ou { error }
 *
 * Auteur : O. Booklage
 * Date : novembre 2026
 * Licence : MIT
 */

"use strict";

/* Alias de BAAI/bge-m3, servi sous ce nom par Albert et par llm-proxy. */
const GRIST_MODELE = "openweight-embeddings";
const GRIST_TAILLE_LOT = 32;
const GRIST_NB_RESULTATS = 5;
/* Borne le coût d'un clic sur une très grosse table (quota de la clé,
   stockage local) ; voir le shortcut de rechercherGrist. */
const GRIST_MAX_LIGNES = 2000;

/**
 * Vecteurs des textes, dans le même ordre, par lots de GRIST_TAILLE_LOT.
 *
 * @param {{apiBase: string, apiKey: string}} config
 * @param {string[]} textes
 * @returns {Promise<number[][]>}
 */
async function vecteursGrist(config, textes) {
  const vecteurs = [];
  for (let i = 0; i < textes.length; i += GRIST_TAILLE_LOT) {
    const lot = textes.slice(i, i + GRIST_TAILLE_LOT);
    const response = await fetch(`${config.apiBase}/v1/embeddings`, {
      method: "POST",
      headers: enteteApi(config),
      body: JSON.stringify({ model: GRIST_MODELE, input: lot }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Albert a refusé le calcul des vecteurs (${response.status}).`);
    const data = await response.json();
    if (!data || !Array.isArray(data.data) || data.data.length !== lot.length
      || !data.data.every((d) => Array.isArray(d.embedding))) {
      throw new Error("Réponse inattendue de l'API pour le calcul des vecteurs.");
    }
    data.data.sort((a, b) => a.index - b.index);
    for (const item of data.data) vecteurs.push(item.embedding);
  }
  return vecteurs;
}

function cosinusGrist(a, b) {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return ab / Math.sqrt(aa * bb);
}

/**
 * Lignes de la table les plus proches de la question.
 *
 * shortcut: les vecteurs sont stockés en tableaux JSON (environ 20 Ko
 * par ligne avec bge-m3) ; au-delà de quelques milliers de lignes,
 * passer à IndexedDB et à des Float32Array.
 *
 * @param {{docKey: string, lignes: string[], question: string}} demande
 * @returns {Promise<{resultats?: {texte: string, score: number}[], error?: string}>}
 */
async function rechercherGrist({ docKey, lignes, question }) {
  if (lignes.length > GRIST_MAX_LIGNES) {
    return { error: `Table trop grande pour cette version (${GRIST_MAX_LIGNES} lignes au plus).` };
  }
  try {
    const config = await loadConfig();
    const cle = `gristVecteurs:${GRIST_MODELE}:${docKey}`;
    const stockes = (await browser.storage.local.get(cle))[cle] || {};
    const manquantes = [...new Set(lignes.filter((t) => !stockes[t]))];
    const nouveaux = await vecteursGrist(config, manquantes);

    /* Ne garder que les lignes présentes : une ligne supprimée ou
       modifiée sort du cache. */
    const vecteurs = {};
    for (const t of lignes) vecteurs[t] = stockes[t];
    manquantes.forEach((t, i) => { vecteurs[t] = nouveaux[i]; });
    if (manquantes.length || Object.keys(stockes).length !== Object.keys(vecteurs).length) {
      await browser.storage.local.set({ [cle]: vecteurs });
    }

    const [q] = await vecteursGrist(config, [question]);
    const resultats = Object.keys(vecteurs)
      .map((texte) => ({ texte, score: cosinusGrist(q, vecteurs[texte]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, GRIST_NB_RESULTATS);
    return { resultats };
  } catch (err) {
    AlbertLog.warn("rechercherGrist :", err && err.message);
    return { error: err.message };
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message && message.type === "gristSearch") return rechercherGrist(message);
});
