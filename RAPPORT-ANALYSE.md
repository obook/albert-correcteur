# Rapport d'analyse complète du projet (5 août 2026)

Analyse menée en cinq passes sur l'intégralité du dépôt : revue de code des
fichiers récemment corrigés, revue de code du reste du projet, relecture
linguistique en deux volets (code et interface, prompts et documentation) et
audit de sur-ingénierie (ponytail). Les constats à fort impact ont été
revérifiés un par un dans le code avant d'être retenus ; les faux positifs
sont signalés en fin de rapport.

État de départ : les 20 suites de tests passent, les deux XPI se
construisent, les corrections de PLAN-CORRECTIONS.md sont appliquées.

---

## Synthèse

| Domaine | Constats retenus | Gravité maximale |
|---|---|---|
| Bugs fonctionnels réels | 3 | Majeur |
| Prompts (qualité d'apprentissage du modèle) | 4 | Majeur |
| Tests divergents de la production | 3 | Majeur |
| Chaîne de build et CI | 3 | Majeur |
| Code mort et duplications (ponytail) | 10 | Simplification (~260 lignes) |
| Langue et typographie | ~45 | Mineur |
| Documentation obsolète | 4 | Mineur |

Aucun constat bloquant : l'extension est fonctionnelle. Les travaux sont
classés en lots indépendants, exécutables dans l'ordre proposé.

---

## Liste de travaux

Chaque tâche indique les fichiers, l'action précise et le critère de
validation. Après chaque lot : `bash tests/run-all.sh`, puis
`./build-firefox.sh` et `./build-thunderbird.sh` doivent passer.

### LOT 1, bugs fonctionnels (à faire en premier)

**1.1 Divergence de constantes de debounce Thunderbird.**
`sources-thunderbird/compose/compose-limites.js:46` calcule
`Albert.DEBOUNCE_MAX = Albert.DEBOUNCE_SHORT * 2.5` sans plancher, alors que
Firefox garantit `Math.max(4000, DEBOUNCE_MS * 3)`. Pour un compte à rpm
élevé, Thunderbird retombe à 3750 ms.
Action : `Albert.DEBOUNCE_MAX = Math.max(4000, Albert.DEBOUNCE_SHORT * 2.5);`
Validation : relire les deux fichiers homologues côte à côte.

**1.2 Clés de storage différentes pour la même préférence.**
Firefox enregistre la dernière langue de traduction sous `lastTranslateLang`
(`albert-popup-traduction.js`), Thunderbird sous `lastTranslationLang`
(`compose-popup-traduction.js`, `message-traduction-popup.js`).
Action : harmoniser sur `lastTranslationLang` partout, en lisant l'ancienne
clé en repli une fois pour la migration.
Validation : grep, une seule clé subsiste (plus la lecture de migration).

**1.3 Message de quota sans type de limite.**
`sources-commun/service/service-rate-limit.js:70` : si `limitType` est vide
avec une limite journalière, le message devient "Quota  épuisé." (double
espace, type absent).
Action : libellé de repli, par exemple "Quota journalier épuisé." quand le
type est vide.
Validation : compléter `tests/test-parse-rate-limit-429.js` avec ce cas.

### LOT 2, prompts (dégradent directement la qualité des corrections)

Fichiers dans `sources-commun/prompts/`. Ces exemples servent de few-shot :
une erreur ici apprend au modèle à produire des résultats faux, notamment
les offsets que le code passe ensuite son temps à recalibrer.

**2.1 `correction.txt`, règle T2 sur "tout" adverbe.**
Lignes 128-131 et 307-308 : l'exemple "Elle est toute heureuse : correct"
contredit la règle énoncée ("heureuse" commence par un h muet, la forme
correcte est "tout heureuse", et la justification entre parenthèses est
fausse).
Action : réécrire la règle et son exemple avec un cas juste ("toute
contente" par exemple), corriger l'exemple final de la ligne 307.

**2.2 `correction.txt`, offsets faux dans les exemples.**
Ligne 263 : "ironisé" annoncé à l'offset 15, position réelle 14.
Ligne 278 : "gateau" annoncé à l'offset 22, position réelle 20.
Action : recompter et corriger chaque offset des exemples du fichier
(écrire un petit script jetable de vérification plutôt que compter à la
main).

**2.3 `reformulation.txt`, longueurs fausses.**
Ligne 39 : length 128 annoncé pour un texte de 133 caractères ; ligne 43 :
length 129 pour 126.
Action : même méthode que 2.2.

**2.4 `correction.txt`, exemples mal choisis et notation.**
"pomme-de-terre" s'écrit sans traits d'union : remplacer l'exemple de nom
composé (lignes 160-166) par un vrai composé ("chef-lieu"). "chef-d'oeuvre"
s'écrit "chef-d'œuvre". Uniformiser la notation des exemples sur une seule
flèche (le fichier mélange "→" et "->").
Validation du lot : `node tests/run-correction-corpus.sh` si utilisable,
sinon relecture croisée ; `tests/test-prompt-templates.js` doit passer.

### LOT 3, tests divergents et chaîne de build

**3.1 `tests/test-model-selection.js:5`** déclare
`RECOMMENDED_MODEL = "openweight-large"` alors que la production
(`popup-models.js:26`) recommande `"openweight-small"` depuis la v0.3.0. Le
libellé attendu utilise aussi un tiret cadratin que la production ne produit
pas. Vérifié : divergence réelle.
Action : aligner la constante et les assertions sur la production.

**3.2 `tests/test-parse-rate-limit-429.js:38-51`** : la copie de
`parseRateLimit429` omet les branches `isDailyLimit` de la production. Le
test "requests per day" attend 87 s là où la production calcule le délai
jusqu'à minuit UTC plafonné à 3600 s.
Action : copier la fonction complète (avec `secondsUntilNextUtcMidnight`
injectable) et corriger les attendus.

**3.3 `tests/test-daily-usage.js:29-30`** : le calcul testé ne somme que
`prompt_tokens`, la production somme aussi `completion_tokens`.
Action : aligner et ajouter des cas avec `completion_tokens`.

**3.4 `.gitlab-ci.yml:14-15`** : la boucle inline s'arrête au premier test
en échec, les suivants ne sont ni exécutés ni rapportés.
Action : remplacer la boucle par `bash tests/run-all.sh`.

**3.5 `build-firefox.sh`, `build-thunderbird.sh`** : pas de
`set -euo pipefail` ; un `cp` ou un `zip` en échec produirait un XPI
incomplet en silence.
Action : l'ajouter après le shebang dans les deux scripts.

**3.6 `tests/run-all.sh`** : `((TOTAL_PASS++))` renvoie 1 quand le compteur
vaut 0, ce qui interdit `set -e`.
Action : passer à `TOTAL_PASS=$((TOTAL_PASS + 1))` (idem FAIL), puis
ajouter `set -euo pipefail`.

### LOT 4, simplifications ponytail (~260 lignes en moins)

Suppressions vérifiées par grep (aucun appelant) :

**4.1** `sources-firefox/affichage/albert-render.js:75-125` :
`Albert.renderContentEditable`, 50 lignes jamais appelées
(`renderCorrections` délègue tout à l'overlay).

**4.2** Handlers `getConfig`, `getAliases`, `getDailyUsage` dans les deux
`service-menus.js` (Firefox lignes 121-136, Thunderbird lignes 112-127) :
aucun `sendMessage` ne les émet, la popup accède à l'API directement.
Environ 20 lignes. Mettre à jour la section correspondante
d'ARCHITECTURE.md (qui documente encore ces messages).

**4.3** `sources-thunderbird/compose/compose-utils.js:39-43` :
`Albert.escapeHtml`, jamais appelée (l'UI utilise `textContent`). Retirer
aussi sa mention de l'en-tête du fichier et de SECURITE.md.

Factorisations dans `sources-commun/` (pattern déjà établi par
`rolling-window.js` et `inner-text.js` ; ajouter chaque nouveau fichier aux
deux manifests ou à `COMPOSE_JS`) :

**4.4** Dispatcher `onMessage` : après 4.2, les trois handlers restants
(`check`, `getLimits`, `translate`) sont identiques des deux côtés.
Créer `sources-commun/service/service-dispatch.js`, environ 18 lignes
économisées. Attention : conserver les créations de menus spécifiques dans
chaque `service-menus.js`.

**4.5** Toast : `albert-toast.js` et `compose-toast.js` partagent ~40
lignes. Créer `sources-commun/notification/toast.js` avec un paramètre
d'icône optionnel. Les durées sont désormais en millisecondes des deux
côtés, la fusion est sûre.

**4.6** `trapFocus` : quasi identique entre `albert-popup-common.js` et
`compose-popup-utils.js`. Créer `sources-commun/util/popup-focus.js`,
environ 30 lignes économisées.

**4.7** `badge.css` : ~85 lignes identiques entre les deux fichiers. Créer
`sources-commun/css/badge-base.css` (états, animation radar), ne garder en
spécifique que le positionnement et, côté Firefox, `albert-api-error` et
`body.modal-open`.

**4.8** Noms de langues : la table `{ fr: "français", ... }` est écrite en
ligne à trois endroits. Créer `sources-commun/util/lang-names.js`.

**4.9** `sources-thunderbird/compose/compose-utils.js:19-25` :
`getComposeBody()` retourne `document.body` sans condition ; à supprimer et
remplacer chez ses 7 appelants (ou conserver si on juge l'indirection
documentaire, décision libre, gain faible).

**4.10** `sources-thunderbird/compose/compose-check.js:55-56` annule les
timers de `compose-debounce.js` par effet de bord. Exposer
`Albert.cancelDebounce()` dans compose-debounce.js et l'appeler.
Validation du lot : tests, builds, puis test manuel des deux extensions
(badge, toast, popups, menus contextuels).

### LOT 5, corrections de langue et de typographie

Conventions à appliquer uniformément (décisions actées) :
- graphie "événement" (orthographe traditionnelle) partout ;
- "courriel" plutôt que "mail" dans l'interface et les documents,
  "message" accepté quand le contexte suffit ;
- "popup" au féminin partout ;
- points de suspension : caractère "…" dans toutes les chaînes affichées à
  l'utilisateur (convention dominante du projet) ;
- espace avant les signes doubles ( : ; ! ? ) dans les chaînes affichées et
  les messages de log en français ;
- libellé du badge identique des deux côtés :
  "Albert Correcteur : cliquez pour vérifier".

Corrections ponctuelles (fichier:ligne, faute, correction) :

Accents et orthographe :
- `albert-popup-messages.js:39-41` : cinq mots désaccentués dans un warn
  ("selection sauvegardee", "L'evenement", "peut-etre", "ete", "capte") et
  un tiret cadratin `—` à remplacer par une virgule ;
- `tests/test-model-selection.js` et `tests/test-recalibrate-offsets.js` :
  commentaires et libellés presque entièrement désaccentués (~30 mots),
  tout réaccentuer ;
- `tests/test-daily-usage.js:151` : "Élements" en "Éléments" ;
- `tests/test-inner-text-segments.js:176,184` : "numero" en "numéro" ;
- `personas.js:79` : "comptes-rendus" en "comptes rendus" ;
- `ARCHITECTURE.md:34,74,426` : "noeud(s)" en "nœud(s)".

Grammaire :
- `compose-popup-reformulation.js:191` : "Sans ce restauration" en
  "Sans cette restauration" ;
- `regles-locales.js:102` : "Forme singulier supposée" en
  "Forme au singulier supposée" ;
- `inner-text.js:24-25` : "d'autant plus que le texte comptait de
  paragraphes" en "d'autant plus fortement que le texte comptait de
  paragraphes" ;
- `tests/test-find-real-offset.js:83` : "premier occurrence" en
  "première occurrence" ;
- `ARCHITECTURE.md:42` : "(rouge/bleue)" en "(rouge/bleu)".

Typographie et style :
- `albert-state.js:11-18` : tirets demi-cadratins de l'en-tête en tirets
  simples ;
- `compose-popup-traduction.js:82,125` et `message-traduction.html:87`,
  `message-traduction-popup.js:37` : "en cours..." en "en cours…" ;
- `albert-check.js:56,58` et `albert-fields.js:119-121` et
  `compose-apply.js:131` : remplacer les tirets de phrase par deux-points
  ou virgule ; "jamais focusé" en "n'a jamais reçu le focus" ;
- `service-limites.js:77,116,201`, `service-menus.js` (les deux), 
  `albert-badge.js:8` : espace avant les deux-points dans les messages
  français ;
- `service-api.js:166` : "Coercer" en "Convertir" ("coercition" en
  "conversion" dans `compose-popup-reformulation.js:92`) ;
- `regles-locales.js:40-41` : reformuler le commentaire familier
  ("pas matché car va colle ricelle") en registre professionnel ;
- `compose-check.js:29-30` : "Limite API approchée" en "Limite API presque
  atteinte" ;
- `popup-limits.js:13` et `tests/test-daily-usage.js:174-181` : "matcher",
  "match" en "correspondre", "ne correspond pas" ;
- `traduction.txt:13` : "mot-à-mot" en "mot à mot" ;
- `README.md` : ligne 9 (coordination bancale à réécrire), ligne 55
  ("Installations" en "Installation"), lignes 24-26 et 45-48 (sous-listes
  indentées d'une seule espace), points de suspension incohérents ;
- en-têtes de fichiers : noms de mois en minuscule ("avril 2026") ;
- `ACCESSIBILITE.md:56` : "Enter/Space/Escape" en "Entrée/Espace/Échap".

Style de code (référentiel code-quality) :
- `regles-locales.js:108-121` : commentaires `//` en `/* */` ;
- `service-api.js:188` : retirer le `|| []` mort (garanti tableau en
  amont) ;
- `service-limites.js:165-166` : if sans accolades à déplier ;
- `popup-settings.js` : ajouter `"use strict";` ;
- `compose-main.js:60` : remonter `let composing = false;` avant le
  premier `addEventListener` ;
- `compose-state.js:51-58` : `arguments` en paramètres rest `(...args)` ;
- `compose-apply.js:34` : supprimer la redéclaration de `const body`
  (déjà déclaré et vérifié ligne 24) ;
- `service-fallback.js:76` : `console.info` en `AlbertLog.log` ;
- `service-menus.js` Thunderbird : uniformiser les logs (préfixe et canal)
  avec la version Firefox ;
- `storage.local.set` sans `.catch()` dans les deux `service-menus.js` ;
- `service-compose-scripts.js:59,74` : `console.log` à aligner sur la
  convention de log du worker ;
- en-têtes complets (auteur, date, licence) à ajouter aux fichiers de
  `tests/` ;
- découpages suggérés (non prioritaires) : `popup-limits.js` (305 lignes,
  scinder `fetchAndShowLimits`), `albert-render-overlay.js`
  (`syncOverlayStyle` et `renderOverlay`), `compose-check.js`
  (`requestCheck`), `compose-popup-correction.js` (208 lignes) ;
- `compose-popup-reformulation.js:158-183` : factoriser le drag dans
  `compose-popup-utils.js` (symétrique de `initPopupDrag` Firefox).

### LOT 6, documentation à remettre à jour

- `tests/README.md` et `ARCHITECTURE.md:134` : "17 suites, 257 tests" est
  faux (20 fichiers de tests) ; mettre à jour les tableaux avec
  test-personas, test-pluriel et test-inner-text-segments ;
- `ARCHITECTURE.md` : tableau des prompts sans `correction-large.txt` ni le
  placeholder `{{PERSONA_TONE}}` ; sections sur les messages `getAliases` /
  `getDailyUsage` à réviser après le lot 4 ;
- `tests/test-structure.js:236` : titre de section "icônes SVG uniquement"
  alors que le test vérifie des PNG ;
- `tests/test-detect-language.js:5` : référence à `service/service.js`,
  fichier disparu (c'est `service-langue.js`).

---

## Constats écartés après vérification

- **"maxTimer jamais remis à null" (albert-debounce.js), annoncé
  bloquant : faux positif.** Le rappel du timer long appelle
  `Albert.triggerCheck(el)`, qui remet `state.timer` et `state.maxTimer` à
  null dès son entrée, avant tout await. Le mécanisme fonctionne. Le seul
  reproche valable est le couplage implicite ; un
  `state.maxTimer = null;` explicite en tête de rappel reste bienvenu par
  symétrie avec Thunderbird, mais ce n'est pas un bug.
- **`surroundContents` pouvant lever une exception (compose-overlay.js)**,
  écarté dès la première analyse : le Range est confiné à un seul nœud
  texte. Le vrai défaut (soulignement tronqué sur un mot chevauchant une
  balise) a déjà été corrigé.

## Points confirmés conformes (ne pas re-vérifier)

- Aucun `var` dans les sources.
- Ordre de chargement des scripts correct dans les deux manifests, y
  compris pour `inner-text.js` et `detachField`.
- `applyViaSelection` (promesse) correctement attendu par son unique
  appelant ; toutes les durées de toast en millisecondes.
- `popup.html` charge `model-aliases.js` avant les scripts qui utilisent
  `DEFAULT_API_BASE`.
- Messages runtime restants tous appariés émetteur/récepteur.
