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

Les mises à jour sont gérées automatiquement par addons.mozilla.org.
