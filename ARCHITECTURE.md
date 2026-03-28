# Architecture du projet

## Organisation générale

Le projet est découpé en trois répertoires de sources et deux scripts de build :

- **`sources/`** - Code partagé entre Firefox et Thunderbird (service API, prompts, icônes, CSS communs, popup de configuration)
- **`sources-firefox/`** - Code spécifique à Firefox (content scripts, overlays, popups, badge CSS, manifest)
- **`sources-thunderbird/`** - Code spécifique à Thunderbird (compose scripts, badge CSS, popup traduction lecture, manifest)

Chaque script de build assemble le code partagé avec le code spécifique pour produire un `.xpi` :

- **`firefox-build.sh`** - Copie `sources/` + `sources-firefox/` dans un dossier temporaire, puis crée le `.xpi` Firefox
- **`thunderbird-build.sh`** - Copie `sources/` + `sources-thunderbird/` dans un dossier temporaire, puis crée le `.xpi` Thunderbird

## Arborescence

```
albert-ext/
  sources/                                <- Code partagé (Firefox + Thunderbird)
    service/                              <- Scripts de fond communs (5 fichiers)
      service-config.js                   <- Chargement de la configuration (clé, modèle, URL)
      service-langue.js                   <- Détection de langue locale (RGPD)
      service-prompts.js                  <- Chargement et construction des prompts
      service-limites.js                  <- Cache et récupération des limites du compte
      service-api.js                      <- Appels API (correction, reformulation, traduction)

    prompts/                              <- Prompts éditables (fichiers texte)
      correction.txt                      <- Prompt Correcteur (placeholder {{LANG}})
      reformulation.txt                   <- Prompt Reformuler (placeholder {{LANG}})
      traduction.txt                      <- Prompt Traduire ({{LANG_SOURCE}}, {{LANG_CIBLE}})

    icons/                                <- Icônes
      icon.svg                            <- SVG normal (rouge/bleue)
      icon-error.svg                      <- SVG erreurs (deux branches rouges)
      icon-48/96/128.png                  <- PNG pour le manifest (AMO)

    css/                                  <- Styles partagés
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
      albert-apply-segments.js            <- Mapping innerText <-> noeuds DOM

    affichage/                            <- Rendu visuel
      albert-badge.js                     <- Badge (icône dans le coin des champs, ARIA)
      albert-render-arialive.js           <- Zone aria-live, annonces, clearCorrections
      albert-render-overlay.js            <- Overlay transparent, scroll sync, soulignements
      albert-render.js                    <- Orchestration rendu + contenteditable simple

    notification/                         <- Messages utilisateur
      albert-toast.js                     <- Notifications temporaires

    demarrage/                            <- Initialisation
      albert-main.js                      <- Scan des champs, MutationObserver, IME, paste

    service/                              <- Scripts de fond spécifiques Firefox
      service-menus.js                    <- Menus contextuels et dispatch des messages

    popup-contenu/                        <- Popups injectées dans les pages web
      albert-popup-common.js              <- Thème, drag, close, positionnement
      albert-popup-correction.js          <- Popup de correction (suggestions, navigation)
      albert-popup-reformulation.js       <- Popup de reformulation
      albert-popup-traduction.js          <- Popup de traduction (sélecteur langue, copier)
      albert-popup-messages.js            <- Dispatch des messages du script de fond

    css/                                  <- Style spécifique Firefox
      badge.css                           <- Badge (positionnement absolu, modale Bootstrap)

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
      compose-toast.js                    <- Notifications temporaires
      compose-limites.js                  <- Limites rpm/rpd, calcul debounce adaptatif
      compose-debounce.js                 <- Double debounce (timer court + timer max)
      compose-check.js                    <- triggerCheck
      compose-main.js                     <- Initialisation, MutationObserver, événements

    service/                              <- Scripts de fond spécifiques Thunderbird
      service-menus.js                    <- Menus contextuels (compose + lecture) et dispatch
      service-compose-scripts.js          <- Injection des scripts dans les fenêtres de composition

    message/                              <- Popup de traduction pour la lecture de mail
      message-traduction.html             <- Interface HTML de la popup de traduction
      message-traduction-popup.js         <- Logique de la popup (appel API, affichage)

    css/                                  <- Style spécifique Thunderbird
      badge.css                           <- Badge (positionnement fixe)

  tests/                                  <- Tests unitaires (Node.js, sans dépendance)
    run-all.sh                            <- Lance toutes les suites
    test-*.js                             <- 9 suites, 158 tests

  exemple/                                <- Pages de test
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
  firefox-build.sh                        <- Script d'assemblage Firefox (.xpi)
  thunderbird-build.sh                    <- Script d'assemblage Thunderbird (.xpi)
```

## Fonctionnement

### Vue d'ensemble

L'extension se compose de deux parties :

- **Script de fond** (`sources/service/` + `sources-firefox/service/` ou `sources-thunderbird/service/`) - s'exécute en arrière-plan, communique avec l'API Albert, gère les menus contextuels (Reformuler, Traduire), la détection de langue et le cache des limites.
- **Content scripts Firefox** (`sources-firefox/` : `etat/`, `verification/`, `correction/`, `affichage/`, `notification/`, `demarrage/`, `popup-contenu/`) - injectés dans chaque page, détectent les champs texte, affichent les corrections, la reformulation et la traduction.
- **Compose scripts Thunderbird** (`sources-thunderbird/compose/`) - injectés dans la fenêtre de composition de mail, détectent le body de l'éditeur, affichent les corrections, la reformulation et la traduction.

### Scripts de fond (partagés)

Les 5 fichiers de `sources/service/` sont communs aux deux extensions. Chaque extension y ajoute ses propres fichiers `service/` :

- Firefox : `service-menus.js` (menus contextuels page web)
- Thunderbird : `service-menus.js` (menus contextuels compose) + `service-compose-scripts.js` (gestion des compose scripts)

| Ordre | Module | Répertoire | Rôle |
|-------|--------|------------|------|
| 1 | `service-config.js` | `sources/service/` | Chargement de la configuration |
| 2 | `service-langue.js` | `sources/service/` | Détection de langue locale (RGPD) |
| 3 | `service-prompts.js` | `sources/service/` | Chargement et construction des prompts |
| 4 | `service-limites.js` | `sources/service/` | Cache et récupération des limites du compte |
| 5 | `service-api.js` | `sources/service/` | Appels API (correction, reformulation, traduction) |
| 6 | `service-menus.js` | Spécifique | Menus contextuels et dispatch des messages |
| 7 | `service-compose-scripts.js` | Thunderbird seul | Gestion des compose scripts |

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
         +-- textarea/input/éditeur riche -> albert-render-overlay.js
         +-- contenteditable simple -> albert-render.js (renderContentEditable)
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
         +-- rpm : compteur de requêtes dans les 60 dernières secondes
         +-- rpd : compteur journalier
         +-- updateDebounceFromRpm : délais calculés depuis le rpm du compte
         +-- Throttle : si >80 % du quota, les délais doublent
         |
         v si limite atteinte
         |
         +-- showRateLimitWarning : toast + badges grisés
         +-- Pause automatique
         |
         v si l'API retourne 429
         |
         +-- Extraction du header Retry-After
         +-- Toast avec le type de limite (rpm/rpd/tpm/tpd)
         +-- Pause selon Retry-After
```

### Modules content script (Firefox)

Les content scripts partagent le namespace `window.Albert` et sont chargés dans cet ordre :

| Ordre | Module | Dossier | Rôle |
|-------|--------|---------|------|
| 1 | `albert-state.js` | `etat/` | Constantes, état global, URLs des icônes |
| 2 | `albert-utils.js` | `etat/` | Détection champs, éditeurs riches, dictionnaire |
| 3 | `albert-badge.js` | `affichage/` | Création et positionnement du badge (ARIA) |
| 4 | `albert-render-arialive.js` | `affichage/` | Zone aria-live, annonces, clearCorrections |
| 5 | `albert-render-overlay.js` | `affichage/` | Overlay transparent, scroll sync, soulignements |
| 6 | `albert-render.js` | `affichage/` | Orchestration rendu + contenteditable simple |
| 7 | `albert-popup-common.js` | `popup-contenu/` | Thème, drag, close, positionnement, sélection |
| 8 | `albert-popup-correction.js` | `popup-contenu/` | Popup de correction et navigation |
| 9 | `albert-popup-reformulation.js` | `popup-contenu/` | Popup de reformulation |
| 10 | `albert-popup-traduction.js` | `popup-contenu/` | Popup de traduction |
| 11 | `albert-popup-messages.js` | `popup-contenu/` | Dispatch des messages du script de fond |
| 12 | `albert-apply-segments.js` | `correction/` | Mapping innerText <-> noeuds DOM |
| 13 | `albert-apply-rich.js` | `correction/` | Éditeurs riches : sélection, événements, fallback |
| 14 | `albert-apply.js` | `correction/` | Orchestration des corrections |
| 15 | `albert-toast.js` | `notification/` | Notification toast |
| 16 | `albert-limites.js` | `verification/` | Limites rpm/rpd, calcul debounce adaptatif |
| 17 | `albert-debounce.js` | `verification/` | Double debounce (timer court + timer max) |
| 18 | `albert-check.js` | `verification/` | triggerCheck, cycleCheckAll |
| 19 | `albert-main.js` | `demarrage/` | Scan des champs, MutationObserver, IME, paste |

### Compose scripts (Thunderbird)

Thunderbird injecte les scripts dans la fenêtre de composition via `tabs.executeScript` (géré par `service-compose-scripts.js`). Les scripts partagent le namespace `window.Albert` et sont chargés dans cet ordre :

| Ordre | Module | Rôle |
|-------|--------|------|
| 1 | `compose-state.js` | Constantes, état global |
| 2 | `compose-utils.js` | Utilitaires, détection du body compose |
| 3 | `compose-badge.js` | Badge (icône dans le coin de l'éditeur) |
| 4 | `compose-overlay.js` | Overlay transparent, soulignements |
| 5 | `compose-render.js` | Orchestration du rendu des corrections |
| 6 | `compose-popup-correction.js` | Popup de correction (suggestions) |
| 7 | `compose-popup-reformulation.js` | Popup de reformulation |
| 8 | `compose-popup-traduction.js` | Popup de traduction |
| 9 | `compose-popup-messages.js` | Dispatch des messages du script de fond |
| 10 | `compose-apply.js` | Application des corrections |
| 11 | `compose-toast.js` | Notifications temporaires |
| 12 | `compose-limites.js` | Limites rpm/rpd, calcul debounce adaptatif |
| 13 | `compose-debounce.js` | Double debounce (timer court + timer max) |
| 14 | `compose-check.js` | triggerCheck |
| 15 | `compose-main.js` | Initialisation, MutationObserver, événements |

### États du badge

Le badge n'apparaît qu'au premier focus sur un champ.

| Classe CSS | Icône | Signification |
|------------|-------|---------------|
| `albert-loading` | Normale en rotation | Vérification en cours |
| `albert-has-errors` | Deux branches rouges (`icon-error.svg`) | Erreurs trouvées |
| `albert-no-errors` | Normale rouge/bleue (`icon.svg`) | Aucune erreur |
| `albert-rate-limited` | Grisée | Limite API atteinte |

### Prompts

Les prompts sont des fichiers texte dans `sources/prompts/`, éditables à la main :

| Fichier | Placeholders | Usage |
|---------|-------------|-------|
| `correction.txt` | `{{LANG}}` | Mode Correcteur |
| `reformulation.txt` | `{{LANG}}` | Mode Reformuler |
| `traduction.txt` | `{{LANG_SOURCE}}`, `{{LANG_CIBLE}}` | Traduction |

### Assemblage des extensions

Les deux scripts de build suivent le même principe :

1. Créer un dossier temporaire
2. Copier le contenu de `sources/` (code partagé)
3. Copier le contenu de `sources-firefox/` ou `sources-thunderbird/` par-dessus (code spécifique)
4. Créer le fichier `.xpi` (archive ZIP)

Les fichiers spécifiques peuvent surcharger les fichiers partagés si nécessaire (par exemple, chaque extension a son propre `service-menus.js`).
