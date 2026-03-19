# Roadmap Albert Correcteur

## v0.2.7 — Corrections UX et compatibilité EcoleDirecte (terminé)

**Statut** : livré — release v0.2.7

### Corrections

1. **Remplacement de mots dans CKEditor (EcoleDirecte)** — le correctif v0.2.5 (déduplication `lastNewlineOffset`) était trop agressif : quand un `<br>` terminait un bloc suivi d'un nouveau `<p>`, le deuxième `\n` n'était pas compté. Remplacement par une vérification de parenté DOM (`lastNewlineNode.contains()`) qui ne déduplique que les blocs imbriqués, pas les blocs consécutifs.

2. **Fermeture de la popup par Échap ou clic en dehors** — ajout de deux écouteurs globaux (`keydown` Escape, `mousedown` hors popup) dans `albert-popup-common.js`. Couvre les trois popups (correction, reformulation, traduction).

3. **Icônes par-dessus les modales EcoleDirecte** — ajout de règles CSS `body.modal-open .albert-badge/overlay/popup { display: none !important }` pour masquer les éléments Albert quand une modale Bootstrap est ouverte.

### Fichiers modifiés

- `sources/albert-apply.js` — remplacement de `lastNewlineOffset` par `lastNewlineNode` + `contains()`
- `sources/popup-contenu/albert-popup-common.js` — fermeture Échap + clic en dehors
- `sources/css/badge.css` — masquage badge sous modale Bootstrap
- `sources/css/overlay.css` — masquage overlay sous modale Bootstrap
- `sources/css/popup-dark.css` — masquage popup sous modale Bootstrap
- `sources/manifest.json` — version 0.2.7
- `ROADMAP.md` — ajout de cette section

## v0.2.5 — Correction remplacement de mots dans CKEditor / EcoleDirecte (terminé)

**Statut** : livré — release v0.2.5

### Problème

Dans l'éditeur de texte CKEditor d'EcoleDirecte, les mots corrigés étaient mal remplacés : l'espace précédant le mot était supprimé et la dernière lettre de l'ancien mot restait. Exemple : "motivé et intéréssé" devenait "motivé etintéresséé".

### Cause

La fonction `applyViaSelection` utilise un TreeWalker pour construire un mapping entre les offsets `innerText` et les positions DOM. Pour les éléments bloc (`<div>`, `<p>`, etc.), le code ajoutait un retour à la ligne par élément rencontré. Or, quand CKEditor imbrique des blocs (`<div><p>…</p></div>`), `innerText` n'ajoute qu'un seul `\n` entre deux lignes adjacentes. Ce double comptage décalait la sélection d'un caractère par niveau de bloc imbriqué.

### Correctif

- Ajout d'une variable `lastNewlineOffset` dans le TreeWalker de `applyViaSelection` pour éviter de compter deux `\n` consécutifs au même offset (blocs imbriqués)

### Fichiers modifiés

- `sources/albert-apply.js` — correction du mapping TreeWalker pour blocs imbriqués
- `sources/manifest.json` — version 0.2.5
- `ROADMAP.md` — ajout de cette section

## v0.2.4 — Correction traduction de textes longs et techniques (terminé)

**Statut** : livré — release v0.2.4

### Problème

La traduction de textes longs ou techniques (anglais vers français) pouvait échouer silencieusement : le texte restait en anglais dans la popup. Deux causes identifiées : absence de `max_tokens` dans l'appel API (réponse tronquée) et prompt trop permissif sur le contenu technique.

### Correctif

- Ajout de `max_tokens: 4096` dans l'appel API de traduction (`background.js`)
- Renforcement du prompt de traduction : traduction obligatoire du contenu technique, règle "langue cible" précisée avec "intégralement"

### Fichiers modifiés

- `sources/background.js` — ajout `max_tokens: 4096` pour la traduction
- `sources/prompts/traduction.txt` — prompt renforcé
- `sources/manifest.json` — version 0.2.4
- `ROADMAP.md` — ajout de cette section

## v0.2.3 — Signature Mozilla du .xpi (terminé)

**Statut** : livré — release v0.2.3

### Problème

Le `.xpi` distribué n'était pas signé par Mozilla, ce qui empêchait l'installation sur Firefox standard (seul Firefox Developer Edition avec `xpinstall.signatures.required = false` fonctionnait).

### Correctif

- Ajout d'un stage `sign` dans le pipeline CI/CD utilisant `web-ext sign --channel=unlisted`
- Le `.xpi` est désormais signé automatiquement par Mozilla à chaque release
- Les URLs de la release GitForge et de `updates.json` pointent vers le `.xpi` signé
- Installation possible sur **Firefox standard** sans manipulation de `about:config`

### Fichiers modifiés

- `.gitlab-ci.yml` — nouveau stage `sign` entre `build` et `release`, URLs mises à jour vers `job=sign`
- `sources/manifest.json` — version 0.2.3
- `README.md` — mention de la signature Mozilla, prérequis Firefox 128+
- `ARCHITECTURE.md` — pipeline CI/CD mis à jour (5 stages)
- `ROADMAP.md` — ajout de cette section

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
