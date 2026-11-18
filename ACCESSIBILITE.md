# Déclaration d'accessibilité -- Albert Correcteur

**Date de mise à jour :** 2026-06-07

## État de conformité

L'extension Albert Correcteur est en **conformité partielle** avec le RGAA 4.1 (Référentiel Général d'Amélioration de l'Accessibilité), niveau AA.

## Technologies utilisées

- JavaScript ES6+ (sans dépendance externe)
- CSS (styles embarqués dans l'extension)
- API WebExtensions (Manifest V2 pour Firefox et Thunderbird, Manifest V3 pour Chromium)

## Environnements de test

| Navigateur | Version | Système |
|------------|---------|---------|
| Firefox | 128+ | Linux, Windows, macOS |
| Thunderbird | 128+ | Linux, Windows, macOS |
| Chromium (Chrome, Edge, Brave...) | récent | Linux, Windows, macOS |

## Critères RGAA vérifiés

### Images (thème 1)

| Critère | Statut | Détail |
|---------|--------|--------|
| 1.1 Images porteuses d'information avec alternative | Conforme | `alt="Albert"` sur le logo, `aria-hidden="true"` sur les icônes décoratives |
| 1.2 Images décoratives sans alternative | Conforme | Poignée de déplacement masquée via `aria-hidden` |

### Couleurs (thème 3)

| Critère | Statut | Détail |
|---------|--------|--------|
| 3.2 Contraste texte/fond >= 4.5:1 | Conforme | Texte principal : 12.63:1 (clair), 11.73:1 (sombre). Textes secondaires >= 5.90:1 |
| 3.3 Information non véhiculée uniquement par la couleur | Conforme | Les erreurs utilisent couleur + position + message textuel |

### Navigation (thème 12)

| Critère | Statut | Détail |
|---------|--------|--------|
| 12.7 Focus visible sur les éléments interactifs | Conforme | `:focus-visible` avec outline 2px sur tous les boutons et sélecteurs |
| 12.8 Ordre de tabulation cohérent | Conforme | Ordre DOM = ordre visuel dans les popups |

### Formulaires (thème 11)

| Critère | Statut | Détail |
|---------|--------|--------|
| 11.1 Champs de formulaire avec étiquette | Conforme | `aria-label` sur les sélecteurs de langue et boutons |

### Scripts (thème 7)

| Critère | Statut | Détail |
|---------|--------|--------|
| 7.1 Scripts compatibles technologies d'assistance | Conforme | `role="dialog"`, `aria-label`, `aria-live="polite"`, `aria-atomic` |
| 7.3 Scripts accessibles au clavier | Conforme | Badge : Entrée/Espace. Popups : Tab/Maj+Tab/Échap. Navigation erreurs : boutons |

### Structure (thème 9)

| Critère | Statut | Détail |
|---------|--------|--------|
| 9.1 Titres dans les popups | Conforme | `<h2>` masqué visuellement (sr-only) dans chaque popup |

### Présentation (thème 10)

| Critère | Statut | Détail |
|---------|--------|--------|
| 10.7 Piège de focus dans les fenêtres modales | Conforme | Tab/Shift+Tab restent dans la popup, focus restauré à la fermeture |

### Langue (thème 8)

| Critère | Statut | Détail |
|---------|--------|--------|
| 8.4 Changement de langue signalé | Conforme | Attribut `lang` sur le contenu traduit |

## Axes d'amélioration

- Test avec lecteur d'écran NVDA/Orca pour validation pratique
- Migration future vers CSS Custom Highlights API (suppression du DOM supplémentaire)
- Encapsulation Shadow DOM pour isolation complète

## Contact

Pour signaler un problème d'accessibilité : ouvrir un ticket sur le dépôt GitHub du projet.
