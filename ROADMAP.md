# Roadmap Albert Correcteur

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
