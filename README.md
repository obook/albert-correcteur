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
- Injection dans les iframes (éditeurs intégrés)
- Détection automatique des nouveaux champs ajoutés dynamiquement (SPA, etc.)
- Respect de la limite API (backoff automatique en cas de rate limit)

## Conformité RGPD

- **Aucune bibliothèque externe** : pas de CDN, pas de dépendance tierce, tout est embarqué dans l'extension
- **Aucun appel réseau** en dehors du serveur API Albert configuré par l'utilisateur
- **Détection de langue locale** : réalisée côté client sans appel externe
- **Polices système** uniquement (`-apple-system`, `Segoe UI`, etc.)
- Les données saisies ne transitent que vers le serveur API Albert choisi

## Prérequis

- Firefox 109 ou supérieur
- Une clé API Albert (réservée aux agents de la fonction publique d'État) → [Demander un accès](https://albert.sites.beta.gouv.fr/)

## Installation

### Chargement temporaire (développement)

1. Ouvrir `about:debugging#/runtime/this-firefox` dans Firefox
2. Cliquer sur "Charger un module temporaire…"
3. Sélectionner le fichier `sources/manifest.json`

### Installation persistante (Firefox Developer Edition)

```bash
# Installation de Firefox Developer Edition
sudo ./install-firefox-dev.sh
```

Puis dans Firefox Developer Edition :
1. Aller à `about:config` → passer `xpinstall.signatures.required` à `false`
2. Aller à `about:addons` → roue dentée → "Installer un module depuis un fichier"
3. Sélectionner `firefox-release/albert-correcteur.xpi`

### Recharger après modification

Après avoir recompilé le `.xpi` avec `./firefox-build.sh`, il n'est pas nécessaire de désinstaller l'extension :

1. Aller à `about:addons`
2. Roue dentée → "Installer un module depuis un fichier"
3. Sélectionner le nouveau `albert-correcteur.xpi`

Firefox détecte le même ID et met à jour l'extension en conservant la configuration.

### Depuis le fichier .xpi

```bash
./firefox-build.sh
```

Le fichier `firefox-release/albert-correcteur.xpi` est généré. L'installation directe du `.xpi` nécessite Firefox ESR, Developer Edition ou Nightly (les extensions non signées sont bloquées sur Firefox stable).

### Publication sur addons.mozilla.org

1. Créer un compte sur https://addons.mozilla.org/developers/
2. Générer des clés API sur https://addons.mozilla.org/developers/addon/api/key/
3. Configurer les credentials :
   ```bash
   echo 'AMO_API_KEY=votre_jwt_issuer' >> ~/.amo-credentials
   echo 'AMO_API_SECRET=votre_jwt_secret' >> ~/.amo-credentials
   chmod 600 ~/.amo-credentials
   ```
4. Publier :
   ```bash
   ./firefox-publish.sh
   ```

## Configuration

1. Cliquer sur l'icône Albert dans la barre d'outils de Firefox
2. Renseigner :
   - **Clé API Albert** (obligatoire) — au format `sk-...`
   - **Modèle** — menu déroulant chargé dynamiquement depuis l'API (modèles `text-generation`)
   - **URL de l'API** (optionnel) — par défaut `https://albert.api.etalab.gouv.fr`
3. Cliquer sur "Enregistrer"

## Fonctionnement

L'extension utilise l'endpoint `/v1/chat/completions` de l'API Albert (compatible OpenAI) avec un prompt système qui demande au modèle de retourner les erreurs au format JSON structuré (offset, longueur, type, message, suggestions).

Pour les `<textarea>`, `<input>` et les éditeurs riches (CKEditor, TinyMCE, etc.), un overlay transparent est positionné par-dessus le champ pour afficher les soulignements sans modifier le contenu. Pour les éléments `contenteditable` simples, les erreurs sont directement encapsulées dans des `<span>`.

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour l'arborescence, les flux et les détails techniques.

