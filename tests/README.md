# Tests unitaires

Tests automatisés pour Albert Correcteur. Aucune dépendance externe : utilise uniquement `assert` (Node.js natif).

## Lancer les tests

```bash
./tests/run-all.sh
```

Ou un seul fichier :

```bash
node tests/test-detect-language.js
```

## Suites de tests

| Fichier | Tests | Ce qui est vérifié |
|---------|-------|--------------------|
| `test-structure.js` | 62 | Arborescence du projet, manifest.json (permissions, icônes, scripts), dossiers métier, fichiers supprimés, licence |
| `test-parse-rate-limit-429.js` | 25 | Lecture du Retry-After (en-tête HTTP, champ JSON `retry_after`, message texte), limite journalière alignée sur minuit UTC, type de limite (rpm/rpd/tpm/tpd), message affiché |
| `test-prompt-templates.js` | 18 | Fichiers prompts (correction, reformulation, traduction), placeholders, substitution des langues |
| `test-daily-usage.js` | 16 | Usage journalier (rpd, tpd) depuis `/v1/me/usage`, somme des tokens de prompt et de complétion, filtrage par modèle et par minuit UTC |
| `test-detect-language.js` | 16 | Détection de langue (FR/EN/ES/DE), repli sur le français, casse, ponctuation, mélanges |
| `test-pluriel.js` | 16 | Pluralisation française : règles en -eu, -au, -al et leurs exceptions |
| `test-model-selection.js` | 15 | Identifiant préféré d'un modèle, libellé du sélecteur, présélection du modèle recommandé |
| `test-debounce-rpm.js` | 13 | Calcul du debounce adaptatif depuis le rpm du compte |
| `test-find-real-offset.js` | 13 | Recherche d'offset réel, décalage après corrections, mots dupliqués, proximité |
| `test-auto-fallback.js` | 11 | Auto-fallback de modèle après deux 429 consécutifs (large -> medium -> small), fenêtre 60 s, reset sur succès |
| `test-inner-text-segments.js` | 11 | Correspondance entre les offsets de innerText et les nœuds texte, mesurée sur Gecko |
| `test-rate-limit.js` | 11 | Limites de débit (rpm/rpd) avec fenêtre glissante `Albert.RollingWindow`, changement de jour, temps d'attente |
| `test-recalibrate-offsets.js` | 11 | Recalibrage des offsets renvoyés par le LLM |
| `test-rolling-window.js` | 11 | Classe `Albert.RollingWindow` : `add`, `total`, `secondsUntilNextSlot`, `reset`, éviction d'événements |
| `test-merge-limits.js` | 9 | Fusion des limites API (regroupement par type, valeur minimale, null/illimité) |
| `test-personas.js` | 9 | Personas de reformulation : identifiants, libellés, ton associé |
| `test-trim-suggestion.js` | 9 | Nettoyage des suggestions du LLM |
| `test-filter-ignored.js` | 7 | Dictionnaire personnel (filtrage des mots ignorés, casse) |

**Total** : 18 suites, 283 tests.

## Corpus d'intégration

`tests/run-correction-corpus.sh` mesure le taux de détection des fautes par modèle Albert sur un jeu de phrases de référence (`tests/corpus/correction-samples.json`). Contrairement aux suites unitaires, ce test interroge l'API réelle et nécessite une clé.

```bash
# Tester tous les modèles (large, medium, small)
ALBERT_API_KEY=sk-xxx ./tests/run-correction-corpus.sh

# Limiter à un modèle
ALBERT_API_KEY=sk-xxx ./tests/run-correction-corpus.sh openweight-medium
```

La clé est lue uniquement dans la variable d'environnement (jamais passée en argument). Si la clé est rejetée à la première requête, le script s'arrête immédiatement plutôt que d'épuiser le corpus.

Le script utilise le bon fichier de prompt selon le modèle (cf. `service-prompts.js`), affiche par phrase la détection sous la forme `trouvés/attendus`, signale les faux positifs sur les phrases correctes, et calcule un taux de détection global par modèle. Sert à objectiver l'impact d'une modification de prompt avant intégration.

## Pipeline CI/CD

Les tests sont exécutés automatiquement par GitLab CI sur chaque tag `v*` (voir `.gitlab-ci.yml`). Le pipeline contient ensuite deux jobs de build symétriques (`build-firefox` et `build-thunderbird`), suivis de la signature Mozilla, de la création de la release et de la mise à jour de `updates.json`.
