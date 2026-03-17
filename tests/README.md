# Tests unitaires

Tests automatisés pour Albert Correcteur. Aucune dépendance externe — utilise uniquement `assert` (Node.js natif).

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
| `test-structure.js` | 51 | Arborescence du projet, manifest.json (permissions, icônes, scripts), fichiers supprimés, licence |
| `test-prompt-templates.js` | 18 | Fichiers prompts (correction, reformulation, traduction), placeholders, substitution des langues |
| `test-detect-language.js` | 16 | Détection de langue (FR/EN/ES/DE), fallback français, casse, ponctuation, mélanges |
| `test-build-highlighted-html.js` | 11 | Construction du HTML souligné, tri des corrections, chevauchements, échappement XSS |
| `test-rate-limit.js` | 10 | Limites de débit (rpm/rpd), nettoyage des timestamps, changement de jour |
| `test-merge-limits.js` | 9 | Fusion des limites API (regroupement par type, valeur minimale, null/illimité) |
| `test-escape-html.js` | 7 | Échappement des caractères HTML (`& < > "`) |
| `test-filter-ignored.js` | 7 | Dictionnaire personnel (filtrage des mots ignorés, casse) |

## Pipeline CI/CD

Les tests sont exécutés automatiquement par GitLab CI sur chaque tag `v*` (voir `.gitlab-ci.yml`).
