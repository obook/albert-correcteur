# Architecture du projet

## Arborescence

```
albert-ext/
├── sources/                  ← sources de l'extension
│   ├── manifest.json         ← manifeste Firefox (Manifest V2)
│   ├── background.js         ← appels API Albert, détection de langue, menu contextuel
│   ├── albert-state.js       ← configuration et état partagé (namespace Albert)
│   ├── albert-utils.js       ← fonctions utilitaires (détection champs, dictionnaire)
│   ├── albert-badge.js       ← gestion du badge (icône dans le coin du champ)
│   ├── albert-check.js       ← vérification via l'API (debounce, cycle, rate limit)
│   ├── albert-render.js      ← rendu des corrections (overlay, contenteditable)
│   ├── albert-popup.js       ← popup de correction (navigation, modes, thèmes, reformulation)
│   ├── albert-apply.js       ← application des corrections dans le texte
│   ├── albert-main.js        ← point d'entrée (scan, observer, démarrage)
│   ├── css/                  ← styles découpés
│   │   ├── badge.css         ← icône Albert (états : normal, loading, erreurs, ok, rate-limited)
│   │   ├── overlay.css       ← soulignements d'erreurs (spelling, grammar, style)
│   │   ├── popup-dark.css    ← popup thème sombre (par défaut)
│   │   └── popup-light.css   ← popup thème clair
│   ├── toast/                ← notifications toast
│   │   ├── albert-toast.js   ← affichage du toast
│   │   └── toast.css         ← style du toast (slide-in depuis la droite)
│   ├── prompts/              ← prompts éditables à la main
│   │   ├── correction.txt    ← prompt pour le mode Correcteur
│   │   └── reformulation.txt ← prompt pour le mode Reformuler
│   ├── icons/                ← logos Albert (SVG uniquement)
│   │   ├── icon.svg          ← icône normale (rouge/bleue)
│   │   └── icon-ok.svg       ← icône aucune erreur (verte)
│   └── popup/                ← interface de configuration
│       ├── popup.html
│       ├── popup.css
│       ├── popup.js          ← initialisation, formulaire
│       ├── popup-status.js   ← messages de statut
│       ├── popup-models.js   ← chargement des modèles depuis l'API
│       ├── popup-limits.js   ← affichage des limites du compte
│       ├── popup-settings.html
│       ├── popup-settings.css
│       └── popup-settings.js ← thème et dictionnaire personnel
├── tests/                    ← tests unitaires (Node.js, sans dépendance)
│   ├── run-all.sh            ← lance toutes les suites
│   └── test-*.js             ← 8 suites, 108 tests
├── exemple/                  ← page HTML de test multilingue
├── firefox-release/          ← extension packagée (.xpi) — gitignored
├── firefox-build.sh          ← script de packaging
├── firefox-publish.sh        ← script de publication sur addons.mozilla.org
├── install-firefox-dev.sh    ← script d'installation de Firefox Developer Edition
├── .gitlab-ci.yml            ← pipeline CI/CD (tests, build, release sur tags v*)
└── images/                   ← logo PNG pour GitForge
```

## Fonctionnement

### Vue d'ensemble

L'extension se compose de deux parties :

- **Background script** (`background.js`) — s'exécute en arrière-plan, communique avec l'API Albert, gère le menu contextuel et le cache des limites.
- **Content scripts** (`albert-*.js`) — injectés dans chaque page, détectent les champs texte, affichent les corrections et gèrent l'interaction.

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
         ├── Charge le prompt depuis prompts/*.txt
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
  albert-popup.js (showPopup)
         │
         ├── Affiche la popup (suggestions, navigation, modes)
         │
         ▼ clic sur une suggestion
  albert-apply.js (applySuggestion)
         │
         └── Remplace le mot dans le champ
```

### Flux de reformulation (menu contextuel)

```
  Utilisateur sélectionne du texte → clic droit → "Reformuler avec Albert"
         │
         ▼
  albert-popup.js (sauvegarde la sélection sur contextmenu)
         │
         ▼
  background.js (contextMenus.onClicked)
         │
         ├── Appelle checkText(text, "reformulation")
         ├── Envoie le résultat au content script
         │
         ▼
  albert-popup.js (showReformulationPopup)
         │
         ├── Popup positionnée au clic droit
         │
         ▼ clic sur une suggestion
  albert-popup.js (applyReformulation)
         │
         └── Remplace la sélection dans le champ
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
| 2 | `albert-utils.js` | Détection champs, éditeurs riches, dictionnaire |
| 3 | `albert-badge.js` | Création et positionnement du badge |
| 4 | `albert-render.js` | Rendu des soulignements (overlay/contenteditable) |
| 5 | `albert-popup.js` | Popup de correction et de reformulation |
| 6 | `albert-apply.js` | Application des corrections dans le texte |
| 7 | `toast/albert-toast.js` | Notification toast |
| 8 | `albert-check.js` | Vérification API, limites, debounce |
| 9 | `albert-main.js` | Scan des champs, MutationObserver, démarrage |

### États du badge

| Classe CSS | Icône | Signification |
|------------|-------|---------------|
| *(aucune)* | Normale, semi-transparente | Inactif |
| `albert-loading` | Rotation + halo bleu | Vérification en cours |
| `albert-has-errors` | Normale, opaque | Erreurs trouvées |
| `albert-no-errors` | Verte (`icon-ok.svg`) | Aucune erreur |
| `albert-rate-limited` | Grisée | Limite API atteinte |

### Prompts

Les prompts sont des fichiers texte dans `sources/prompts/`, éditables à la main. Le placeholder `{{LANG}}` est remplacé dynamiquement par la langue détectée (français, anglais, espagnol, allemand).
