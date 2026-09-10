/*
 * service-compose-cleanup.js - Nettoyage du courriel avant envoi.
 *
 * Badge, popups, notifications et zone d'annonce aux lecteurs d'écran
 * vivent dans le conteneur <albert-ui> accroché à <html> (util/ui-root.js),
 * hors du corps du message. Cela les met à l'abri de l'éditeur, mais pas
 * de l'envoi : Thunderbird sérialise le document entier, si bien que leur
 * texte se retrouvait à la fin du courriel reçu, par exemple
 * « Aucune erreur détectée. » sous la signature.
 *
 * Réécrire details.body ou details.plainTextBody ne suffit pas : ces
 * champs ne portent que le corps, et le conteneur, resté en place, était
 * de nouveau sérialisé à l'envoi. Il faut donc le retirer du document
 * lui-même, ce que fait ce module avant de laisser partir le message.
 *
 * Les soulignements d'erreurs, eux, entourent des mots du message et
 * vivent dans son corps : ils sont déballés dans details.body, seule
 * voie pour les retirer sans toucher au reste du texte. En composition
 * texte brut, les balises disparaissent d'elles-mêmes à la conversion.
 *
 * Auteur : O. Booklage
 * Date : mai 2026
 * Licence : MIT
 */

"use strict";

/* Nettoie le HTML d'un courriel : déballe les spans de soulignement en
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

  /* Filet pour les brouillons enregistrés avant que l'interface ne sorte
   * du corps du message : ils peuvent encore contenir ces éléments. */
  doc.querySelectorAll(
    "albert-ui, .albert-badge, .albert-popup, .albert-toast, .albert-aria-live"
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

/* Retire du document de composition le conteneur de l'interface. Le
 * badge repousse tout seul si l'envoi est finalement annulé : son
 * observateur (compose-badge.js) surveille tout le document. */
async function retirerInterfaceInjectee(tabId) {
  try {
    await browser.tabs.executeScript(tabId, {
      code: "document.querySelectorAll('albert-ui').forEach((n) => n.remove());",
    });
  } catch (err) {
    AlbertLog.warn("Retrait de l'interface avant envoi impossible :", err);
  }
}

browser.compose.onBeforeSend.addListener(async (tab, details) => {
  await retirerInterfaceInjectee(tab.id);

  /* En texte brut, le retrait du conteneur suffit : les balises
   * restantes ne survivent pas à la conversion en texte. */
  if (details.isPlainText) return {};

  /* Relire le corps une fois le conteneur parti, pour ne pas le
   * réinjecter avec la version capturée à l'ouverture de l'écouteur. */
  const frais = await browser.compose.getComposeDetails(tab.id);
  const corpsNettoye = nettoyerCorpsHtml(frais.body);
  if (corpsNettoye === frais.body) return {};

  return { details: { body: corpsNettoye } };
});
