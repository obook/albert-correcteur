# Journal des modifications

Toutes les modifications notables de ce projet sont consignées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [0.9.0] - 2026-11-14

### Ajouté
- La langue de traduction se choisit dans une liste déroulante au lieu de
  quatre boutons. La liste est faite maison : dans la fenêtre de rédaction de
  Thunderbird, un `<select>` ne s'ouvre pas au clic.
- Recherche par le sens dans une table Grist, à partir de la fenêtre de
  l'extension. L'option reste cachée et désactivée tant que la déclaration de
  collecte de données AMO n'est pas revue.

### Corrigé
- Sur x.com, l'ascenseur du champ de rédaction recouvrait le badge et les
  points tournants de la vérification. Le badge garde maintenant une marge
  avec le bord du champ et l'animation d'attente tient dans ses 16 px : le
  logo s'efface, deux points tournent à sa place.
- Traduire un texte vers sa propre langue le réécrivait en français. Le texte
  est maintenant rendu tel quel.
- Le lien de demande de clé API pointait vers l'ancien site Albert.

## [0.8.7] - 2026-11-04

### Corrigé
- Dans les bulletins de Pronote, cliquer sur une suggestion ne corrigeait pas
  l'appréciation : la case se fermait dès l'ouverture de la popup. Les popups
  de correction et de reformulation laissent maintenant la case ouverte. Au
  clavier, Tab fait entrer dans la popup.

## [0.8.6] - 2026-11-03

### Corrigé
- Dans un éditeur placé dans une iframe, comme le cahier de textes de Pronote,
  le cadre coupait la popup de correction : les suggestions restaient cachées
  et impossibles à cliquer. La popup s'affiche maintenant dans la page.

## [0.8.5] - 2026-10-23

### Corrigé
- Sur Facebook, dans un post ouvert depuis le fil, cliquer sur un mot souligné
  n'affichait rien quand l'extension "Tracking & Ad Removal on FaceBk" était
  active : elle arrêtait le clic avant qu'il n'atteigne le soulignement.
  L'extension capte maintenant le clic au niveau de la fenêtre.

## [0.8.4] - 2026-10-03

### Corrigé
- Dans une fenêtre modale, comme le cahier de texte d'EcoleDirecte, cliquer sur
  un mot souligné n'affichait rien : la popup s'ouvrait derrière la modale.
- Avec un serveur local sans clé API, la liste des modèles restait vide. La clé
  devient facultative.
- Thunderbird : le texte du badge et des notifications partait avec le
  courriel.
- Thunderbird : un texte collé au-dessus de la citation n'était pas vérifié.
- Le délai entre deux corrections pendant la frappe était deux fois trop long.
  L'extension lisait les quotas du compte en gardant le plus bas tous modèles
  confondus, soit 50 requêtes par minute sur un compte où openweight-code en
  autorise 100 : le débounce s'établissait à 3 000 ms au lieu de 1 500 ms.
  Albert ne nomme le modèle ni dans `/v1/me/info` ni le routeur dans
  `/v1/models`, mais les deux listes suivent le même ordre de création : les
  plafonds sont maintenant rattachés par rang, comme le fait llm-proxy. Quand
  les deux listes n'ont pas la même longueur, le plus bas plafond du compte
  reste appliqué et la popup indique qu'il n'appartient pas au modèle affiché.
- Des fautes n'étaient jamais signalées, sans trace ni dans la console ni dans
  le badge. Une règle de filtrage exigeait qu'une suggestion garde le « s »
  final du mot erroné, ce qui écartait toute correction consistant à le
  retirer ou à le remplacer : les pluriels en -aux (« chevals » pour
  « chevaux »), les composés à second élément invariable (« timbres-postes »
  pour « timbres-poste ») et les mots invariables mal orthographiés
  (« parmis », « malgrés »).

### Modifié
- Thunderbird ne soumet plus le texte cité ni la signature à l'API. Dans une
  réponse, ils représentent l'essentiel du corps : sur un fil ordinaire, 8 157
  des 8 623 caractères envoyés à chaque frappe. Le modèle mettait d'autant plus de temps à répondre, et le badge
  tournait assez longtemps pour laisser croire que rien n'était corrigé. Seul
  le texte rédigé part maintenant, et les offsets sont ramenés vers le corps du
  message avant l'affichage des soulignements.
- Le lien de demande de clé pointe vers albert.playground.etalab.gouv.fr.

## [0.8.3] - 2026-08-30

### Corrigé
- Un rectangle blanc apparaissait dans le coin haut gauche de la page. Le
  conteneur des éléments d'interface porte `contenteditable="false"` pour
  Thunderbird, et les sites qui habillent leurs champs éditables avec un
  sélecteur `[contenteditable]` l'attrapaient au passage. Il est maintenant
  isolé des styles de la page.

## [0.8.2] - 2026-08-30

### Corrigé
- Sur x.com et les éditeurs de même famille, une correction s'écrivait dans le
  paragraphe où l'utilisateur avait laissé son curseur, en y recopiant la ligne
  corrigée. La sélection était posée trop tôt après le retour du focus dans
  l'éditeur, qui l'ignorait.
- Une correction appliquée après une autre pouvait viser une autre occurrence
  du même mot : le soulignement gardait la correction telle qu'elle était au
  moment du rendu, sans ses offsets recalibrés.
- Un champ trop petit portant `role="textbox"` recevait un badge : cet attribut
  dispensait du seuil de taille.

### Ajouté
- Une page d'essai `exemple/test-draftjs.html` monte un vrai Draft.js, avec
  blocs vides et rendu concurrent, pour reproduire ce que la structure simulée
  ne montre pas.

## [0.8.1] - 2026-08-30

### Corrigé
- Les webmails qui montent leur zone de rédaction dans une iframe sans URL
  (Roundcube, Zimbra, TinyMCE) n'étaient pas pris en charge du tout : ni badge,
  ni correction. Le script n'y était pas injecté.
- Un corps de document en designMode, forme classique de Zimbra, n'était pas
  reconnu comme champ texte.
- Dans ces éditeurs, badge, soulignements, popups et zone ARIA étaient insérés
  dans le corps du message : ils partaient avec le courriel, et l'overflow du
  champ rognait les soulignements, invisibles.
- Les soulignements dérivaient dès le deuxième paragraphe d'un message, et
  tombaient à côté sur un mot en gras ou dans un lien.
- La popup de correction remontait hors de l'écran quand l'éditeur était plus
  petit qu'elle.

### Ajouté
- L'interface (popups, notifications) est isolée dans un shadow DOM. Les CSS
  de la page ne peuvent plus la déformer.
- Une page d'essai `exemple/test-iframes.html` couvre douze formes de champ en
  iframe.

## [0.8.0] - 2026-08-29

### Ajouté
- Les paliers documentés du modèle "code" (openweight-code) s'affichent dans
  le panneau des limites, qui n'indiquait rien pour ce modèle.
- Un lanceur `exemple/servir-test.sh` sert la page de test en HTTP et l'ouvre
  dans le navigateur. Les extensions ne s'injectent pas dans une page ouverte
  en file://.

### Corrigé
- Les corrections portant sur un passage à espace insécable étaient refusées
  avec "le texte a changé". Le cas est fréquent en français, où l'insécable
  précède ; : ! ? et habite les guillemets et les séparateurs de milliers.
- Une correction appliquée décalait mal les suivantes quand le mot n'était pas
  exactement là où le modèle l'annonçait. Le clic suivant tombait à côté.
- Sur x.com et les éditeurs de même famille, le remplacement s'écrivait
  parfois en fin de texte au lieu du mot visé.
- Un champ qui s'agrandit au focus ne recevait jamais son badge : il était
  mesuré trop tôt, avant son agrandissement.
- Ce même champ se repliait au clic sur un mot souligné, sur le badge ou dans
  la popup, qui lui prenaient le focus.
- Configuration : le gestionnaire de mots de passe de Firefox se proposait sur
  le champ "URL de l'API", qu'il prenait pour un identifiant.

## [0.7.0] - 2026-08-26

### Modifié
- Thunderbird : "Traduire avec Albert" en lecture de message affiche la popup
  dans le message lui-même, au lieu d'ouvrir une fenêtre à part. L'extension
  demande la permission "lire et modifier vos courriels tels qu'ils vous sont
  présentés", nécessaire à cette injection.
- Thunderbird : un seul bouton "Albert", dans la barre principale. Le bouton
  de la fenêtre de rédaction ouvrait le même panneau de configuration ; le
  badge et les menus contextuels y restent.
- Une seule popup de traduction pour Firefox, Brave et Thunderbird. Chaque
  cible avait la sienne, avec des écarts : bandeau, thème automatique ignoré,
  langues recopiées, pas de déplacement à la souris côté Thunderbird.
- Traduction : le choix de la langue se fait par des boutons. Dans la fenêtre
  de rédaction de Thunderbird, une liste déroulante ne s'ouvrait pas au clic.

### Corrigé
- Les popups ne peuvent plus être déplacées hors de la fenêtre, et ne sautent
  plus d'une demi-largeur quand on saisit la poignée.
- Thunderbird : le bouton "Copier" de la traduction ne copiait rien depuis la
  fenêtre de rédaction. La copie passe par le script de fond.
- Thunderbird : dans la fenêtre de rédaction, les boutons et listes des
  popups déplaçaient le curseur d'édition au lieu d'agir.
- Thunderbird : chaque reformulation laissait deux écouteurs de souris actifs
  jusqu'à la fermeture de la fenêtre.
- Traduction : si Albert ne répond pas, "Traduction en cours" ne reste plus
  affiché sans fin.

## [0.6.6] - 2026-08-26

### Corrigé
- Configuration : le champ "Clé de l'API" affichait un mot de passe enregistré
  dans le navigateur à la place de la clé chargée depuis le stockage.
  Enregistrer depuis ce panneau remplaçait alors la vraie clé. Firefox et
  Thunderbird ignorent `autocomplete="off"` sur un champ de mot de passe, le
  champ utilise maintenant `new-password`.

## [0.6.5] - 2026-08-26

### Corrigé
- Le délai d'attente d'une réponse de l'API passe de 30 à 300 secondes.
  openweight-large dépasse souvent 30 secondes, et derrière un proxy l'attente
  peut aller plus loin. Les messages "Reformulation en cours" durent aussi
  longtemps.
- Thunderbird : deux badges pouvaient se superposer dans la fenêtre de
  composition. Une seconde injection des scripts repartait d'un état neuf et
  ajoutait un badge alors que le premier était toujours affiché.

## [0.6.4] - 2026-08-25

### Corrigé
- Configuration : le bloc "Limites du compte" ne s'affichait plus. La section
  porte l'attribut `hidden` depuis la mise en conformité HTML, et le style en
  ligne qui servait à la révéler ne peut pas passer devant.
- Paramètres : le message "Aucun mot ignoré" avait disparu pour la même raison.
- Configuration : l'usage du jour restait à zéro dès que l'URL de l'API pointait
  sur un proxy, qui renomme les modèles. La correspondance se fait maintenant
  sur tous les noms d'un modèle, pas sur un seul identifiant.
- Configuration : l'usage du jour s'arrêtait à dix requêtes, l'API n'en renvoie
  pas davantage sans paramètre. Les événements sont maintenant paginés depuis
  minuit UTC.
- Configuration : quand les limites ne sont pas disponibles, la raison est
  affichée au lieu d'un bloc qui disparaît sans rien dire.

## [0.6.3] - 2026-08-25

### Modifié
- Configuration : l'URL de l'API passe avant la clé, et le libellé "Clé API
  Albert" devient "Clé de l'API" puisque l'URL peut viser un autre serveur.

## [0.6.2] - 2026-08-24

### Corrigé
- Configuration : la liste des modèles restait vide quand l'URL de l'API
  pointait sur un proxy local compatible OpenAI. Le filtre réclamait le
  type de tâche ("text-generation") que seule l'API Albert publie ; une
  entrée sans ce champ est maintenant retenue. Les modèles de
  reconnaissance de texte dans l'image restent écartés.

## [0.6.1] - 2026-08-06

### Corrigé
- Thunderbird : l'extension était morte au chargement du compose avec
  l'erreur "Albert.buildInnerTextSegments is not a function". L'objet
  Albert, déclaré en constante lexicale, n'existait pas sur window, et les
  modules partagés avec Firefox s'accrochaient à un second objet isolé.
- Thunderbird : un cadre clair entourait le badge. L'icône passait par une
  balise img dont la source moz-extension:// restait vide dans la fenêtre
  de composition ; elle est désormais posée en image de fond par la feuille
  de style.
- Thunderbird : le badge disparaissait quand le corps du message était vidé
  (sélection totale puis suppression, annulation, brouillon rechargé). Le
  badge, les popups et les notifications vivent maintenant dans un
  conteneur accroché à la racine du document, hors du corps éditable, et un
  observateur reconstruit le badge s'il disparaît malgré tout.
- Soulignements et remplacements décalés de plusieurs dizaines de
  caractères sur les longues réponses avec citation. La table de
  correspondance entre le texte analysé et les nœuds du document comptait
  les retours à la ligne de mise en forme du HTML sérialisé, que le rendu
  ignore. Elle est désormais mesurée sur le texte réel, plus rien n'est
  supposé.
- Thunderbird : l'erreur "Index or size is negative..." interrompait tout
  le rendu des soulignements quand deux corrections se chevauchaient, et le
  clic sur le badge semblait sans effet.
- Thunderbird : un remplacement dont la position ne couvre plus exactement
  le mot erroné est refusé avec un message, au lieu d'écrire au mauvais
  endroit.
- Firefox : sur x.com, la suggestion cliquée s'insérait en fin de texte au
  lieu de remplacer le mot. Les éditeurs à modèle interne (Draft.js)
  synchronisent leur curseur après coup : l'insertion attend cette
  synchronisation et vérifie que la sélection couvre bien le mot.
- Configuration : les modèles de reconnaissance de texte dans l'image
  (OCR), inutilisables pour la correction, n'apparaissent plus dans la
  liste des modèles.

## [0.6.0] - 2026-08-05

### Corrigé
- Les vérifications s'arrêtaient dès qu'une correction était affichée : la
  migration des offsets écrasait le repère qui sert à éviter les requêtes en
  double, si bien que plus aucune analyse ne partait tant que le champ n'était
  pas vidé. C'est la cause principale du symptôme « ça marche, puis ça ne
  marche plus ».
- Les appels à l'API ont désormais un délai maximal de 30 secondes. Sans lui,
  une requête acceptée mais jamais servie laissait le badge en chargement
  pendant plusieurs minutes.
- Thunderbird : les popups, notifications et annonces destinées aux lecteurs
  d'écran sont retirées du corps du message avant l'envoi. Un envoi effectué
  pendant qu'une popup était ouverte expédiait son contenu au destinataire.
- Thunderbird : après application d'une suggestion, le mot corrigé restait
  souligné en rouge et la navigation entre erreurs ne répondait plus.
- La reformulation passe par la chaîne d'événements attendue par les éditeurs
  riches (Draft.js, Lexical, CKEditor, ProseMirror). La modification directe du
  document laissait ces éditeurs désynchronisés, et le texte d'origine
  réapparaissait au rendu suivant.
- Les positions des soulignements sont recalculées selon le comportement réel
  du moteur de rendu, mesuré plutôt que supposé : un paragraphe insère deux
  sauts de ligne et non un. Sur un long courriel, l'écart accumulé faisait
  disparaître les soulignements des derniers paragraphes.
- Traduction dans Thunderbird : la sélection est transmise avec la demande, car
  la fermeture du menu contextuel l'annulait parfois avant lecture.
- L'injection dans les fenêtres de composition attend la fin du chargement au
  lieu d'un délai fixe, trop court pour une réponse à un courriel volumineux.
- Le bouton « Copier » de la traduction signale un échec au lieu d'annoncer une
  copie qui n'a pas eu lieu.
- Le pluriel de « lieu » est de nouveau « lieux ».
- Les soulignements couvrent les mots à cheval sur plusieurs balises, par
  exemple une portion en gras ou dans un lien.

### Modifié
- Les exemples des prompts envoyés au modèle contenaient des positions et des
  longueurs fausses, ainsi qu'une règle sur « tout » adverbe que son propre
  exemple contredisait. Ces exemples servent de référence au modèle : les
  corriger améliore directement la qualité des suggestions.
- Code partagé entre les trois cibles au lieu d'être dupliqué : notifications,
  piège de focus, routage des messages, styles du badge, noms des langues et
  calcul des positions.
- Préférence de langue de traduction commune à Firefox et Thunderbird. La
  valeur enregistrée sous l'ancien nom est reprise automatiquement.

### Ajouté
- Thunderbird : permission d'écriture dans le presse-papiers, nécessaire au
  bouton « Copier » de la popup de traduction. La mise à jour demandera votre
  accord.

## [0.5.2] - 2026-06-25

### Corrigé
- Enregistrement de la clé API : le bouton "Enregistrer" refusait de
  sauvegarder la nouvelle clé tant qu'aucun modèle n'était sélectionné, or la
  liste des modèles ne pouvait pas se charger avec une clé expirée. L'ancienne
  clé restait alors active et les corrections continuaient d'échouer. Le bouton
  recharge désormais les modèles avec la clé saisie avant de renoncer.
- Messages d'erreur plus clairs en cas de clé invalide ou non autorisée
  (codes 401 et 403) : un message invite à vérifier la clé au lieu du message
  générique.

## [0.5.1] - 2026-06-17

### Corrigé
- Soulignement des erreurs dans les champs de saisie mono-ligne
  (`<input type="text">`) : sur un texte long qui défile horizontalement, le
  soulignement était mal positionné. L'alignement et la synchronisation du
  défilement sont rétablis.

## [0.5.0] - 2026-06-11

### Ajouté
- Bloc "Soutenir le développement" dans le popup de configuration : QR code
  PayPal et texte d'invitation au don, sur le modèle de l'extension Edepp.
- La mise à jour automatique de l'extension est différée jusqu'au prochain
  démarrage du navigateur (`service-update.js`, chargé sur les trois
  cibles). Sans ce report, le navigateur appliquait la mise à jour à
  chaud : les scripts de contenu des pages ouvertes devenaient orphelins
  et les boutons Albert restaient inertes jusqu'au rechargement manuel
  de chaque page.

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
