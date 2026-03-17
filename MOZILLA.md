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

## Distribution

L'extension est distribuée en mode "À vous de jouer" (non listée sur AMO) car elle ne concerne que les agents de l'État. Mozilla signe le `.xpi` mais l'extension n'apparaît pas dans le catalogue public.

Distribution du `.xpi` signé via :
- Les releases GitForge
- Intranet / mail de l'académie

## Mise à jour automatique

Le manifest contient une `update_url` qui pointe vers `updates.json` sur le dépôt GitForge. Firefox vérifie ce fichier périodiquement pour détecter les nouvelles versions.

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
