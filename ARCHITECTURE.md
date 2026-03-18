# Architecture du projet

## Arborescence

```
albert-ext/
├── sources/                          ← Extension Firefox (contenu du .xpi)
│   ├── manifest.json                 ← Manifeste Firefox (Manifest V2)
│   ├── background.js                 ← Script d'arrière-plan (API, menus contextuels, limites)
│   │
│   ├── albert-state.js               ← État global partagé (namespace Albert)
│   ├── albert-utils.js               ← Utilitaires (détection champs, dictionnaire)
│   ├── albert-badge.js               ← Badge (icône dans le coin des champs)
│   ├── albert-render.js              ← Rendu des soulignements d'erreurs
│   ├── albert-check.js               ← Vérification API (debounce, limites)
│   ├── albert-apply.js               ← Application des corrections dans le texte
│   ├── albert-main.js                ← Point d'entrée (scan, observer, démarrage)
│   │
│   ├── popup-contenu/                ← Popups injectées dans les pages web
│   │   ├── albert-popup-common.js    ← Thème, drag, close, positionnement
│   │   ├── albert-popup-correction.js← Popup de correction (suggestions, navigation)
│   │   ├── albert-popup-reformulation.js ← Popup de reformulation
│   │   ├── albert-popup-traduction.js← Popup de traduction (sélecteur langue, copier)
│   │   └── albert-popup-messages.js  ← Dispatch des messages du background
│   │
│   ├── popup-configuration/          ← Interface de configuration (barre d'outils)
│   │   ├── popup.html / .css / .js   ← Formulaire (clé API, modèle, URL)
│   │   ├── popup-status.js           ← Messages de statut
│   │   ├── popup-models.js           ← Chargement des modèles
│   │   ├── popup-limits.js           ← Limites du compte
│   │   └── popup-settings.*          ← Page paramètres (thème, dictionnaire)
│   │
│   ├── css/                          ← Styles des content scripts
│   │   ├── badge.css                 ← Badge (normal, loading, erreur, ok, rate-limited)
│   │   ├── overlay.css               ← Soulignements (spelling, grammar, style)
│   │   ├── popup-dark.css            ← Popup thème sombre
│   │   └── popup-light.css           ← Popup thème clair
│   │
│   ├── toast/                        ← Notifications toast
│   │   ├── albert-toast.js
│   │   └── toast.css
│   │
│   ├── prompts/                      ← Prompts éditables (fichiers texte)
│   │   ├── correction.txt            ← Prompt Correcteur (placeholder {{LANG}})
│   │   ├── reformulation.txt         ← Prompt Reformuler (placeholder {{LANG}})
│   │   └── traduction.txt            ← Prompt Traduire ({{LANG_SOURCE}}, {{LANG_CIBLE}})
│   │
│   └── icons/                        ← Icônes
│       ├── icon.svg                  ← SVG normal (rouge/bleue) — badge OK
│       ├── icon-error.svg            ← SVG erreurs (deux branches rouges)
│       └── icon-48/96/128.png        ← PNG pour le manifest (AMO)
│
├── tests/                            ← Tests unitaires (Node.js, sans dépendance)
│   ├── run-all.sh                    ← Lance toutes les suites
│   └── test-*.js                     ← 8 suites, 129 tests
│
├── exemple/                          ← Pages de test
│   ├── test.html                     ← Page de test multilingue + éditeurs React
│   └── test-react-editors.js         ← Simulation re-rendu React (Draft.js/Lexical)
├── media/                            ← Captures d'écran pour le README
├── images/                           ← Logo PNG pour GitForge
│
├── README.md                         ← Documentation principale
├── ARCHITECTURE.md                   ← Ce fichier
├── ROADMAP.md                        ← Roadmap et sprints
├── FIREFOX-DEV.md                    ← Installation Firefox Developer Edition
├── LICENSE                           ← Licence MIT
├── updates.json                      ← Manifeste de mise à jour Firefox (auto-update)
├── .gitlab-ci.yml                    ← Pipeline CI/CD (tests, build, release, mise à jour updates.json)
├── firefox-build.sh                  ← Script de packaging (.xpi)
└── install-firefox-dev.sh            ← Script d'installation Firefox Dev Edition
```

## Fonctionnement

### Vue d'ensemble

L'extension se compose de deux parties :

- **Background script** (`background.js`) — s'exécute en arrière-plan, communique avec l'API Albert, gère les menus contextuels (Reformuler, Traduire), la détection de langue et le cache des limites.
- **Content scripts** (`albert-*.js` + `popup-contenu/`) — injectés dans chaque page, détectent les champs texte, affichent les corrections, la reformulation et la traduction.

### Flux de correction

```
  Utilisateur tape du texte
         │
         ▼
  albert-main.js (événement input)
         │
         ▼ debounce 3s
  albert-check.js (triggerCheck)
         │
         ├── Vérifie les limites (rpm/rpd)
         │
         ▼
  background.js (checkText)
         │
         ├── Détecte la langue (FR/EN/ES/DE)
         ├── Charge le prompt depuis prompts/correction.txt
         ├── Appelle l'API Albert /v1/chat/completions
         │
         ▼
  Réponse JSON : { corrections: [...] }
         │
         ▼
  albert-check.js
         │
         ├── Filtre les mots du dictionnaire personnel
         │
         ▼
  albert-render.js (renderCorrections)
         │
         ├── textarea/input/éditeur riche → overlay transparent
         ├── contenteditable simple → <span> dans le DOM
         │
         ▼
  Soulignements colorés (rouge/orange/bleu)
         │
         ▼ clic sur un mot souligné
  albert-popup-correction.js (showPopup)
         │
         ├── Affiche la popup (suggestions, navigation, modes)
         │
         ▼ clic sur une suggestion
  albert-apply.js (applySuggestion)
         │
         ├── Remplace le mot dans le champ
         ├── Retire la correction de la liste, recalcule les offsets restants
         └── Re-rend l'overlay immédiatement (suppression instantanée du soulignement)
```

### Flux de reformulation (menu contextuel)

```
  Utilisateur sélectionne du texte dans un champ → clic droit → "Reformuler avec Albert"
         │
         ▼
  albert-popup-common.js (sauvegarde la sélection sur contextmenu)
         │
         ▼
  background.js (contextMenus.onClicked)
         │
         ├── Appelle checkText(text, "reformulation")
         ├── Envoie le résultat au content script
         │
         ▼
  albert-popup-messages.js → albert-popup-reformulation.js (showReformulationPopup)
         │
         ├── Popup positionnée au clic droit
         │
         ▼ clic sur une suggestion
  albert-popup-reformulation.js (applyReformulation)
         │
         └── Remplace la sélection dans le champ
```

### Flux de traduction (menu contextuel)

```
  Utilisateur sélectionne du texte (n'importe où) → clic droit → "Traduire avec Albert"
         │
         ▼
  albert-popup-common.js (sauvegarde la sélection sur contextmenu)
         │
         ▼
  background.js (contextMenus.onClicked)
         │
         └── Envoie "translateGetSelection" au content script
                │
                ▼
  albert-popup-messages.js → albert-popup-traduction.js (showTranslationPopup)
         │
         ├── Popup avec sélecteur de langue + bouton Traduire
         ├── Traduction automatique dans la dernière langue choisie
         │
         ▼
  albert-popup-traduction.js (doTranslate)
         │
         ├── Envoie { type: "translate", text, targetLang } au background
         │
         ▼
  background.js (translateText)
         │
         ├── Détecte la langue source
         ├── Charge le prompt depuis prompts/traduction.txt
         ├── Appelle l'API Albert
         │
         ▼
  Réponse : { translation: "...", langSource }
         │
         ▼
  Popup affiche le résultat + "Langue source → Langue cible"
         │
         └── Bouton "Copier" → presse-papiers
```

### Gestion des limites API

```
  Avant chaque requête
         │
         ▼
  albert-check.js (checkRateLimit)
         │
         ├── rpm : compteur de requêtes dans les 60 dernières secondes
         ├── rpd : compteur journalier
         │
         ▼ si limite atteinte
         │
         ├── Toast en haut à droite (message + durée)
         ├── Badges grisés sur tous les champs
         ├── Pause automatique
         │
         ▼ si l'API retourne 429
         │
         ├── Extraction du header Retry-After
         ├── Toast avec le type de limite (rpm/rpd/tpm/tpd)
         └── Pause selon Retry-After
```

### Modules content script

Les content scripts partagent le namespace `window.Albert` et sont chargés dans cet ordre par le manifest :

| Ordre | Module | Rôle |
|-------|--------|------|
| 1 | `albert-state.js` | Constantes, état global, URLs des icônes |
| 2 | `albert-utils.js` | Détection champs, éditeurs riches (CKEditor, TinyMCE, Quill, ProseMirror, Draft.js, Lexical), dictionnaire |
| 3 | `albert-badge.js` | Création et positionnement du badge |
| 4 | `albert-render.js` | Rendu des soulignements (overlay/contenteditable) |
| 5 | `popup-contenu/albert-popup-common.js` | Thème, drag, close, positionnement, sélection |
| 6 | `popup-contenu/albert-popup-correction.js` | Popup de correction et navigation |
| 7 | `popup-contenu/albert-popup-reformulation.js` | Popup de reformulation |
| 8 | `popup-contenu/albert-popup-traduction.js` | Popup de traduction |
| 9 | `popup-contenu/albert-popup-messages.js` | Dispatch des messages du background |
| 10 | `albert-apply.js` | Application des corrections dans le texte |
| 11 | `toast/albert-toast.js` | Notification toast |
| 12 | `albert-check.js` | Vérification API, limites, debounce |
| 13 | `albert-main.js` | Scan des champs, MutationObserver, démarrage |

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
