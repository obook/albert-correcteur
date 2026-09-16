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
       fixe et de taille nulle évite qu'elle n'occupe une ligne.
       "all:initial" d'abord, car l'attribut contenteditable posé plus
       bas rend le conteneur cible de tout sélecteur [contenteditable]
       de la page : un site qui donne à ses éditeurs un fond, un cadre
       et une hauteur minimale peignait ainsi un rectangle dans le coin
       haut gauche de la fenêtre.
       Un élément fixe forme son propre contexte d'empilement : sans
       z-index, le z-index maximal des popups ne vaut qu'à l'intérieur,
       et les soulignements de la page passaient par-dessus. */
    conteneur.style.cssText =
      "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
    /* La fenêtre de composition de Thunderbird met tout le document en
       designMode, y compris ce qui est accroché à <html>. Sans ce
       garde, les popups deviennent du contenu à éditer : un clic sur un
       sélecteur ou sur un bouton déplace le curseur au lieu d'agir.
       L'attribut vaut pour toute la descendance. */
    conteneur.contentEditable = "false";
    document.documentElement.appendChild(conteneur);
  }

  /* Isolation par shadow DOM là où la liste des feuilles est fournie
     (Firefox et Brave). Les sites aux CSS agressives ne peuvent plus
     déformer badge, popups et notifications, et nos règles ne fuient
     plus dans la page. Les feuilles déclarées par le manifest ne
     franchissent pas cette frontière, il faut les réimporter. */
  if (!conteneur.shadowRoot && Array.isArray(window.Albert.UI_CSS)) {
    const racine = conteneur.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = window.Albert.UI_CSS
      .map((f) => "@import url(" + browser.runtime.getURL(f) + ");")
      .join("\n");
    racine.appendChild(style);
  }

  return conteneur.shadowRoot || conteneur;
};
