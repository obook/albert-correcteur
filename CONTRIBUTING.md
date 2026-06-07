# Contribuer à Albert Correcteur

Merci de l'intérêt que vous portez à ce projet. Cette extension est
expérimentale et toute contribution est la bienvenue : signalement de bogue,
proposition de fonctionnalité, correction de documentation ou de code.

Ce document décrit la manière de contribuer. Pour comprendre l'organisation
interne du code, consultez d'abord [ARCHITECTURE.md](ARCHITECTURE.md).

## Sommaire

- [Signaler un bogue ou proposer une amélioration](#signaler-un-bogue-ou-proposer-une-amélioration)
- [Préparer son environnement](#préparer-son-environnement)
- [Construire et tester l'extension](#construire-et-tester-lextension)
- [Organisation du dépôt](#organisation-du-dépôt)
- [Conventions de code](#conventions-de-code)
- [Messages de commit](#messages-de-commit)
- [Proposer une modification (merge request)](#proposer-une-modification-merge-request)
- [Contraintes à respecter](#contraintes-à-respecter)

## Signaler un bogue ou proposer une amélioration

Les tickets sont gérés sur la forge :
<https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/issues>

Avant d'ouvrir un ticket, vérifiez qu'un ticket similaire n'existe pas déjà.
Pour un bogue, indiquez autant que possible :

- la version de l'extension (visible dans `about:addons`) et celle du
  navigateur ou de Thunderbird ;
- le système d'exploitation ;
- le site ou le contexte de saisie concerné (champ `<textarea>`, éditeur riche,
  fenêtre de composition Thunderbird, etc.) ;
- les étapes permettant de reproduire le problème ;
- le comportement attendu et le comportement observé ;
- le cas échéant, les messages de la console (`F12`).

L'extension expose une aide au diagnostic dans la console :
`Albert.diagnose(document.activeElement)` renvoie les raisons pour lesquelles
un champ est suivi ou exclu.

## Préparer son environnement

Le projet ne dépend d'aucune bibliothèque tierce et n'a pas d'étape de
compilation : le code source JavaScript, HTML et CSS est chargé tel quel par le
navigateur. Les seuls outils nécessaires sont :

- `bash` et `zip` pour exécuter les scripts de construction ;
- Firefox Developer Edition (ou Nightly) pour charger une version non signée ;
- Thunderbird 128 ou supérieur pour la partie courriel ;
- Brave (ou un autre navigateur Chromium récent) pour la partie navigateur Chromium.

Une clé API Albert est requise pour un test fonctionnel complet. Elle est
réservée aux agents de la fonction publique d'État :
<https://albert.sites.beta.gouv.fr/>

## Construire et tester l'extension

Trois scripts assemblent le code partagé (`sources-commun/`) avec le code
spécifique à chaque plateforme :

```bash
./build-firefox.sh       # produit firefox-release/albert-correcteur-firefox.xpi
./build-thunderbird.sh   # produit thunderbird-release/albert-correcteur-thunderbird.xpi
./build-brave.sh         # produit brave-release/albert-correcteur-brave.zip et le dossier à charger
```

Pour tester sous Firefox sans signature Mozilla, deux options :

1. **Chargement temporaire** (ne persiste pas après redémarrage) : ouvrir
   `about:debugging#/runtime/this-firefox`, cliquer sur "Charger un module
   complémentaire temporaire..." et sélectionner le `manifest.json` du dossier
   source assemblé.
2. **Installation persistante** sur Firefox Developer Edition : passer
   `xpinstall.signatures.required` à `false` dans `about:config`, puis installer
   le `.xpi` via `about:addons`.

Pour tester sous Brave, ouvrir `brave://extensions`, activer le "Mode
développeur", puis charger le dossier `brave-release/albert-correcteur-brave/`
avec "Charger l'extension non empaquetée". Après chaque modification, relancer
le build et recharger l'extension.

La page `exemple/test.html` regroupe des champs de test (textarea, input,
contenteditable, éditeurs Draft.js et Lexical, champs exclus, multilingue) pour
vérifier manuellement la détection et le remplacement.

## Organisation du dépôt

| Dossier | Rôle |
|---------|------|
| `sources-commun/` | Code partagé entre toutes les cibles |
| `sources-firefox/` | Code spécifique à Firefox (réutilisé par Brave) |
| `sources-thunderbird/` | Code spécifique à Thunderbird |
| `sources-brave/` | Surcouche Brave / Chromium (manifest V3, service worker, polyfill) |
| `sources-commun/prompts/` | Prompts système (correction, reformulation, traduction) |
| `exemple/` | Page de test manuel |
| `tests/` | Ressources de test |
| `badges/`, `images/`, `media/` | Illustrations et badges du README |

Le détail des flux et des modules figure dans [ARCHITECTURE.md](ARCHITECTURE.md).

## Conventions de code

- **Langue** : code et identifiants en anglais lorsque c'est l'usage ; les
  commentaires et la documentation sont rédigés en français correctement
  accentué.
- **Style** : indentation à deux espaces, point-virgule en fin d'instruction,
  guillemets droits. Respecter le style du fichier modifié.
- **Pas de dépendance externe** : aucune bibliothèque tierce, aucun CDN. Tout
  doit être embarqué dans l'extension (voir [Contraintes](#contraintes-à-respecter)).
- **Accessibilité** : préserver les attributs ARIA et les contrastes conformes
  au RGAA / WCAG 2.1 AA. Voir [ACCESSIBILITE.md](ACCESSIBILITE.md).
- **Sécurité** : ne jamais introduire d'appel réseau vers un autre serveur que
  l'API Albert configurée par l'utilisateur. Voir [SECURITE.md](SECURITE.md).

## Messages de commit

Le projet suit la convention [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
<type>(<portée>): <description courte à l'impératif>
```

Types courants : `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `test`.
Exemples tirés de l'historique :

```
fix(thunderbird): Empêcher l'inclusion du badge Albert dans le courriel envoyé
feat: Sélection intelligente des modèles, badge initial rouge
chore: bump version 0.3.4 -> 0.3.5
```

La description est rédigée en français accentué. Documentez tout changement
notable dans [CHANGELOG.md](CHANGELOG.md), sous la section "Non publié".

## Proposer une modification (merge request)

1. Créez un fork du dépôt sur la forge.
2. Créez une branche dédiée à partir de `main`
   (par exemple `fix/badge-tchap` ou `feat/traduction-italien`).
3. Réalisez vos modifications en respectant les conventions ci-dessus.
4. Testez l'extension construite (Firefox, Thunderbird et/ou Brave) ainsi que la page
   `exemple/test.html` lorsque la correction concerne la détection ou le
   remplacement.
5. Mettez à jour la documentation et le `CHANGELOG.md` si nécessaire.
6. Ouvrez une merge request vers `main` en décrivant clairement le problème
   résolu et la manière de le vérifier.

Les numéros de version et les releases sont gérés par le mainteneur via la
chaîne d'intégration continue (`.gitlab-ci.yml`) ; il n'est pas nécessaire de
modifier le champ `version` des fichiers `manifest.json` dans une contribution.

## Contraintes à respecter

Ces principes fondent le projet et conditionnent l'acceptation d'une
contribution :

- **Confidentialité des données** : aucune donnée ne doit transiter ailleurs que
  vers le serveur API Albert choisi par l'utilisateur.
- **Aucune dépendance tierce** : pas de CDN, pas de bibliothèque externe, pas de
  traceur. Tout le code est embarqué et auditable.
- **Polices système uniquement** : ne pas charger de police distante.
- **Accessibilité et sécurité** : ne pas régresser sur les exigences décrites
  dans [ACCESSIBILITE.md](ACCESSIBILITE.md) et [SECURITE.md](SECURITE.md).

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous la
[licence MIT](LICENSE) du projet.
