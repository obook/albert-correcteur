/*
 * ui-root.js - Conteneur d'accueil des éléments d'interface injectés.
 *
 * Badge, popups et notifications étaient ajoutés à document.body. Dans
 * la fenêtre de composition de Thunderbird, ce corps est la zone
 * éditable du message, ce qui avait trois conséquences :
 *   - l'éditeur de Gecko entourait le badge d'un cadre et de poignées
 *     de redimensionnement, comme n'importe quel objet du message ;
 *   - une sélection totale suivie d'une suppression, ou une annulation,
 *     emportait le badge avec le texte ;
 *   - tout ce qui restait affiché au moment de l'envoi partait avec le
 *     courriel, d'où le nettoyage de service-compose-cleanup.js.
 *
 * Les éléments sont donc regroupés dans un conteneur accroché à
 * <html>, hors du corps du document. Les feuilles de style injectées
 * s'appliquent normalement, aucun shadow DOM n'est nécessaire. Les
 * éléments concernés sont tous en position fixe, le conteneur n'a donc
 * aucune incidence sur la mise en page.
 *
 * Les soulignements d'erreurs font exception : ils entourent des mots
 * du texte et restent dans le corps du message.
 *
 * Utilisé par :
 *   - Firefox et Brave : notification/toast.js
 *   - Thunderbird      : compose-badge.js, compose-render.js et les
 *                        trois popups de composition
 *
 * Auteur : O. Booklage
 * Date : août 2026
 * Licence : MIT
 */

"use strict";

window.Albert = window.Albert || {};

/**
 * Renvoie le conteneur d'interface, en le créant au premier appel.
 *
 * @returns {HTMLElement} Élément <albert-ui> enfant de <html>.
 */
window.Albert.uiRoot = function () {
  let conteneur = document.querySelector("albert-ui");
  if (!conteneur) {
    conteneur = document.createElement("albert-ui");
    /* Balise inconnue donc en ligne par défaut : la passer en position
       fixe et de taille nulle évite qu'elle n'occupe une ligne. */
    conteneur.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;";
    document.documentElement.appendChild(conteneur);
  }
  return conteneur;
};
