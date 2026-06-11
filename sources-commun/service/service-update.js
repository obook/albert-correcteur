/*
 * service-update.js - Report de la mise à jour automatique de l'extension.
 *
 * Sans ce module, le navigateur applique la mise à jour dès son
 * téléchargement : le background redémarre et les scripts de contenu
 * déjà injectés dans les pages ouvertes deviennent orphelins
 * ("Extension context invalidated"). Une correction en cours serait
 * perdue et les boutons Albert resteraient inertes jusqu'au rechargement
 * manuel de chaque page.
 *
 * Les scripts de contenu étant déclarés sur <all_urls>, il n'existe
 * pratiquement jamais de moment où l'extension est inutilisée tant
 * qu'une fenêtre est ouverte (et détecter ce moment exigerait la
 * permission "tabs", donc un avertissement supplémentaire à
 * l'installation). Le simple fait d'écouter runtime.onUpdateAvailable
 * suspend l'application automatique : la mise à jour téléchargée
 * s'appliquera au prochain démarrage du navigateur, moment où les pages
 * se rechargent de toute façon.
 *
 * Fonctionne tel quel sur les trois cibles : Firefox et Thunderbird
 * (Manifest V2), Brave / Chromium (Manifest V3 via browser-shim.js).
 *
 * Auteur : O. Booklage
 * Date : Juin 2026
 * Licence : MIT
 */

"use strict";

/* Garde d'existence : si une plateforme n'expose pas l'événement
 * (vieille version de Thunderbird par exemple), on retombe sans bruit
 * sur le comportement par défaut. */
if (browser.runtime.onUpdateAvailable) {
  browser.runtime.onUpdateAvailable.addListener((details) => {
    /* Ne rien faire : ne PAS appeler runtime.reload(). L'écouteur
     * suffit à différer la mise à jour jusqu'au prochain démarrage. */
    console.info(
      `[Albert] Mise à jour ${details && details.version ? details.version + " " : ""}` +
      "téléchargée : elle sera appliquée au prochain démarrage du navigateur.",
    );
  });
}
