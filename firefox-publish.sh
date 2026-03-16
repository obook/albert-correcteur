#!/bin/bash
# Publie l'extension Albert Correcteur sur addons.mozilla.org.
# Prérequis : npm install -g web-ext
# Credentials : ~/.amo-credentials (chmod 600)
# Usage : ./firefox-publish.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/firefox"
CREDENTIALS="$HOME/.amo-credentials"

# Vérifier web-ext
if ! command -v web-ext &> /dev/null; then
    echo "Erreur : web-ext n'est pas installé."
    echo "  npm install -g web-ext"
    exit 1
fi

# Vérifier les credentials
if [ ! -f "$CREDENTIALS" ]; then
    echo "Erreur : fichier $CREDENTIALS introuvable."
    echo ""
    echo "Créez-le avec :"
    echo "  echo 'AMO_API_KEY=votre_jwt_issuer' >> ~/.amo-credentials"
    echo "  echo 'AMO_API_SECRET=votre_jwt_secret' >> ~/.amo-credentials"
    echo "  chmod 600 ~/.amo-credentials"
    echo ""
    echo "Clés disponibles sur : https://addons.mozilla.org/developers/addon/api/key/"
    exit 1
fi

# Charger les credentials
source "$CREDENTIALS"

if [ -z "$AMO_API_KEY" ] || [ -z "$AMO_API_SECRET" ]; then
    echo "Erreur : AMO_API_KEY ou AMO_API_SECRET manquant dans $CREDENTIALS"
    exit 1
fi

# Compiler le .xpi d'abord
echo "Compilation du .xpi..."
"$SCRIPT_DIR/firefox-build.sh"

# Publier / signer
echo ""
echo "Publication sur addons.mozilla.org..."
web-ext sign \
    --source-dir "$SRC_DIR" \
    --api-key="$AMO_API_KEY" \
    --api-secret="$AMO_API_SECRET"

echo ""
echo "Publication terminée !"
