# Plan des corrections, analyse complète du code (5 août 2026)

Analyse croisée de `sources-commun/`, `sources-firefox/` et `sources-thunderbird/`,
avec comparaison au mécanisme de remplacement de LanguageTool (voir `ANALYSE.md`
dans le coffre Obsidian et la copie de l'extension installée dans `languagetool-last/`).

Les 18 suites de tests existantes passent (257 tests OK) : les bugs se situent
dans ce que les tests ne couvrent pas, c'est-à-dire le DOM, l'injection des
scripts et le timing. Chaque bloquant ci-dessous a été vérifié dans le code
source avant d'être retenu.

## Phase 1, bloquants (expliquent le "ne fonctionne pas toujours")

### 1.1 Firefox : la vérification s'arrête après la première correction affichée

- Fichier : `sources-firefox/demarrage/albert-main.js:106`
- Le handler `input` écrit `st.lastCheckedText = newText` lors de la migration
  des offsets. Or `triggerCheck` (`albert-check.js:90`) et `cycleCheckAll`
  (`albert-check.js:256`) utilisent exactement ce champ comme garde de
  déduplication : dès qu'une correction est affichée et que l'utilisateur tape,
  plus aucun appel API ne part, quelle que soit la durée d'attente.
- Correction : supprimer la ligne 106 (`st.lastCheckedText = newText;`), en
  conservant `st.checkedText = newText`. Seul `triggerCheck` doit mettre à jour
  `lastCheckedText`, après un retour API réussi.
- C'est très probablement la cause principale du symptôme signalé.

### 1.2 Commun : aucun timeout sur les fetch, badge bloqué en chargement

- Fichier : `sources-commun/service/service-api.js:71` et `:227`
- Les deux `fetch()` (correction et traduction) ne passent aucun `signal`. Si
  l'API Albert accepte la connexion mais ne répond pas, la promesse ne se
  résout jamais : le badge reste en `albert-loading` pendant plusieurs minutes
  et les requêtes suivantes s'empilent en consommant du quota.
- Correction : ajouter `signal: AbortSignal.timeout(30000)` aux deux appels et
  traiter `TimeoutError` dans le `catch` en retournant
  `{ error: "Délai dépassé" }`.

### 1.3 Thunderbird : la popup et le toast partent dans le mail envoyé

- Fichier : `sources-thunderbird/service/service-compose-cleanup.js:43-52`
- `nettoyerCorpsHtml` retire `.albert-badge` et `span.albert-error`, mais pas
  `.albert-popup`, `.albert-toast` ni la zone aria-live, tous insérés dans le
  `document.body` de la fenêtre de composition (vérifié pour le toast,
  `compose-toast.js:39`). Si l'utilisateur envoie le mail pendant qu'une popup
  ou un toast est affiché, le destinataire reçoit ce HTML dans le message.
- Correction : ajouter au nettoyage
  `doc.querySelectorAll(".albert-popup, .albert-toast, .albert-aria-live").forEach((n) => n.remove());`

### 1.4 Thunderbird : soulignement fantôme et navigation cassée après une correction

- Fichier : `sources-thunderbird/compose/compose-apply.js:40-95` et
  `compose-popup-correction.js:192-207`
- Après `applySuggestion`, le span `albert-error` reste dans le DOM autour du
  mot corrigé (l'événement `input` déclenché par `execCommand` est ignoré car
  `Albert.applyingCorrection` est encore vrai, et le fallback DOM ne déclenche
  aucun événement). Le mot corrigé reste souligné en rouge. Même racine pour la
  navigation "Suivant/Précédent" : les attributs `data-correction-index` ne
  sont jamais réattribués, donc les index deviennent non contigus et les
  boutons ne font plus rien.
- Correction : en fin de `applySuggestion`, refaire ce que fait Firefox, à
  savoir `clearUnderlines()` puis `applyUnderlines(corrections)` puis
  `scheduleCheck()` différé.

### 1.5 Firefox : la reformulation corrompt les éditeurs riches

- Fichier : `sources-firefox/popup-contenu/albert-popup-reformulation.js:147-154`
- `applyReformulation` fait `range.deleteContents()` +
  `range.insertNode(...)` en manipulation DOM directe, sans dispatcher
  `beforeinput` ni `input`. Draft.js, Lexical, CKEditor et ProseMirror
  maintiennent un modèle interne : au prochain rendu, ils restaurent l'ancien
  texte ou produisent un contenu mélangé. C'est exactement le mécanisme que
  documente `ANALYSE.md` sur LanguageTool (sélection, événements simulés,
  `beforeinput`, `execCommand`, paste simulé).
- Correction : router le remplacement par le même chemin que
  `applyViaSelection` / `_insertTextInEditor` (déjà présents dans
  `albert-apply-rich.js`), en distinguant le type de champ comme le fait
  `_applyInContentEditable`.

## Phase 2, majeurs Firefox

### 2.1 `albert-apply-rich.js`, trois défauts liés dans la séquence d'insertion

- Ligne 155 : `_muteEvents(el)` est appelé avant le `setTimeout(30)`, donc tous
  les clics de l'utilisateur sur la page sont avalés pendant l'attente.
  Déplacer le muting à l'intérieur du `setTimeout`, juste avant l'insertion.
- Lignes 168-188 : si la reconstruction de la sélection échoue (`freshStart` ou
  `freshEnd` nul, cas fréquent sur Lexical et WhatsApp Web),
  `_insertTextInEditor` est quand même appelé et insère le texte à la position
  courante du curseur. Ajouter `if (!freshStart || !freshEnd) return;`.
- `applyViaSelection` retourne `true` de manière synchrone alors que
  l'insertion se fait 30 ms plus tard : `_updateRemainingCorrections` et
  `renderCorrections` (`albert-apply.js:129-164`) tournent sur l'état d'avant
  la modification. Faire retourner une promesse résolue dans le `setTimeout`
  et attendre cette promesse dans `applySuggestion` (à rendre async).

### 2.2 Overlays et badges orphelins sur les SPA

- Fichier : `sources-firefox/verification/albert-check.js:232-236`
- Quand un champ disparaît du DOM (modale fermée, navigation SPA),
  `cycleCheckAll` le retire de `trackedFields` sans supprimer l'overlay ni le
  badge, qui restent visibles dans la page. Appeler `clearCorrections(el)` et
  `state.badge.remove()` avant `trackedFields.delete(el)`.

### 2.3 Rescan complet à chaque frappe à cause du MutationObserver

- Fichier : `sources-firefox/demarrage/albert-main.js:162-178`
- Les nœuds texte créés par la reconstruction de l'overlay échouent au filtre
  `isAlbertOnly` (qui ne teste que `className` sur les éléments), donc chaque
  re-rendu programme un `scanFields` 500 ms plus tard, en continu pendant la
  saisie. Faire passer le filtre aux nœuds texte dont le parent est un élément
  `albert-*` (ou ignorer les mutations dont la cible est dans
  `.albert-overlay`).

### 2.4 Overlay désaligné quand le champ change de taille

- Fichier : `sources-firefox/affichage/albert-render-overlay.js`
- La géométrie de l'overlay n'est calculée qu'au rendu. Un textarea
  auto-extensible (GitHub, LinkedIn) ou un redimensionnement de fenêtre
  désaligne les soulignements. Ajouter un `ResizeObserver` sur le champ qui
  redéclenche `renderCorrections(el)`, avec nettoyage à la suppression du
  champ (voir 2.2).

### 2.5 Offsets faux avec paragraphes vides dans les éditeurs riches

- Fichier : `sources-firefox/correction/albert-apply-segments.js:59-65`
- Pour `<p><br></p><p>texte</p>` (structure courante dans CKEditor),
  `buildInnerTextSegments` compte deux `\n` là où `innerText` de Firefox n'en
  produit qu'un : tous les offsets suivants sont décalés de 1 par paragraphe
  vide. Aligner l'heuristique sur le comportement réel de Gecko et ajouter un
  cas de test dans `tests/` avec cette structure.

### 2.6 Éditeurs en iframe (CKEditor 4, TinyMCE) traités comme contenteditable simples

- Fichier : `sources-firefox/etat/albert-fields.js`
- Dans une iframe d'éditeur, le content script (injecté grâce à
  `all_frames: true`) voit un `<body contenteditable>` sans aucun des marqueurs
  testés par `isRichEditor` : le remplacement passe alors par le chemin
  "simple" qui corrompt le modèle de l'éditeur. Détecter le cas
  `window.top !== window` avec body éditable et le router vers
  `applyViaSelection`.

## Phase 3, majeurs communs et Thunderbird

### 3.1 Commun : requêtes concurrentes pour un même champ

- Fichier : `sources-firefox/verification/albert-check.js:93-140` (idem côté
  Thunderbird)
- L'`AbortController` est créé après `await loadLimits()` : deux
  `triggerCheck` peuvent se croiser pendant cette attente et lancer deux
  appels API, avec écrasement croisé du badge et double consommation de quota.
  Poser un verrou par champ (`state.triggerInProgress`) en entrée de
  `triggerCheck`, avant le premier `await`.

### 3.2 Commun : `loadPromptTemplate` ne vérifie pas `response.ok`

- Fichier : `sources-commun/service/service-prompts.js:38-44`
- Un fichier de prompt absent ou renommé produit un prompt vide mis en cache,
  donc des réponses absurdes sans aucune erreur visible. Ajouter
  `if (!response.ok) throw new Error(...)` avant la mise en cache.

### 3.3 Commun : règle locale fautive, "lieu" classé en exception

- Fichier : `sources-commun/verification/regles-locales.js:89`
- `EXCEPTIONS_EU_EUX` contient `"lieu"`, ce qui fait suggérer "lieus" au lieu
  de "lieux". Retirer `"lieu"` de l'ensemble et ajouter un cas de test.

### 3.4 Firefox : reformulation appliquée à la mauvaise occurrence

- Fichier : `sources-firefox/popup-contenu/albert-popup-reformulation.js:137-143`
- `el.value.indexOf(originalText, saved.start - 10)` peut cibler une occurrence
  antérieure quand le même texte se répète ("Cordialement"). Utiliser
  `saved.start` / `saved.end` directement et ne garder `indexOf` qu'en repli.

### 3.5 Thunderbird : résultat de reformulation perdu sans aucun message

- Fichier : `sources-thunderbird/service/service-menus.js:63-70`
- Les deux `browser.tabs.sendMessage` sont sans `.catch()` (la version Firefox
  en a un) : si l'injection des compose scripts a échoué, l'appel API est fait
  mais le résultat disparaît silencieusement. Ajouter les `.catch()` avec
  journalisation.

### 3.6 Thunderbird : sélection perdue entre le clic droit et la traduction

- Fichier : `sources-thunderbird/compose/compose-popup-messages.js:28-32`
- La sélection est lue à la réception du message, après la fermeture du menu
  contextuel qui peut l'avoir réduite à néant : la popup ne s'ouvre pas, sans
  retour utilisateur. Reprendre le mécanisme Firefox de sauvegarde de la
  sélection sur l'événement `contextmenu` (`albert-popup-common.js:118-147`)
  dans `compose-popup-utils.js`.

### 3.7 Thunderbird : injection des compose scripts au timeout fixe de 500 ms

- Fichier : `sources-thunderbird/service/service-compose-scripts.js:81-86`
- `setTimeout(..., 500)` après `tabs.onCreated` est insuffisant pour une
  réponse à un mail lourd : l'injection tombe sur un document incomplet et la
  vérification initiale est sautée. Remplacer par `tabs.onUpdated` filtré sur
  `changeInfo.status === "complete"` et `tab.type === "messageCompose"`, avec
  un ensemble `injectedTabs` contre la double injection.

### 3.8 Thunderbird : offsets décalés sur les mails multi-paragraphes

- Fichier : `sources-thunderbird/compose/compose-overlay.js:53-82`
- `buildTextNodeMap` ajoute un seul `\n` par bloc alors que `innerText` (la
  référence des offsets envoyés à l'API) en insère deux entre `<p>`
  consécutifs : dérive d'un caractère par transition, compensée par la fenêtre
  de ±10 de `findRealOffset` jusqu'à une dizaine de paragraphes, puis les
  erreurs des derniers paragraphes ne sont plus soulignées. Aligner le calcul
  sur `body.innerText` (même chantier que 2.5, à factoriser si possible).

### 3.9 Thunderbird : soulignement tronqué quand un mot chevauche une balise

- Fichier : `sources-thunderbird/compose/compose-overlay.js:100-113`
- Le Range est confiné à un seul nœud texte (`localEnd` est borné à la
  longueur du nœud) : contrairement à un premier diagnostic, `surroundContents`
  ne peut pas lever d'exception ici, mais un mot à cheval sur `<strong>` ou un
  lien n'est souligné que partiellement et le clic sur la partie manquante ne
  fait rien. Gérer le cas multi-nœuds (plusieurs spans pour une même
  correction) ou, au minimum, souligner sur le premier nœud et accepter la
  troncature documentée.

## Phase 4, mineurs

- `albert-apply-rich.js:97-118` : retirer les blocs de diagnostic
  `console.log` marqués "temporaire".
- `albert-popup-correction.js:135` : `ignoreWord` doit utiliser
  `correction.word` plutôt que de re-extraire le mot par offset.
- `albert-limites.js:36` : distinguer "limites jamais chargées" de "limites
  nulles" (`Albert.limits === undefined`) pour éviter un aller-retour
  `getLimits` à chaque vérification quand la clé API n'est pas configurée.
- `compose-popup-traduction.js:94` : ajouter la permission `clipboardWrite` au
  manifest Thunderbird et un `.catch()` sur `navigator.clipboard.writeText`,
  sinon le bouton affiche "Copié !" à tort.
- `compose-toast.js` / `albert-toast.js` : unifier l'unité de durée
  (millisecondes des deux côtés), aujourd'hui secondes côté Firefox et
  millisecondes côté Thunderbird.
- `compose-popup-utils.js` et les deux popups : centraliser la fermeture par
  Échap dans un seul listener, comme le fait `albert-popup-common.js`.
- `service-config.js:32` et `popup.js:26` : une seule source pour
  `DEFAULT_API_BASE`.
- `albert-check.js:128` : supprimer `modOffsetInSend`, calculé mais jamais lu.

## Ordre d'exécution proposé

1. Phase 1 en premier : 1.1 et 1.3 sont des corrections d'une à trois lignes
   pour un gain immédiat, 1.2 et 1.4 restent courtes, 1.5 réutilise du code
   existant.
2. Phase 2 ensuite (fiabilité Firefox au quotidien), en factorisant 2.5 avec
   3.8 qui traitent le même défaut de calcul d'offsets des deux côtés.
3. Phase 3 puis phase 4.
4. Après chaque lot : `bash tests/run-all.sh`, reconstruction des deux XPI
   (`build-firefox.sh`, `build-thunderbird.sh`) et test manuel dans Firefox et
   Thunderbird. Ajouter des tests de régression pour 1.1 (garde
   `lastCheckedText`), 2.5 et 3.8 (paragraphes vides et doubles `\n`) et 3.3
   ("lieux").
