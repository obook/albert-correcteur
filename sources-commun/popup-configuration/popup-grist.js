/*
 * popup-grist.js - Recherche par le sens dans la table Grist de l'onglet
 * actif (option "rechercheGrist", désactivée par défaut).
 *
 * Le formulaire reste caché si l'option est coupée ou si l'onglet
 * n'affiche pas un document Grist : seul grist/grist-lecture.js
 * (Firefox) répond aux messages "gristTables" et "gristRecords".
 * Le calcul des vecteurs est confié au script de fond
 * (service/service-grist.js).
 *
 * Auteur : O. Booklage
 * Date : novembre 2026
 * Licence : MIT
 */

"use strict";

(async () => {
  const { rechercheGrist } = await browser.storage.local.get("rechercheGrist");
  if (rechercheGrist !== true) return;

  const [onglet] = await browser.tabs.query({ active: true, currentWindow: true });
  /* frameId 0 : la page Grist elle-même, pas ses widgets en iframe. */
  const demander = (message) => browser.tabs.sendMessage(onglet.id, message, { frameId: 0 });
  const tables = await demander({ type: "gristTables" }).catch(() => null);
  if (!tables) return;

  const form = document.getElementById("grist-form");
  const select = document.getElementById("grist-table");
  const question = document.getElementById("grist-question");
  const statut = document.getElementById("grist-status");
  const liste = document.getElementById("grist-resultats");

  function afficherStatut(texte, erreur) {
    statut.textContent = texte;
    statut.className = erreur ? "status err" : "status";
  }

  form.hidden = false;
  if (tables.error) {
    afficherStatut(tables.error, true);
    return;
  }
  for (const id of tables.tables) select.add(new Option(id, id));
  question.focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    liste.replaceChildren();
    afficherStatut("Lecture de la table...");
    const table = await demander({ type: "gristRecords", tableId: select.value })
      .catch((err) => ({ error: err.message }));
    if (!table || table.error) {
      afficherStatut(table ? table.error : "La page Grist ne répond plus.", true);
      return;
    }
    /* Le premier passage calcule les vecteurs de toutes les lignes. */
    afficherStatut(`Recherche parmi ${table.lignes.length} lignes...`);
    const reponse = await browser.runtime.sendMessage({
      type: "gristSearch",
      docKey: table.docKey,
      lignes: table.lignes,
      question: question.value,
    }).catch((err) => ({ error: err.message }));
    if (reponse.error) {
      afficherStatut(reponse.error, true);
      return;
    }
    /* Annoncé par la zone role="status" pour les lecteurs d'écran. */
    afficherStatut(`${reponse.resultats.length} lignes les plus proches :`);
    for (const { texte, score } of reponse.resultats) {
      const item = document.createElement("li");
      item.textContent = `${texte} (${score.toFixed(2)})`;
      liste.append(item);
    }
  });
})();
