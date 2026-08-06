# Plan : revoir la stratégie de correction dans Thunderbird (6 août 2026)

Plan d'exécution rédigé après la séance de débogage du 6 août.
Il traite les deux bugs ouverts (décalage des corrections, clic sur le badge)
et fixe la stratégie à suivre, éclairée par la lecture du code de l'extension
de correction tierce décompressée dans le coffre Obsidian
(`informatique/projets/albert-correcteur/languagetool-8.11.2-tb/`, dossier à
renommer ou supprimer après usage, il porte le nom du produit).

## 1. État des lieux

### Acquis de la séance du 6 août (déjà en place, ne pas refaire)

- `window.Albert = Albert` dans `compose-state.js` : les modules partagés
  (`util/inner-text.js`, `util/lang-names.js`) s'accrochent au même objet que
  les compose scripts.
- Interface hors du corps du message : badge, popups, toasts et zone
  aria-live vivent dans `<albert-ui>` accroché à `<html>`
  (`sources-commun/util/ui-root.js`). Fin du cadre de l'éditeur autour du
  badge, fin du badge emporté par une sélection totale, nettoyage avant envoi
  réduit aux seuls soulignements.
- Icône du badge en image de fond CSS (`sources-thunderbird/css/badge.css`) :
  une `<img>` vers `moz-extension://` restait vide dans le compose.
- Filet `Albert.watchBadge()` (MutationObserver) qui reconstruit le badge
  s'il disparaît.
- Injection : retour à `tabs.executeScript` piloté par `tabs.onUpdated`.
  L'essai `browser.composeScripts.register()` a rendu l'extension muette chez
  l'utilisateur alors que l'API existe dans le omni.ja de Thunderbird 153 et
  que l'appel respecte le schéma. Cause non identifiée, ne pas retenter sans
  la console d'erreurs sous les yeux.
- Repli par offset de `compose-apply.js` : passe par
  `Albert.buildInnerTextSegments()` au lieu d'un cumul naïf des longueurs de
  nœuds.
- `navigateError()` transmet l'index de correction au popup ; le retrait
  d'une correction appliquée se fait par index et non par identité d'objet.
- Suggestion vide : remplacement direct par le DOM, `execCommand` "réussit"
  sans rien faire sur Gecko dans ce cas.
- Vérifié sans objet ici : la version Firefox fonctionne bien, ne pas y
  toucher dans ce plan (sauf déplacement de code partagé, phase B).

### Bug 1 : corrections décalées dans le texte

Reproduit hors Thunderbird, diagnostic certain. Banc d'essai :
`scratchpad/xpi-test/test-segments.html` lancé dans Firefox headless avec un
profil jetable (`firefox --headless --profile ... --screenshot`), sur un DOM
imitant un courriel (div, br, blockquote, nœuds texte de mise en forme).

Résultat mesuré : `innerText` réel de 346 caractères, table de segments qui
se termine à 379, dérive dès le premier segment. La cause : le HTML d'un
compose (réponse, brouillon rechargé) contient des nœuds texte de pure mise
en forme entre les blocs (retours à la ligne d'indentation du HTML
sérialisé). `innerText` les ignore (blancs effondrés par le CSS), mais
`construireSegmentsInnerText()` dans `sources-commun/util/inner-text.js`
compte tout nœud texte non vide. Chaque nœud de mise en forme décale la
table d'un ou plusieurs caractères ; sur un long courriel la dérive atteint
des dizaines de caractères (66 constatés sur la capture de 14 h 15).

Conséquence en chaîne : `findRealOffset()` trouve le bon offset dans
`innerText`, mais la table convertit cet offset vers le mauvais nœud, donc
soulignement décalé, et remplacement décalé pour toute correction sans span
(le chemin `navigateError` est corrigé, mais le repli reste utilisé après
édition du texte).

### Bug 2 : le clic sur le badge ne fait rien

Non reproduit : sur le banc d'essai headless (page en `designMode`, vrais
scripts, vraies CSS), le badge reçoit `mousedown`, `click`, l'animation
tourne, `elementFromPoint` au centre du badge renvoie bien le badge. Le
mécanisme est donc sain en Gecko nu ; la panne est propre à l'environnement
compose de Thunderbird et le diagnostic demande la console d'erreurs
(Ctrl+Maj+J) pendant un clic. À instrumenter avant de corriger, ne rien
réécrire à l'aveugle.

Suspects, du plus au moins probable :

1. `triggerManualCheck` s'exécute mais sort sans effet visible :
   `requestCheck` retourne au premier garde-fou (`state.checkedText`
   identique, rate-limit local, texte trop court) et le seul signal est un
   toast ; si le toast échoue, le clic semble mort. Vérifiable en une ligne
   de log.
2. Exception dans `showToast` ou `uiRoot` dans le contexte compose (le corps
   du test n'est pas un vrai compose Thunderbird).
3. Le `MutationObserver` de `watchBadge` reconstruit le badge pendant le
   clic (Thunderbird réécrit le DOM à l'ouverture), l'élément cliqué n'est
   plus celui qui porte l'écouteur.
4. Interférence du `preventDefault` sur `mousedown` avec la gestion des
   clics de l'éditeur compose (peu probable, fonctionne en designMode nu).

## 2. Ce que l'extension tierce apporte sur ces deux points

Sa classe centrale d'accès au texte éclaire directement le bug 1 :

- Elle ne lit jamais `innerText`. Elle construit elle-même le texte soumis
  au serveur en parcourant le DOM : une liste `textChunks` où chaque entrée
  garde le nœud, son texte brut (`rawText`), sa projection dans le texte
  soumis (`parsedText`) et l'offset cumulé (`parsedTextOffset`). La
  correspondance offset -> nœud est exacte par construction, il n'y a rien à
  deviner.
- La conversion fine passe par `_offsetInRawText(raw, parsed, offset)` : un
  alignement à deux curseurs, caractère par caractère, où seuls les blancs
  peuvent être sautés d'un côté ou de l'autre. C'est robuste face à tous les
  effondrements de blancs, sans émuler la spécification.
- Les offsets renvoyés par leur serveur sont fiables (calcul exact sur le
  texte soumis). Les nôtres viennent d'un LLM et sont souvent faux de
  quelques caractères : le recalage local (`recalibrateOffsets`) est donc
  pour nous obligatoire, pas optionnel. Il existe côté Firefox
  (`sources-firefox/etat/albert-offsets.js`) et n'est pas appliqué côté
  Thunderbird : c'est un manque à combler.
- Pour le bug 2, rien de transposable directement : leur UI vit dans un
  shadow DOM hors du corps (nous y sommes déjà) et leurs remplacements
  passent par sélection + `execCommand` + événements simulés (nous y sommes
  pour l'essentiel).

Stratégie retenue : garder l'architecture actuelle (spans dans le texte,
UI hors du corps, injection `tabs.executeScript`), remplacer le seul maillon
faux, la table innerText <-> nœuds, par un alignement mesuré du même esprit
que le leur, et appliquer le recalage d'offsets aussi dans Thunderbird.
Basculer vers des soulignements géométriques (overlay) seulement si les
spans continuent de poser problème après cela (décision utilisateur du
6 août : "garder les spans mais basculer si cela ne fonctionne pas bien").

## 3. Exécution

### Phase A, corriger la table d'offsets (bug 1)

Exécutée le 6 août, contre-épreuve Gecko incluse (banc d'essai : 346/346,
zéro écart, mots sondés résolus jusque dans la citation). Détail :

1. Réécrire `construireSegmentsInnerText(racine)` dans
   `sources-commun/util/inner-text.js` : abandonner l'émulation de la
   spécification (SAUTS_PAR_BALISE, demandes de sauts, fusion des maximums)
   au profit d'un alignement mesuré :
   - parcourir les nœuds texte visibles (conserver `estMasque`) dans
     l'ordre du document ;
   - aligner la concaténation de leurs `textContent` sur `racine.innerText`
     avec deux curseurs : caractère identique, avancer les deux ; caractère
     de nœud blanc non apparié, avancer côté nœud ; caractère d'innerText
     blanc non apparié (sauts de ligne de blocs, blancs effondrés), avancer
     côté innerText ; désaccord sur deux non-blancs, s'arrêter là et
     journaliser, la table reste valable jusqu'au point d'arrêt ;
   - émettre un segment {node, start, end} par nœud dont au moins un
     caractère est rendu ; un nœud entièrement effondré n'émet rien.
   - traiter l'espace insécable comme un blanc au même titre que espace,
     tabulation et saut de ligne (les compose Thunderbird en sont truffés).
2. Garder la signature et le point d'accrochage `window.Albert
   .buildInnerTextSegments` : les appelants (Firefox comme Thunderbird) ne
   changent pas.
3. Tests : adapter `tests/test-inner-text-segments.js`. Le DOM minimal doit
   maintenant fournir aussi `innerText` (mesuré dans Firefox, valeurs déjà
   dans le fichier) au lieu de le déduire. Ajouter deux cas : nœuds texte de
   mise en forme entre des div (le bug), et blancs en tête/fin de nœud
   partiellement effondrés. Le banc d'essai
   `xpi-test/test-segments.html` sert de contre-épreuve dans un vrai Gecko :
   l'exécuter avant/après, l'écart doit passer de -8 à 0.
4. Nettoyage : la doc de tête d'inner-text.js décrit l'ancien algorithme,
   la réécrire.

### Phase B, recaler les offsets du LLM aussi dans Thunderbird

Constat en exécution (6 août) : les points 1 et 2 prévus (déplacer
`recalibrateOffsets` vers sources-commun et l'appliquer dans
`compose-check.js`) sont sans objet. `service-api.js` recalibre déjà les
offsets côté worker, pour toutes les cibles, avant de renvoyer les
corrections ; la doc de `albert-offsets.js` le dit expressément, le double
passage Firefox est un choix local (filtre hors-limites en plus). Un
troisième passage Thunderbird n'apporterait rien. Reste :

3. Durcir le repli par offset de `compose-apply.js` : après conversion
   offset -> nœud, vérifier que le texte à remplacer est bien
   `correction.word` ; sinon ne rien faire et afficher un toast "Le texte a
   changé, relancez la vérification", plutôt qu'un remplacement au mauvais
   endroit. Un remplacement raté est bien pire qu'un remplacement refusé.
   C'est le pendant du garde-fou déjà présent côté Firefox dans
   `_applyInSimpleContentEditable` (`range.toString() !== expectedWord`).

### Phase C, diagnostiquer puis corriger le clic badge (bug 2)

À faire avec l'utilisateur, l'environnement réel est indispensable.

1. Livrer une version instrumentée : un `Albert.log` en tête de
   `triggerManualCheck` (déjà présent), un dans le gestionnaire de clic du
   badge, un dans `showToast`, un dans le MutationObserver de `watchBadge`
   quand il reconstruit. Zéro changement de comportement.
2. Demander à l'utilisateur : ouvrir la console (Ctrl+Maj+J), cliquer le
   badge, coller les lignes `[Albert]` et les erreurs.
3. Selon le résultat :
   - aucun log de clic : le badge cliqué n'est pas le nôtre ou l'écouteur
     est perdu -> chercher du côté de watchBadge (reconstruction pendant
     l'ouverture) ; correctif probable : ne reconstruire que si le badge est
     absent depuis plus d'un cycle, ou réattacher via délégation sur
     `albert-ui` ;
   - log de clic mais sortie silencieuse de `requestCheck` : rendre le
     garde-fou parlant (toast systématique, y compris quand `checkedText`
     est identique) ;
   - exception : la corriger, elle dira tout.
4. Retirer l'instrumentation ajoutée si elle dépasse ce que les logs
   existants font déjà.

### Phase D, validation et livraison

1. `./tests/run-all.sh` (18 suites, 0 échec attendu, plus les cas neufs).
2. `./build-thunderbird.sh`, `./build-firefox.sh`, `./build-brave.sh` :
   la règle du dépôt impose la reconstruction après toute modification.
3. Essai utilisateur dans Thunderbird : fermer toutes les fenêtres de
   composition avant de réinstaller le .xpi (une fenêtre survivante garde
   des scripts morts), puis vérifier dans l'ordre : badge visible sans
   cadre, animation pendant la vérification, soulignements au bon endroit
   dans une réponse longue avec citation, clic sur une suggestion qui
   remplace le bon mot, clic badge qui relance, envoi d'un courriel sans
   résidu Albert.
4. Pas de commit sans instruction explicite de l'utilisateur.

## 4. Hors périmètre, décisions déjà prises

- Correcteur natif de Thunderbird : désactivé à la main par l'utilisateur,
  aucune API expérimentale à embarquer.
- Superposition géométrique des soulignements : seulement si les spans
  échouent encore après les phases A et B.
- `composeScripts.register()` : noté en `ponytail:` dans
  `service-compose-scripts.js`, à retenter uniquement avec la console sous
  les yeux.
- Filtrage des modèles hors sujet (OCR) : fait dans `popup-models.js`, sur
  le nom, en attendant une capacité par modèle côté API.
