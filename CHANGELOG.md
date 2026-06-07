# Journal des modifications

Toutes les modifications notables de ce projet sont consignées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [0.4.0] - 2026-06-07

### Ajouté
- Portage de l'extension pour Brave et les navigateurs Chromium : manifest
  Manifest V3, service worker (`sources-brave/`), script `build-brave.sh` et
  cible `build-brave` dans la CI. Les content scripts de Firefox sont réutilisés
  tels quels.
- Accès à l'API `browser.*` sous Brave via un shim maison d'une ligne
  (`browser-shim.js`), sans aucune dépendance tierce.

### Corrigé
- Badge cassé sous Brave : ajout des icônes SVG dans `web_accessible_resources`,
  requis par le Manifest V3 pour les ressources injectées dans la page.

### Sécurité
- Protection contre la détection de l'extension par les sites (`use_dynamic_url`
  sous Brave) : l'URL des ressources exposées devient un jeton tournant.

### Accessibilité
- Ajout d'un élément `<title>` aux pages `popup.html` (Configuration) et
  `popup-settings.html` (Paramètres).
- Mise en conformité des contrastes de couleur (WCAG 2.1 AA) dans le thème
  des popups : descriptions de réglages, séparateurs de pied de page,
  messages d'erreur et messages de succès passent désormais le seuil 4.5:1.
- Ajout de noms accessibles (`role="textbox"` et `aria-label`) sur les champs
  `contenteditable` de la page d'exemple `exemple/test.html`.

### Modifié
- Remplacement des styles en ligne `display:none` par l'attribut HTML `hidden`
  dans les popups.
- Ajout de l'attribut `type` au bouton de bascule de thème de la page d'exemple.

## [0.3.5] - 2026-05-26
- Montée de version de maintenance.

## [0.3.4] - 2026-05-19
### Corrigé
- Fuite du mot "Albert" en fin de courriel dans Thunderbird.

## [0.3.3] - 2026-05-19
### Ajouté
- Affichage du badge dans Tchap dès l'ouverture du composeur.

## [0.3.2] - 2026-05-19
### Ajouté
- Affichage du badge EcoleDirecte au premier focus.

## [0.3.1] - 2026-05-18
- Montée de version de maintenance.

## [0.3.0] - 2026-05-17
### Modifié
- Amélioration de la détection sur les petits modèles et refonte interne.

## [0.2.30] - 2026-05-13
- Publication de maintenance.

## [0.2.29] - 2026-05-08
### Corrigé
- Inclusion indésirable du badge Albert dans le courriel envoyé (Thunderbird).

## [0.2.28] - 2026-05-07
### Ajouté
- Thème sombre/clair appliqué à la popup de configuration.

## [0.2.27] - 2026-05-03
### Modifié
- Gestion renforcée des quotas Albert.

## [0.2.26] - 2026-05-01
### Ajouté
- État visuel de panne de l'API avec relance manuelle du badge.

## [0.2.25] - 2026-04-06
- Montée de version de maintenance.

## [0.2.24] - 2026-04-05
### Corrigé
- Remplacement au mauvais offset dans les éditeurs riches.

## [0.2.23] - 2026-04-04
### Corrigé
- Correction du fonctionnement sur WhatsApp Web, de l'accentuation et de la
  qualité du code.

## [0.2.22] - 2026-04-03
### Corrigé
- Filtrage limité aux seuls modèles de génération de texte (text-generation).

## [0.2.21] - 2026-04-02
### Ajouté
- Animation radar du badge et logo bicolore pendant la recherche.
### Modifié
- Réduction du debounce.

## [0.2.20] - 2026-04-02
### Ajouté
- Sélection intelligente des modèles et badge initial rouge.
### Corrigé
- Correction du comportement dans les champs contenteditable.

## [0.2.19] - 2026-03-29
### Modifié
- Enrichissement des prompts et amélioration de la qualité du code.
### Corrigé
- Correction de la fonction de reformulation.

## [0.2.18] - 2026-03-28
### Ajouté
- Conformité RGAA/ANSSI, exclusion des champs d'authentification, prise en
  charge de CTRL+Z, migration des offsets et vérification incrémentale.

## [0.2.17] - 2026-03-28
### Corrigé
- Correction des soulignements dans Thunderbird et amélioration du prompt.

## [0.2.16] - 2026-03-28
### Ajouté
- Extension Thunderbird et refactorisation du code partagé.
### Corrigé
- Corrections du prompt.

## [0.2.15] - 2026-03-28
### Corrigé
- Compensation de la marge verticale des éditeurs riches (CKEditor/EcoleDirecte).

## [0.2.14] - 2026-03-28
### Corrigé
- Correction du décalage des soulignements et recalibrage des offsets renvoyés
  par le modèle.

## [0.2.13] - 2026-03-27
### Modifié
- Refonte de l'architecture, accessibilité RGAA et debounce adaptatif.

## [0.2.12] - 2026-03-22
### Modifié
- Revue de code, renommages et correction de la description.

## [0.2.10] - 2026-03-22
### Modifié
- Robustification du remplacement dans les éditeurs riches.

## [0.2.9] - 2026-03-22
### Corrigé
- Correction du remplacement dans les contenteditable simples.

## [0.2.8] - 2026-03-19
### Modifié
- Chaine d'intégration continue : suppression de release via API.

## [0.2.7] - 2026-03-19
- Montée de version (la v0.2.6 ayant été retirée d'AMO).

## [0.2.5] - 2026-03-19
### Corrigé
- Correction du remplacement de mots dans CKEditor (EcoleDirecte).

## [0.2.4] - 2026-03-18
### Corrigé
- Correction de la traduction des textes longs et techniques.

## [0.2.3] - 2026-03-18
### Modifié
- Signature Mozilla du fichier .xpi via web-ext sign (distribution unlisted).

## [0.2.2] - 2026-03-18
### Ajouté
- Mises à jour automatiques pour Firefox.
### Corrigé
- Correction du lien de téléchargement.

## [0.2.1] - 2026-03-18
### Ajouté
- Compatibilité avec les éditeurs React (x.com, Draft.js, Lexical).

## [0.2.0] - 2026-03-17
### Ajouté
- Fonction de traduction et refactorisation des popups.
### Modifié
- Amélioration de la documentation.

## [0.1.4] - 2026-03-17
### Ajouté
- Affichage du badge au focus et icônes d'état erreur/ok.
### Modifié
- Suppression du halo.

## [0.1.3] - 2026-03-17
### Modifié
- Compatibilité Firefox ESR 128+ (DGFIP).

## [0.1.2] - 2026-03-17
### Corrigé
- Icônes PNG pour la compatibilité AMO.

## [0.1.1] - 2026-03-17
### Corrigé
- Icônes PNG pour la compatibilité AMO.

## [0.1.0] - 2026-03-17
### Ajouté
- Première version publiée de l'extension Albert Correcteur.

[Non publié]: https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/compare/v0.3.5...main
[0.3.5]: https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/releases/v0.3.5
