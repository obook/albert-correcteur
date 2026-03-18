# Roadmap Albert Correcteur

## v0.2.2 — Mises à jour automatiques et correction lien de téléchargement (terminé)

**Statut** : livré — release v0.2.2

### Problème

Le lien de téléchargement dans le README pointait vers la page développeur AMO (`/developers/addon/...`), inaccessible aux utilisateurs. De plus, l'extension n'avait plus de mécanisme de mise à jour automatique depuis la suppression de `update_url` et `updates.json` en v0.2.1.

### Correctif

- Remplacement du lien AMO développeur par le lien public des Releases GitForge
- Restauration de `update_url` dans `manifest.json` pointant vers `updates.json` sur la branche main
- Création de `updates.json` avec le lien vers le `.xpi` signé
- Ajout d'un stage CI `update-manifest` qui met à jour automatiquement `updates.json` à chaque release

### Fichiers modifiés

- `README.md` — liens de téléchargement corrigés, mention des mises à jour automatiques
- `sources/manifest.json` — version 0.2.2, ajout `update_url`
- `updates.json` — nouveau fichier de manifeste de mise à jour
- `.gitlab-ci.yml` — nouveau stage `update` pour mise à jour automatique de `updates.json`
- `ARCHITECTURE.md` — ajout de `updates.json` dans l'arborescence
- `ROADMAP.md` — ajout de cette section

## v0.2.1 — Compatibilité avec l'éditeur x.com (terminé)

**Statut** : livré — release v0.2.1

### Problème

Sur x.com, une fois le message corrigé avec l'extension, si on sélectionne toute une ligne elle perd toutes les corrections. L'éditeur de x.com (Draft.js / Lexical) reconstruit le DOM depuis son état interne React, supprimant toute modification DOM extérieure.

### Correctif

- Détection de Draft.js et Lexical comme éditeurs riches dans `isRichEditor()` (`albert-utils.js`)
- Utilisation de l'overlay transparent pour le rendu visuel (au lieu d'injecter des spans dans le DOM)
- Application des corrections via `execCommand("insertText")` qui génère des événements natifs captés par l'éditeur React
- Recalcul immédiat des offsets et re-rendu de l'overlay après chaque correction appliquée

### Fichiers modifiés

- `sources/albert-utils.js` — ajout de la détection Draft.js (`DraftEditor-root`, `data-contents`) et Lexical (`data-lexical-editor`)
- `sources/albert-apply.js` — recalcul des offsets restants et re-rendu immédiat de l'overlay
- `sources/manifest.json` — version 0.2.1
- `exemple/test.html` — section de test avec éditeurs Draft.js et Lexical simulés
- `exemple/test-react-editors.js` — script simulant le re-rendu React pour valider le correctif
