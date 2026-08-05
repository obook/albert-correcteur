# Architecture du projet

## Organisation générale

Le projet est découpé en quatre répertoires de sources et trois scripts de build :

- **`sources-commun/`** - Code partagé entre toutes les cibles (service API, prompts, icônes, CSS communs, popup de configuration)
- **`sources-firefox/`** - Code spécifique à Firefox (content scripts, overlays, popups, badge CSS, manifest)
- **`sources-thunderbird/`** - Code spécifique à Thunderbird (compose scripts, badge CSS, popup traduction lecture, manifest)
- **`sources-brave/`** - Surcouche Brave/Chromium (manifest Manifest V3, service worker, shim `browser.*`). Les content scripts ne sont pas dupliqués : la cible Brave réutilise ceux de `sources-firefox/`, qui sont indépendants du navigateur.

Chaque script de build assemble le code partagé avec le code spécifique :

- **`build-firefox.sh`** - Copie `sources-commun/` + `sources-firefox/` dans un dossier temporaire, puis crée le `.xpi` Firefox
- **`build-thunderbird.sh`** - Copie `sources-commun/` + `sources-thunderbird/` dans un dossier temporaire, puis crée le `.xpi` Thunderbird
- **`build-brave.sh`** - Copie `sources-commun/` + `sources-firefox/` + `sources-brave/` (qui écrase le manifest), puis crée le `.zip` Brave

## Arborescence

```
albert-correcteur/
  sources-commun/                                <- Code partagé (toutes les cibles)
    service/                              <- Scripts de fond communs
      service-config.js                   <- Chargement de la configuration (clé, modèle, URL)
      service-langue.js                   <- Détection de langue locale (RGPD)
      service-prompts.js                  <- Chargement et construction des prompts
      service-limites.js                  <- Cache des limites du compte (/v1/me/info)
      service-api.js                      <- Appels API + parseRateLimit429 + auto-fallback de modèle
      service-dispatch.js                 <- Routage des messages reçus (check, translate, getLimits)

    verification/                         <- Logique partagée Firefox + Thunderbird
      rolling-window.js                   <- Classe Albert.RollingWindow (fenêtre glissante 60 s)

    util/                                 <- Utilitaires partagés
      model-aliases.js                    <- Table canonique -> alias, DEFAULT_API_BASE
      personas.js                         <- Personas de reformulation
      inner-text.js                       <- Correspondance offsets innerText <-> nœuds texte
      lang-names.js                       <- Noms affichables des langues (fr, en, es, de)
      popup-focus.js                      <- Piège de focus des popups (RGAA)

    notification/                         <- Messages temporaires
      toast.js                            <- Toast partagé (icône seulement si ICON_URL défini)

    prompts/                              <- Prompts éditables (fichiers texte)
      correction.txt                      <- Prompt Correcteur (medium et small)
      correction-large.txt                <- Prompt Correcteur compact (modèle large)
      reformulation.txt                   <- Prompt Reformuler ({{LANG}}, {{PERSONA_TONE}})
      traduction.txt                      <- Prompt Traduire ({{LANG_SOURCE}}, {{LANG_CIBLE}})

    icons/                                <- Icônes
      icon.svg                            <- SVG normal (rouge/bleu)
      icon-error.svg                      <- SVG erreurs (deux branches rouges)
      icon-48/96/128.png                  <- PNG pour le manifest (AMO)

    css/                                  <- Styles partagés
      badge-base.css                      <- Badge : états et animation, hors positionnement
      overlay.css                         <- Soulignements (spelling, grammar, style)
      popup-dark.css                      <- Popup thème sombre
      popup-light.css                     <- Popup thème clair
      toast.css                           <- Notification toast

    popup-configuration/                  <- Interface de configuration (partagée)
      popup.html / .css / .js             <- Formulaire (clé API, modèle, URL)
      popup-status.js                     <- Messages de statut
      popup-models.js                     <- Chargement des modèles
      popup-limits.js                     <- Limites du compte
      popup-settings.*                    <- Page paramètres (thème, dictionnaire)

  sources-firefox/                        <- Code spécifique Firefox
    manifest.json                         <- Manifeste Firefox (Manifest V2)

    etat/                                 <- État global et utilitaires
      albert-state.js                     <- Constantes, configuration, variables globales
      albert-utils.js                     <- Détection champs, éditeurs riches, dictionnaire

    verification/                         <- Appel API et gestion du rythme
      albert-limites.js                   <- Limites rpm/rpd, calcul debounce adaptatif
      albert-debounce.js                  <- Double debounce (timer court + timer max)
      albert-check.js                     <- triggerCheck, cycleCheckAll

    correction/                           <- Application des corrections dans le texte
      albert-apply.js                     <- Orchestration, findRealOffset, dispatch par type
      albert-apply-rich.js                <- Éditeurs riches : sélection, événements, fallback
      albert-apply-segments.js            <- Recherche d'un nœud texte par offset (findSegmentAt)

    affichage/                            <- Rendu visuel
      albert-badge.js                     <- Badge (icône dans le coin des champs, ARIA)
      albert-render-arialive.js           <- Zone aria-live, annonces, clearCorrections
      albert-render-overlay.js            <- Overlay transparent, scroll sync, soulignements
      albert-render.js                    <- Orchestration du rendu et du badge

    demarrage/                            <- Initialisation
      albert-main.js                      <- Scan des champs, MutationObserver, IME, paste

    service/                              <- Scripts de fond spécifiques Firefox
      service-menus.js                    <- Menus contextuels (le dispatch est partagé)

    popup-contenu/                        <- Popups injectées dans les pages web
      albert-popup-common.js              <- Thème, drag, close, positionnement
      albert-popup-correction.js          <- Popup de correction (suggestions, navigation)
      albert-popup-reformulation.js       <- Popup de reformulation
      albert-popup-traduction.js          <- Popup de traduction (sélecteur langue, copier)
      albert-popup-messages.js            <- Dispatch des messages du script de fond

    css/                                  <- Style spécifique Firefox
      badge.css                           <- Badge : positionnement absolu, panne API, modale Bootstrap

  sources-thunderbird/                    <- Code spécifique Thunderbird
    manifest.json                         <- Manifeste Thunderbird (Manifest V2, compose_scripts)

    compose/                              <- Scripts injectés dans la fenêtre de composition
      compose-state.js                    <- Constantes, état global
      compose-utils.js                    <- Utilitaires, détection du body compose
      compose-badge.js                    <- Badge (icône dans le coin de l'éditeur)
      compose-overlay.js                  <- Overlay transparent, soulignements
      compose-render.js                   <- Orchestration du rendu des corrections
      compose-popup-correction.js         <- Popup de correction (suggestions)
      compose-popup-reformulation.js      <- Popup de reformulation
      compose-popup-traduction.js         <- Popup de traduction
      compose-popup-messages.js           <- Dispatch des messages du script de fond
      compose-apply.js                    <- Application des corrections dans le texte
      compose-limites.js                  <- Limites rpm/rpd, calcul debounce adaptatif
      compose-debounce.js                 <- Double debounce (timer court + timer max)
      compose-check.js                    <- triggerCheck
      compose-main.js                     <- Initialisation, MutationObserver, événements

    service/                              <- Scripts de fond spécifiques Thunderbird
      service-menus.js                    <- Menus contextuels (compose + lecture) et dispatch
      service-compose-scripts.js          <- Injection des scripts dans les fenêtres de composition

    message/                              <- Popup de traduction pour la lecture de courriel
      message-traduction.html             <- Interface HTML de la popup de traduction
      message-traduction-popup.js         <- Logique de la popup (appel API, affichage)

    css/                                  <- Style spécifique Thunderbird
      badge.css                           <- Badge (positionnement fixe)

  sources-brave/                          <- Surcouche Brave / Chromium (Manifest V3)
    manifest.json                         <- Manifeste Brave (Manifest V3, action, host_permissions, web_accessible_resources)
    service/
      service-worker.js                   <- Point d'entrée du fond : importScripts() rejoue l'ordre des background.scripts MV2
    lib/
      browser-shim.js                     <- Alias maison : expose browser.* à partir de chrome.* (pas de dépendance externe)

  tests/                                  <- Tests unitaires (Node.js, sans dépendance)
    run-all.sh                            <- Lance toutes les suites
    test-*.js                             <- 20 suites, 301 tests

  exemple/                                <- Pages de test (à servir en HTTP, voir plus bas)
    test.html                             <- Page de test multilingue + éditeurs React
    test-react-editors.js                 <- Simulation re-rendu React (Draft.js/Lexical)
  media/                                  <- Captures d'écran pour le README
  images/                                 <- Logo PNG pour GitForge

  README.md                               <- Documentation principale
  ARCHITECTURE.md                         <- Ce fichier
  THUNDERBIRD.md                          <- Notes et bugs Thunderbird
  LICENSE                                 <- Licence MIT
  updates.json                            <- Manifeste de mise à jour Firefox + Thunderbird
  .gitlab-ci.yml                          <- Pipeline CI/CD (tests, build, sign, release)
  build-firefox.sh                        <- Script d'assemblage Firefox (.xpi)
  build-thunderbird.sh                    <- Script d'assemblage Thunderbird (.xpi)
  build-brave.sh                          <- Script d'assemblage Brave (.zip)
```

## Fonctionnement

### Vue d'ensemble

L'extension se compose de deux parties :

- **Script de fond** (`sources-commun/service/` + `sources-firefox/service/` ou `sources-thunderbird/service/`) - s'exécute en arrière-plan, communique avec l'API Albert, gère les menus contextuels (Reformuler, Traduire), la détection de langue et le cache des limites.
- **Content scripts Firefox** (`sources-firefox/` : `etat/`, `verification/`, `correction/`, `affichage/`, `notification/`, `demarrage/`, `popup-contenu/`) - injectés dans chaque page, détectent les champs texte, affichent les corrections, la reformulation et la traduction. La cible Brave réutilise ces mêmes content scripts.
- **Compose scripts Thunderbird** (`sources-thunderbird/compose/`) - injectés dans la fenêtre de composition de courriel, détectent le body de l'éditeur, affichent les corrections, la reformulation et la traduction.

### Spécificités de la cible Brave (Manifest V3)

Brave est basé sur Chromium et n'accepte que le Manifest V3. La cible Brave réutilise tel quel le code commun et les content scripts de Firefox ; seules trois choses changent, regroupées dans `sources-brave/` :

- **Service worker au lieu des background scripts.** Le Manifest V2 charge une liste de scripts de fond dans un scope global partagé ; le Manifest V3 n'autorise qu'un seul point d'entrée. Le fichier `service/service-worker.js` reproduit le comportement V2 avec `importScripts()`, qui rejoue les mêmes fichiers dans le même ordre et conserve le scope global partagé. Aucun refactor du code commun n'est donc nécessaire.
- **Shim `browser.*`.** Le code utilise partout l'API `browser.*` (standard, à base de promesses), que Chromium n'expose pas sous ce nom. Le fichier `lib/browser-shim.js` se contente de l'aliaser sur `chrome.*`, qui renvoie déjà des promesses sous Manifest V3 pour toutes les API employées. Pas de bibliothèque tierce. Il est chargé en premier, aussi bien dans le service worker que dans les content scripts.
- **`web_accessible_resources`.** Les icônes SVG du badge sont injectées dans la page via `runtime.getURL`. Sous Manifest V3, une ressource chargée dans le contexte de la page doit être déclarée dans `web_accessible_resources`, faute de quoi l'image est bloquée.

Le service worker est arrêté après quelques secondes d'inactivité, ce qui vide les caches en mémoire (limites, prompts). Ils sont simplement reconstruits à la demande, sans incidence sur le fonctionnement. Le contrôle du rythme local s'exécute côté content script, lié à la page, et n'est donc pas affecté.

### Scripts de fond (partagés)

Les 5 fichiers de `sources-commun/service/` sont communs aux deux extensions. Chaque extension y ajoute ses propres fichiers `service/` :

- Firefox : `service-menus.js` (menus contextuels page web)
- Thunderbird : `service-menus.js` (menus contextuels compose) + `service-compose-scripts.js` (gestion des compose scripts)

| Ordre | Module | Répertoire | Rôle |
|-------|--------|------------|------|
| 1 | `service-config.js` | `sources-commun/service/` | Chargement de la configuration |
| 2 | `service-langue.js` | `sources-commun/service/` | Détection de langue locale (RGPD) |
| 3 | `service-prompts.js` | `sources-commun/service/` | Chargement et construction des prompts |
| 4 | `service-limites.js` | `sources-commun/service/` | Cache et récupération des limites du compte |
| 5 | `service-api.js` | `sources-commun/service/` | Appels API (correction, reformulation, traduction) |
| 6 | `service-dispatch.js` | `sources-commun/service/` | Routage des messages (check, translate, getLimits) |
| 7 | `service-menus.js` | Spécifique | Menus contextuels |
| 8 | `service-compose-scripts.js` | Thunderbird seul | Gestion des compose scripts |

### Flux de correction (Firefox)

```
  Utilisateur tape du texte
         |
         v
  demarrage/albert-main.js (événement input)
         |
         v debounce adaptatif (calculé depuis le rpm du compte)
  verification/albert-debounce.js (scheduleCheck)
         |
         v
  verification/albert-limites.js (checkRateLimit)
         |
         v
  verification/albert-check.js (triggerCheck)
         |
         +-- Annule la requête précédente si le texte a changé
         |
         v
  service/service-api.js (checkText)
         |
         +-- service-langue.js : détecte la langue (FR/EN/ES/DE)
         +-- service-prompts.js : charge le prompt depuis prompts/correction.txt
         +-- Appelle l'API Albert /v1/chat/completions
         |
         v
  Réponse JSON : { corrections: [...] }
         |
         v
  verification/albert-check.js
         |
         +-- Filtre les mots du dictionnaire personnel
         |
         v
  affichage/albert-render.js (renderCorrections)
         |
         +-- tous les champs -> albert-render-overlay.js (overlay transparent)
         +-- albert-render-arialive.js : annonce pour les lecteurs d'écran
         |
         v
  Soulignements colorés (rouge/orange/bleu)
         |
         v clic sur un mot souligné
  popup-contenu/albert-popup-correction.js (showPopup)
         |
         +-- Affiche la popup (suggestions, navigation, modes)
         |
         v clic sur une suggestion
  correction/albert-apply.js (applySuggestion)
         |
         +-- textarea/input : albert-apply.js (_applyInTextarea)
         +-- éditeur riche : albert-apply-rich.js (applyViaSelection)
         +-- contenteditable simple : albert-apply.js (_applyInContentEditable)
         +-- Retire la correction, recalcule les offsets restants
         +-- Re-rend l'overlay
```

### Flux de correction (Thunderbird)

```
  Utilisateur tape du texte dans la fenêtre de composition
         |
         v
  compose/compose-main.js (événement input sur le body compose)
         |
         v debounce adaptatif (calculé depuis le rpm du compte)
  compose/compose-debounce.js (scheduleCheck)
         |
         v
  compose/compose-limites.js (checkRateLimit)
         |
         v
  compose/compose-check.js (triggerCheck)
         |
         +-- Annule la requête précédente si le texte a changé
         |
         v
  service/service-api.js (checkText) [code partagé]
         |
         +-- service-langue.js : détecte la langue
         +-- service-prompts.js : charge le prompt
         +-- Appelle l'API Albert /v1/chat/completions
         |
         v
  Réponse JSON : { corrections: [...] }
         |
         v
  compose/compose-render.js (renderCorrections)
         |
         +-- compose-overlay.js : overlay transparent sur le body compose
         |
         v
  Soulignements colorés (rouge/orange/bleu)
         |
         v clic sur un mot souligné
  compose/compose-popup-correction.js (showPopup)
         |
         v clic sur une suggestion
  compose/compose-apply.js (applySuggestion)
         |
         +-- Remplace le texte dans le body compose (contenteditable)
```

### Flux de reformulation (menu contextuel)

```
  Utilisateur sélectionne du texte dans un champ -> clic droit -> "Reformuler avec Albert"
         |
         v
  popup-contenu/albert-popup-common.js (sauvegarde la sélection)
         |
         v
  service/service-menus.js (contextMenus.onClicked)
         |
         +-- service-api.js : checkText(text, "reformulation")
         +-- Envoie le résultat au content script
         |
         v
  popup-contenu/albert-popup-messages.js -> albert-popup-reformulation.js
         |
         +-- Popup positionnée au clic droit
         |
         v clic sur une suggestion
  albert-popup-reformulation.js (applyReformulation)
         |
         +-- Remplace la sélection dans le champ
```

### Flux de traduction (menu contextuel)

```
  Utilisateur sélectionne du texte -> clic droit -> "Traduire avec Albert"
         |
         v
  popup-contenu/albert-popup-common.js (sauvegarde la sélection)
         |
         v
  service/service-menus.js (contextMenus.onClicked)
         |
         +-- Envoie "translateGetSelection" au content script
                |
                v
  popup-contenu/albert-popup-messages.js -> albert-popup-traduction.js
         |
         +-- Popup avec sélecteur de langue + bouton Traduire
         +-- Traduction automatique dans la dernière langue choisie
         |
         v
  albert-popup-traduction.js (doTranslate)
         |
         +-- Envoie { type: "translate", text, targetLang }
         |
         v
  service/service-api.js (translateText)
         |
         +-- service-langue.js : détecte la langue source
         +-- service-prompts.js : charge le prompt traduction
         +-- Appelle l'API Albert
         |
         v
  Réponse : { translation: "...", langSource }
         |
         v
  Popup affiche le résultat + "Langue source -> Langue cible"
         |
         +-- Bouton "Copier" -> presse-papiers
```

### Gestion des limites API

```
  Avant chaque requête
         |
         v
  verification/albert-limites.js (checkRateLimit)
         |
         +-- rpm : Albert.RollingWindow (fenêtre glissante 60 s, partagée Firefox + Thunderbird)
         +-- rpd : compteur journalier local
         +-- updateDebounceFromRpm : délais calculés depuis le rpm du compte
         +-- Throttle : si >80 % du quota, les délais doublent
         |
         v si limite atteinte
         |
         +-- showRateLimitWarning : toast + badges grisés
         +-- secondsUntilNextSlot() : temps précis avant le prochain slot
         |
         v si l'API retourne 429
         |
         +-- service-api.js : parseRateLimit429()
         |     +-- Lecture Retry-After dans l'en-tête HTTP
         |     +-- Lecture du champ retry_after dans le corps JSON
         |     +-- Calcul depuis le message texte ("Limit exceeded: N requests per minute")
         |     +-- Détection du type de limite (rpm/rpd/tpm/tpd)
         |
         +-- service-api.js : record429()
         |     +-- Compteur de 429 consécutifs par modèle
         |     +-- Au seuil de 2 : auto-fallback large -> medium -> small pendant 60 s
         |     +-- Reset du compteur sur succès (recordSuccess)
         |
         +-- Toast avec type de limite + délai à attendre
         +-- selectEffectiveModel() : retourne le modèle de fallback si actif
```

### Récupération des alias et de l'usage journalier

```
  popup-configuration/popup-limits.js (fetchAndShowLimits)
         |
         v
  service-limites.js (côté service worker)
         |
         +-- fetchLimits()       <- /v1/me/info  (cache 10 min)
         +-- fetchAliases()      <- /v1/models   (cache 10 min)
         |     +-- Map { alias serveur -> id canonique }
         +-- fetchDailyUsage()   <- /v1/me/usage (cache 30 s)
               +-- Filtre par modèle canonique (résolution alias en amont)
               +-- Somme requêtes et prompt_tokens depuis minuit UTC
         |
         v
  popup-configuration/popup-limits.js
         |
         +-- Affiche la limite du compte (rpm, rpd, tpm, tpd)
         +-- Affiche l'usage du jour (rpd_used / rpd_limit, tpd_used / tpd_limit)
         +-- Affiche la table DOCUMENTED_MODEL_LIMITS (paliers EXP / PROD documentés)
```

### Modules content script (Firefox)

Les content scripts partagent le namespace `window.Albert` et sont chargés dans cet ordre :

| Ordre | Module | Dossier | Rôle |
|-------|--------|---------|------|
| 1 | `albert-state.js` | `etat/` | Constantes, état global, URL des icônes |
| 2 | `albert-fields.js` | `etat/` | Détection des champs texte et des éditeurs riches |
| 3 | `albert-paragraphes.js` | `etat/` | Découpage en paragraphes (vérification incrémentale) |
| 4 | `albert-offsets.js` | `etat/` | Migration des offsets pendant la frappe |
| 5 | `albert-utils.js` | `etat/` | État par champ, dictionnaire personnel, utilitaires |
| 6 | `albert-badge.js` | `affichage/` | Création et positionnement du badge (ARIA) |
| 7 | `lang-names.js` | `util/ (commun)` | Noms affichables des langues |
| 8 | `albert-render-arialive.js` | `affichage/` | Zone aria-live, annonces, clearCorrections, detachField |
| 9 | `albert-render-overlay.js` | `affichage/` | Overlay transparent, synchronisation du défilement, soulignements |
| 10 | `albert-render.js` | `affichage/` | Orchestration du rendu et du badge |
| 11 | `popup-focus.js` | `util/ (commun)` | Piège de focus des popups (RGAA) |
| 12 | `albert-popup-common.js` | `popup-contenu/` | Thème, fermeture, sauvegarde de la sélection |
| 13 | `albert-popup-layout.js` | `popup-contenu/` | Positionnement, déplacement et en-tête des popups |
| 14 | `albert-popup-correction.js` | `popup-contenu/` | Popup de correction et navigation entre erreurs |
| 15 | `albert-popup-reformulation.js` | `popup-contenu/` | Popup de reformulation |
| 16 | `albert-popup-traduction.js` | `popup-contenu/` | Popup de traduction |
| 17 | `albert-popup-messages.js` | `popup-contenu/` | Dispatch des messages du script de fond |
| 18 | `inner-text.js` | `util/ (commun)` | Correspondance offsets innerText <-> nœuds texte |
| 19 | `albert-apply-segments.js` | `correction/` | Recherche d'un nœud texte par offset |
| 20 | `albert-apply-rich.js` | `correction/` | Éditeurs riches : sélection, événements, repli |
| 21 | `albert-apply.js` | `correction/` | Orchestration des corrections |
| 22 | `toast.js` | `notification/ (commun)` | Notification toast, partagée entre les cibles |
| 23 | `rolling-window.js` | `verification/ (commun)` | Classe `Albert.RollingWindow` (fenêtre glissante 60 s) |
| 24 | `albert-limites.js` | `verification/` | Limites rpm/rpd, debounce adaptatif |
| 25 | `albert-debounce.js` | `verification/` | Double debounce (timer court + timer long) |
| 26 | `albert-check.js` | `verification/` | triggerCheck, cycleCheckAll |
| 27 | `albert-main.js` | `demarrage/` | Scan des champs, MutationObserver, IME, collage |

### Compose scripts (Thunderbird)

Thunderbird injecte les scripts dans la fenêtre de composition via `tabs.executeScript` (géré par `service-compose-scripts.js`). Les scripts partagent le namespace `window.Albert` et sont chargés dans cet ordre :

| Ordre | Module | Rôle |
|-------|--------|------|
| 1 | `compose-state.js` | Constantes, état global, journalisation |
| 2 | `compose-utils.js` | Accès au corps du message, dictionnaire personnel, utilitaires |
| 3 | `inner-text.js` | Correspondance offsets innerText <-> nœuds texte (commun) |
| 4 | `lang-names.js` | Noms affichables des langues (commun) |
| 5 | `toast.js` | Notification toast, partagée entre les cibles (commun) |
| 6 | `compose-badge.js` | Badge (icône fixée dans le coin de l'éditeur) |
| 7 | `compose-overlay.js` | Soulignements insérés dans le corps du message |
| 8 | `compose-render.js` | Orchestration du rendu des corrections |
| 9 | `popup-focus.js` | Piège de focus des popups, RGAA (commun) |
| 10 | `compose-popup-utils.js` | Fermeture des popups, écouteurs globaux |
| 11 | `compose-popup-correction.js` | Popup de correction (suggestions) |
| 12 | `compose-popup-reformulation.js` | Popup de reformulation |
| 13 | `compose-popup-traduction.js` | Popup de traduction |
| 14 | `compose-popup-messages.js` | Dispatch des messages du script de fond |
| 15 | `compose-apply.js` | Application des corrections |
| 16 | `rolling-window.js` | Classe `Albert.RollingWindow`, fenêtre glissante 60 s (commun) |
| 17 | `compose-limites.js` | Limites rpm/rpd, debounce adaptatif |
| 18 | `compose-debounce.js` | Double debounce et annulation (cancelDebounce) |
| 19 | `compose-check.js` | requestCheck |
| 20 | `compose-main.js` | Initialisation, MutationObserver, événements |

### États du badge

Le badge n'apparaît qu'au premier focus sur un champ.

| Classe CSS | Icône | Signification |
|------------|-------|---------------|
| `albert-loading` | Normale en rotation | Vérification en cours |
| `albert-has-errors` | Deux branches rouges (`icon-error.svg`) | Erreurs trouvées |
| `albert-no-errors` | Normale rouge/bleue (`icon.svg`) | Aucune erreur |
| `albert-rate-limited` | Grisée | Limite API atteinte |

### Prompts

Les prompts sont des fichiers texte dans `sources-commun/prompts/`, éditables à la main :

| Fichier | Placeholders | Usage |
|---------|-------------|-------|
| `correction.txt` | `{{LANG}}` | Mode Correcteur (modèles medium et small : règles et exemples détaillés) |
| `correction-large.txt` | `{{LANG}}` | Mode Correcteur (modèle large : version compacte, économise des tokens) |
| `reformulation.txt` | `{{LANG}}`, `{{PERSONA_TONE}}` | Mode Reformuler, le ton dépendant du persona choisi |
| `traduction.txt` | `{{LANG_SOURCE}}`, `{{LANG_CIBLE}}` | Traduction |

### Assemblage des extensions

Les deux scripts de build suivent le même principe :

1. Créer un dossier temporaire
2. Copier le contenu de `sources-commun/` (code partagé)
3. Copier le contenu de `sources-firefox/` ou `sources-thunderbird/` par-dessus (code spécifique)
4. Créer le fichier `.xpi` (archive ZIP)

Les fichiers spécifiques peuvent surcharger les fichiers partagés si nécessaire (par exemple, chaque extension a son propre `service-menus.js`).

### Pages de test locales

Les pages de `exemple/` doivent être servies en HTTP, et non ouvertes
directement par un chemin de fichier :

```bash
cd exemple && python3 -m http.server 8765
# puis http://localhost:8765/test.html
```

Le manifeste déclare `<all_urls>`, ce qui ne garantit pas l'injection des
content scripts sur le protocole `file:` : selon la configuration de
Firefox et le mode d'installation de l'extension (chargement temporaire
via `about:debugging` ou XPI installé), la page locale peut rester sans
badge alors que l'extension fonctionne normalement ailleurs. Servir la
page en HTTP supprime cette variable et rend le test reproductible d'un
poste à l'autre.

Le badge n'apparaît qu'au premier focus dans un champ non vide : un
chargement de page sans clic ne l'affiche jamais, quel que soit le
protocole.
