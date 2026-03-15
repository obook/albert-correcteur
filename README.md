# Albert Correcteur — Extension Firefox

Extension Firefox de correction orthographique et grammaticale française, propulsée par l'API [Albert](https://albert.sites.beta.gouv.fr/) (DINUM). Elle détecte les erreurs dans les champs texte des pages web et propose des corrections en un clic.

## Fonctionnalités

- Vérification automatique 3 secondes après l'arrêt de la saisie
- Vérification cyclique de tous les champs de la page (priorité au champ actif)
- Vérification manuelle en cliquant sur le badge Albert dans le coin du champ
- Soulignements colorés selon le type d'erreur :
  - **Rouge** — orthographe
  - **Orange** — grammaire
  - **Bleu** — style
- Popup de suggestion avec explication et correction en un clic
- Animation de rotation du logo pendant la vérification
- Fonctionne sur les `<textarea>`, `<input>` et les éléments `contenteditable`
- Compatible avec les éditeurs riches (CKEditor, TinyMCE, Quill, ProseMirror)
- Injection dans les iframes (éditeurs intégrés type EcoleDirecte)
- Détection automatique des nouveaux champs ajoutés dynamiquement (SPA, etc.)
- Respect de la limite API (backoff automatique en cas de rate limit)

## Prérequis

- Firefox 109 ou supérieur
- Une clé API Albert (réservée aux agents de la fonction publique d'État) → [Demander un accès](https://albert.sites.beta.gouv.fr/)

## Installation

### Chargement temporaire (développement)

1. Ouvrir `about:debugging#/runtime/this-firefox` dans Firefox
2. Cliquer sur "Charger un module temporaire…"
3. Sélectionner le fichier `firefox/manifest.json`

### Depuis le fichier .xpi

```bash
./firefox-build.sh
```

Le fichier `firefox-release/albert-correcteur.xpi` est généré. L'installation directe du `.xpi` nécessite Firefox ESR, Developer Edition ou Nightly (les extensions non signées sont bloquées sur Firefox stable).

## Configuration

1. Cliquer sur l'icône Albert dans la barre d'outils de Firefox
2. Renseigner :
   - **Clé API Albert** (obligatoire) — au format `sk-...`
   - **Modèle** — menu déroulant chargé dynamiquement depuis l'API (modèles `text-generation`)
   - **URL de l'API** (optionnel) — par défaut `https://albert.api.etalab.gouv.fr`
3. Cliquer sur "Enregistrer"

## Structure du projet

```
albert-ext/
├── firefox/                  ← sources de l'extension
│   ├── manifest.json         ← manifeste Firefox (Manifest V2)
│   ├── background.js         ← appels API Albert (chat/completions)
│   ├── albert-state.js       ← configuration et état partagé (namespace Albert)
│   ├── albert-utils.js       ← fonctions utilitaires (détection champs, éditeurs)
│   ├── albert-badge.js       ← gestion du badge (icône dans le coin du champ)
│   ├── albert-check.js       ← vérification via l'API (debounce, cycle, rate limit)
│   ├── albert-render.js      ← rendu des corrections (overlay, contenteditable)
│   ├── albert-popup.js       ← popup de suggestion
│   ├── albert-apply.js       ← application des corrections dans le texte
│   ├── albert-main.js        ← point d'entrée (scan, observer, démarrage)
│   ├── content.css           ← styles des soulignements et popups
│   ├── icons/                ← logo Albert (SVG + PNG)
│   └── popup/                ← interface de configuration
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
├── firefox-release/          ← extension packagée (.xpi)
├── firefox-build.sh          ← script de packaging
└── images/                   ← logos sources
```

## Comment ça marche

L'extension utilise l'endpoint `/v1/chat/completions` de l'API Albert (compatible OpenAI) avec un prompt système qui demande au modèle de retourner les erreurs au format JSON structuré (offset, longueur, type, message, suggestions).

Pour les `<textarea>`, `<input>` et les éditeurs riches (CKEditor, TinyMCE, etc.), un overlay transparent est positionné par-dessus le champ pour afficher les soulignements sans modifier le contenu. Pour les éléments `contenteditable` simples, les erreurs sont directement encapsulées dans des `<span>`.

Les content scripts sont découpés en modules (namespace `window.Albert`) chargés dans l'ordre par le manifest, pour faciliter la maintenance.

