/*
 * grist-lecture.js - Lecture d'une table Grist pour la recherche par le
 * sens (option "rechercheGrist", désactivée par défaut, Firefox seul).
 *
 * La fenêtre de l'extension (popup-grist.js) demande à la page active la
 * liste des tables du document, puis les lignes de la table choisie. Le
 * script interroge l'API REST de Grist depuis la page : la requête part
 * de la même origine, avec la session de l'utilisateur, sans clé Grist
 * ni permission d'hôte supplémentaire.
 *
 * Messages acceptés :
 *   - "gristTables"  -> { tables: [id, ...] }
 *   - "gristRecords" -> { docKey, lignes: [texte, ...] }
 * Hors d'un document Grist, la réponse est null ; en cas d'échec de
 * l'API, { error }.
 *
 * Auteur : O. Booklage
 * Date : novembre 2026
 * Licence : MIT
 */

"use strict";

/**
 * Adresse de l'API du document Grist ouvert, ou null ailleurs.
 *
 * gristConfig n'existe que sur une page servie par Grist : aucune
 * requête ne part donc vers un autre site. Les URL de document ont la
 * forme [/o/<org>]/<urlId>/<titre>[/p/<page>] ou /doc/<docId>, et
 * l'API accepte l'urlId court (12 caractères au moins).
 *
 * @returns {string|null}
 */
function gristApiDocument() {
  if (!window.wrappedJSObject.gristConfig) return null;
  const m = location.pathname.match(/^(\/o\/[^/]+)?\/(?:doc\/)?([\w-]{12,})(?:\/|$)/);
  return m ? `${location.origin}${m[1] || ""}/api/docs/${m[2]}` : null;
}

async function gristGet(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Grist a refusé la lecture (${response.status}).`);
  return response.json();
}

/* Texte d'une ligne : ses valeurs texte et nombre, dans l'ordre des
   colonnes. Il sert à la fois au calcul du vecteur et à l'affichage. */
function texteLigne(fields) {
  return Object.values(fields)
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" - ");
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type !== "gristTables" && message.type !== "gristRecords") return;
  const api = gristApiDocument();
  if (!api) return Promise.resolve(null);

  const lecture = message.type === "gristTables"
    ? gristGet(`${api}/tables`).then((data) => ({ tables: data.tables.map((t) => t.id) }))
    : gristGet(`${api}/tables/${encodeURIComponent(message.tableId)}/records`)
      .then((data) => ({
        docKey: `${api}/${message.tableId}`,
        lignes: data.records.map((r) => texteLigne(r.fields)).filter(Boolean),
      }));
  return lecture.catch((err) => ({ error: err.message }));
});
