# Publication sur addons.mozilla.org

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

## Mise à jour automatique (auto-hébergé)

Pour les installations hors AMO (via `.xpi` direct), Firefox vérifie périodiquement le fichier `updates.json` pour détecter les nouvelles versions.

Le manifest contient :
```json
"update_url": "https://forge.apps.education.fr/booklageolivier/albert-ext/-/raw/main/updates.json"
```

Lors d'une nouvelle release, mettre à jour `updates.json` à la racine du dépôt :

```json
{
  "addons": {
    "albert-correcteur@ac-bordeaux.fr": {
      "updates": [
        {
          "version": "x.y.z",
          "update_link": "https://forge.apps.education.fr/booklageolivier/albert-ext/-/releases/vx.y.z/downloads/albert-correcteur_x.y.z.xpi"
        }
      ]
    }
  }
}
```

Le fichier `updates.json` doit être accessible en HTTPS sur la branche `main`.
