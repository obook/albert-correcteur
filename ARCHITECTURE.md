# Architecture du projet

## Arborescence

```
albert-ext/
  sources/                              <- Extension Firefox (contenu du .xpi)
    manifest.json                       <- Manifeste Firefox (Manifest V2)

    etat/                               <- État global et utilitaires
      albert-state.js                   <- Constantes, configuration, variables globales
      albert-utils.js                   <- Détection champs, éditeurs riches, dictionnaire

    verification/                       <- Appel API et gestion du rythme
      albert-limites.js                 <- Limites rpm/rpd, calcul debounce adaptatif
      albert-debounce.js                <- Double debounce (timer court + timer max)
      albert-check.js                   <- triggerCheck, cycleCheckAll

    correction/                         <- Application des corrections dans le texte
      albert-apply.js                   <- Orchestration, findRealOffset, dispatch par type
      albert-apply-rich.js              <- Éditeurs riches : sélection, événements, fallback
      albert-apply-segments.js          <- Mapping innerText <-> noeuds DOM

    affichage/                          <- Rendu visuel
      albert-badge.js                   <- Badge (icône dans le coin des champs, ARIA)
      albert-render-arialive.js         <- Zone aria-live, annonces, clearCorrections
      albert-render-overlay.js          <- Overlay transparent, scroll sync, soulignements
      albert-render.js                  <- Orchestration rendu + contenteditable simple

    notification/                       <- Messages utilisateur
      albert-toast.js                   <- Notifications temporaires

    demarrage/                          <- Initialisation
      albert-main.js                    <- Scan des champs, MutationObserver, IME, paste

    service/                            <- Script de fond (6 fichiers)
      service-config.js                 <- Chargement de la configuration (clé, modèle, URL)
      service-langue.js                 <- Détection de langue locale (RGPD)
      service-prompts.js                <- Chargement et construction des prompts
      service-limites.js                <- Cache et récupération des limites du compte
      service-api.js                    <- Appels API (correction, reformulation, traduction)
      service-menus.js                  <- Menus contextuels et dispatch des messages

    popup-contenu/                      <- Popups injectées dans les pages web
      albert-popup-common.js            <- Thème, drag, close, positionnement
      albert-popup-correction.js        <- Popup de correction (suggestions, navigation)
      albert-popup-reformulation.js     <- Popup de reformulation
      albert-popup-traduction.js        <- Popup de traduction (sélecteur langue, copier)
      albert-popup-messages.js          <- Dispatch des messages du script de fond

    popup-configuration/                <- Interface de configuration (barre d'outils)
      popup.html / .css / .js           <- Formulaire (clé API, modèle, URL)
      popup-status.js                   <- Messages de statut
      popup-models.js                   <- Chargement des modèles
      popup-limits.js                   <- Limites du compte
      popup-settings.*                  <- Page paramètres (thème, dictionnaire)

    css/                                <- Tous les styles
      badge.css                         <- Badge (normal, loading, erreur, ok, rate-limited)
      overlay.css                       <- Soulignements (spelling, grammar, style)
      popup-dark.css                    <- Popup thème sombre
      popup-light.css                   <- Popup thème clair
      toast.css                         <- Notification toast

    prompts/                            <- Prompts éditables (fichiers texte)
      correction.txt                    <- Prompt Correcteur (placeholder {{LANG}})
      reformulation.txt                 <- Prompt Reformuler (placeholder {{LANG}})
      traduction.txt                    <- Prompt Traduire ({{LANG_SOURCE}}, {{LANG_CIBLE}})

    icons/                              <- Icônes
      icon.svg                          <- SVG normal (rouge/bleue)
      icon-error.svg                    <- SVG erreurs (deux branches rouges)
      icon-48/96/128.png                <- PNG pour le manifest (AMO)

  tests/                                <- Tests unitaires (Node.js, sans dépendance)
    run-all.sh                          <- Lance toutes les suites
    test-*.js                           <- 9 suites, 158 tests

  exemple/                              <- Pages de test
    test.html                           <- Page de test multilingue + éditeurs React
    test-react-editors.js               <- Simulation re-rendu React (Draft.js/Lexical)
  media/                                <- Captures d'écran pour le README
  images/                               <- Logo PNG pour GitForge

  README.md                             <- Documentation principale
  ARCHITECTURE.md                       <- Ce fichier
  ROADMAP.md                            <- Roadmap et sprints
  FIREFOX-DEV.md                        <- Installation Firefox Developer Edition
  LICENSE                               <- Licence MIT
  updates.json                          <- Manifeste de mise à jour Firefox (auto-update)
  .gitlab-ci.yml                        <- Pipeline CI/CD (tests, build, sign, release)
  firefox-build.sh                      <- Script de packaging (.xpi)
  install-firefox-dev.sh                <- Script d'installation Firefox Dev Edition
```

## Fonctionnement

### Vue d'ensemble

L'extension se compose de deux parties :

- **Script de fond** (`service/`) — s'exécute en arrière-plan, communique avec l'API Albert, gère les menus contextuels (Reformuler, Traduire), la détection de langue et le cache des limites.
- **Content scripts** (`etat/`, `verification/`, `correction/`, `affichage/`, `notification/`, `demarrage/`, `popup-contenu/`) — injectés dans chaque page, détectent les champs texte, affichent les corrections, la reformulation et la traduction.

### Flux de correction

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

### Modules content script

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

### Scripts de fond

Chargés dans cet ordre par le manifest (scope global partagé) :

| Ordre | Module | Rôle |
|-------|--------|------|
| 1 | `service-config.js` | Chargement de la configuration |
| 2 | `service-langue.js` | Détection de langue locale (RGPD) |
| 3 | `service-prompts.js` | Chargement et construction des prompts |
| 4 | `service-limites.js` | Cache et récupération des limites du compte |
| 5 | `service-api.js` | Appels API (correction, reformulation, traduction) |
| 6 | `service-menus.js` | Menus contextuels et dispatch des messages |

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
