/*
 * service-compose-cleanup.js - Nettoyage du courriel avant envoi.
 *
 * Le badge Albert, les soulignements d'erreurs et la zone aria-live
 * sont injectés dans le DOM du corps du message (document.body du
 * compose). Sans cette intervention, ils partiraient avec le courriel
 * envoyé :
 *   - le destinataire verrait le mot « Albert » (alt de l'image du
 *     badge) en fin de message ;
 *   - des balises <span class="albert-error"> resteraient autour
 *     des mots erronés non corrigés ;
 *   - le texte d'annonce aux lecteurs d'écran (« 1 erreur détectée. »)
 *     issu du div.albert-aria-live apparaîtrait à la fin du message.
 *
 * Ce module écoute l'événement compose.onBeforeSend (déclenché juste
 * avant l'envoi) et retire :
 *   - le badge complet (div.albert-badge) ;
 *   - la zone d'annonce aux lecteurs d'écran (div.albert-aria-live) ;
 *   - les spans de soulignement (span.albert-error), en conservant
 *     leur contenu textuel.
 *
 * Le nettoyage s'applique aussi à plainTextBody (mode texte brut),
 * où le mot « Albert » et les lignes d'annonce d'erreurs peuvent
 * subsister isolés sur leur ligne.
 *
 * Auteur : O. Booklage
 * Date : Mai 2026
 * Licence : MIT
 */

"use strict";

/* Repère une ligne d'annonce produite par compose-render.js, par
 * exemple « Aucune erreur détectée. », « 1 erreur détectée. » ou
 * « 3 erreurs détectées. ». */
const REGEX_ANNONCE_ERREURS = /^(Aucune erreur détectée\.|\d+ erreurs? détectées?\.)$/;

/* Nettoie le HTML d'un courriel : retire le badge Albert, la zone
 * aria-live d'annonce, et déballe les spans de soulignement en
 * conservant le texte qu'ils entourent.
 *
 * Si le HTML ne contient aucun marqueur Albert, il est renvoyé tel
 * quel pour éviter de re-sérialiser le document (préserve la fidélité
 * du HTML d'origine, notamment les commentaires conditionnels). */
function nettoyerCorpsHtml(html) {
  if (!html) return html;
  if (!html.includes("albert-")) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  /* Retirer complètement les éléments injectés par Albert dans le corps
   * du compose : badge, popups (correction, reformulation, traduction),
   * notifications et zone d'annonce pour les lecteurs d'écran. Sans ce
   * nettoyage, un envoi effectué pendant qu'une popup est ouverte
   * expédierait son HTML au destinataire. */
  doc.querySelectorAll(
    ".albert-badge, .albert-popup, .albert-toast, .albert-aria-live"
  ).forEach((node) => node.remove());

  /* Déballer les spans de soulignement : déplacer leurs enfants
   * juste avant le span, puis supprimer le span lui-même. */
  doc.querySelectorAll("span.albert-error").forEach((span) => {
    const parent = span.parentNode;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });

  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

/* Nettoie la version texte brut : supprime les lignes ne contenant
 * que le mot « Albert » (provenant du alt de l'image du badge lors
 * de la conversion HTML → texte effectuée par Thunderbird) ou une
 * annonce d'erreurs produite par la zone aria-live. */
function nettoyerCorpsTexte(texte) {
  if (!texte) return texte;
  return texte
    .split("\n")
    .filter((ligne) => {
      const ligneSimplifiee = ligne.trim();
      if (ligneSimplifiee === "Albert") return false;
      if (REGEX_ANNONCE_ERREURS.test(ligneSimplifiee)) return false;
      return true;
    })
    .join("\n");
}

browser.compose.onBeforeSend.addListener((tab, details) => {
  const detailsModifies = {};

  if (details.body) {
    const corpsNettoye = nettoyerCorpsHtml(details.body);
    if (corpsNettoye !== details.body) {
      detailsModifies.body = corpsNettoye;
    }
  }

  if (details.plainTextBody) {
    const texteNettoye = nettoyerCorpsTexte(details.plainTextBody);
    if (texteNettoye !== details.plainTextBody) {
      detailsModifies.plainTextBody = texteNettoye;
    }
  }

  /* Si rien n'a été modifié, on laisse Thunderbird envoyer tel quel. */
  if (Object.keys(detailsModifies).length === 0) {
    return {};
  }

  return { details: detailsModifies };
});
