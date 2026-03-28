# Albert Correcteur - Extension Firefox et Thunderbird

**Extension expérimentale** de correction orthographique, grammaticale et de traduction pour Firefox et Thunderbird, propulsée par l'API [Albert](https://albert.sites.beta.gouv.fr/) (DINUM). Elle détecte les erreurs dans les champs texte des pages web (Firefox) et dans la fenêtre de composition de mail (Thunderbird), propose des corrections en un clic et permet de traduire n'importe quel texte sélectionné (français, anglais, espagnol, allemand).

**Téléchargement** : [Releases GitForge](https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/releases)

| Correction et reformulation | Traduction multi-langues |
|:---:|:---:|
| ![Correction](media/Screenshot_20260317_212610.png) | ![Traduction](media/Screenshot_20260317_212505.png) |

## Fonctionnalités

- Vérification automatique adaptée au quota API (debounce calculé depuis le rpm du compte)
- Vérification immédiate au collage de texte
- Vérification du champ de saisie dès le focus
- Vérification manuelle en cliquant sur le badge Albert dans le coin du champ
- Soulignements colorés selon le type d'erreur :
 - **Rouge** - orthographe
 - **Orange** - grammaire
 - **Bleu** - style
- Popup de suggestion avec explication et correction en un clic (fermeture par Échap ou clic en dehors)
- Animation de rotation du logo pendant la vérification
- Fonctionne sur les `<textarea>`, `<input>` et les éléments `contenteditable`
- Compatible avec les éditeurs riches (CKEditor, TinyMCE, Quill, ProseMirror, Draft.js, Lexical)
- Gestion des saisies IME (langues CJK) sans déclenchement intempestif
- Désactivation automatique du correcteur natif du navigateur sur les champs suivis
- Masquage automatique des éléments Albert lors de l'ouverture d'une modale (Bootstrap)
- Injection dans les iframes (éditeurs intégrés)
- Détection automatique des nouveaux champs ajoutés dynamiquement (SPA, etc.)
- Respect de la limite API (backoff adaptatif calculé depuis le rpm du compte)
- Accessibilité (RGAA) : attributs ARIA sur le badge, les popups et annonces pour lecteurs d'écran
- **Mises à jour automatiques** via `updates.json` (Firefox vérifie périodiquement les nouvelles versions)
- **Reformulation** via le menu contextuel (clic droit dans un champ de saisie)
- **Traduction** via le menu contextuel (clic droit sur n'importe quelle sélection de texte)
 - Langues de traduction : français, anglais, espagnol, allemand
 - Détection automatique de la langue source
 - Traduction automatique à l'ouverture dans la dernière langue choisie
 - Bouton "Copier" pour récupérer le résultat

## Conformité RGPD

- **Aucune bibliothèque externe** : pas de CDN, pas de dépendance tierce, tout est embarqué dans l'extension
- **Aucun appel réseau** en dehors du serveur API Albert configuré par l'utilisateur
- **Détection de langue locale** : réalisée côté client sans appel externe
- **Polices système** uniquement (`-apple-system`, `Segoe UI`, etc.)
- Les données saisies ne transitent que vers le serveur API Albert choisi

## Prérequis

- Firefox 128 ou supérieur
- Une clé API Albert (réservée aux agents de la fonction publique d'État) → [Demander un accès](https://albert.sites.beta.gouv.fr/)

## Installation

1. Télécharger le `.xpi` signé par Mozilla depuis les [Releases GitForge](https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/releases)
2. Dans Firefox : `about:addons` → roue dentée → "Installer un module depuis un fichier"
3. Sélectionner le fichier `.xpi`

Le `.xpi` est signé automatiquement par Mozilla (canal unlisted) lors du pipeline CI/CD, ce qui permet l'installation sur **Firefox standard** sans manipulation.

Pour le développement local avec Firefox Developer Edition, voir [FIREFOX-DEV.md](FIREFOX-DEV.md).

## Extension Thunderbird

Une version pour Thunderbird 128+ est également disponible. Elle offre les mêmes fonctionnalités (correction, reformulation, traduction) directement dans la fenêtre de composition de mail.

### Installation Thunderbird

1. Télécharger le `.xpi` Thunderbird depuis les [Releases GitForge](https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/releases)
2. Dans Thunderbird : Menu > Modules complémentaires > roue dentée > « Installer un module depuis un fichier... »
3. Sélectionner le fichier `.xpi`

## Configuration

1. Cliquer sur l'icône Albert dans la barre d'outils de Firefox
2. Renseigner :
  - **Clé API Albert** (obligatoire) - au format `sk-...`
  - **Modèle** - menu déroulant chargé dynamiquement depuis l'API (modèles `text-generation`)
  - **URL de l'API** (optionnel) - par défaut `https://albert.api.etalab.gouv.fr`
3. Cliquer sur "Enregistrer"

## Fonctionnement

L'extension utilise l'endpoint `/v1/chat/completions` de l'API Albert (compatible OpenAI) avec un prompt système qui demande au modèle de retourner les erreurs au format JSON structuré (word, offset, longueur, type, message, suggestions).

Pour les `<textarea>`, `<input>` et les éditeurs riches (CKEditor, TinyMCE, etc.), un overlay transparent est positionné par-dessus le champ pour afficher les soulignements sans modifier le contenu. L'overlay synchronise 31 propriétés CSS (police, crénage, césure, espacement, etc.) pour un alignement pixel-perfect. Les offsets renvoyés par le LLM sont recalibrés automatiquement en recherchant le mot erroné dans le texte réel. Pour les éléments `contenteditable` simples, les erreurs sont directement encapsulées dans des `<span>`.

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour l'arborescence, les flux et les détails techniques.

## Licences

- **Code source** : [licence MIT](LICENSE)
- **Logo Albert** : issu du projet [Albert](https://albert.sites.beta.gouv.fr/) (DINUM), sous [licence Ouverte Etalab 2.0](https://github.com/etalab/licence-ouverte/blob/master/LO.md)

