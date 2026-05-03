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
| `test-structure.js` | 61 | Arborescence du projet, manifest.json (permissions, icônes, scripts), dossiers métier, fichiers supprimés, licence |
| `test-prompt-templates.js` | 18 | Fichiers prompts (correction, reformulation, traduction), placeholders, substitution des langues |
| `test-model-selection.js` | 18 | Sélection intelligente du modèle, alias, modèle recommandé |
| `test-parse-rate-limit-429.js` | 18 | Lecture du Retry-After (en-tête HTTP, champ JSON `retry_after`, message texte « Limit exceeded: N requests per minute »), détection du type de limite (rpm/rpd/tpm/tpd) |
| `test-detect-language.js` | 16 | Détection de langue (FR/EN/ES/DE), fallback français, casse, ponctuation, mélanges |
| `test-debounce-rpm.js` | 13 | Calcul du debounce adaptatif depuis le rpm du compte |
| `test-find-real-offset.js` | 13 | Recherche d'offset réel, décalage après corrections, mots dupliqués, proximité |
| `test-auto-fallback.js` | 12 | Auto-fallback de modèle après deux 429 consécutifs (large -> medium -> small), fenêtre 60 s, reset sur succès |
| `test-daily-usage.js` | 12 | Calcul de l'usage journalier (rpd, tpd) depuis `/v1/me/usage`, filtrage par modèle canonique et timestamp minuit UTC |
| `test-build-highlighted-html.js` | 11 | Construction du HTML souligné, tri des corrections, chevauchements, échappement XSS |
| `test-rate-limit.js` | 11 | Limites de débit (rpm/rpd) avec fenêtre glissante `Albert.RollingWindow`, changement de jour, calcul du temps d'attente |
| `test-recalibrate-offsets.js` | 11 | Recalibrage des offsets renvoyés par le LLM |
| `test-rolling-window.js` | 11 | Classe `Albert.RollingWindow` : `add`, `total`, `secondsUntilNextSlot`, `reset`, éviction d'évènements |
| `test-merge-limits.js` | 9 | Fusion des limites API (regroupement par type, valeur minimale, null/illimité) |
| `test-trim-suggestion.js` | 9 | Nettoyage des suggestions du LLM |
| `test-escape-html.js` | 7 | Échappement des caractères HTML (`& < > "`) |
| `test-filter-ignored.js` | 7 | Dictionnaire personnel (filtrage des mots ignorés, casse) |

**Total** : 17 suites, 257 tests.

## Pipeline CI/CD

Les tests sont exécutés automatiquement par GitLab CI sur chaque tag `v*` (voir `.gitlab-ci.yml`). Le pipeline contient ensuite deux jobs de build symétriques (`build-firefox` et `build-thunderbird`), suivis de la signature Mozilla, de la création de la release et de la mise à jour de `updates.json`.
