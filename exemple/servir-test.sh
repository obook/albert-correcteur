#!/bin/bash
#
# Nom : servir-test.sh
# Description : sert exemple/test.html en HTTP et l'ouvre dans le
#               navigateur par défaut. Les extensions ne s'injectent pas
#               dans une page ouverte en file://, d'où le serveur.
# Auteur : O. Booklage
# Date : août 2026
# Licence : MIT
#
# Usage : ./exemple/servir-test.sh [port]
#
# Ctrl+C arrête le serveur.
set -euo pipefail

PORT="${1:-8899}"
DOSSIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="http://localhost:$PORT/test.html"

if ! command -v python3 >/dev/null; then
  echo "Erreur : python3 est absent, aucun serveur à lancer."
  exit 1
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DOSSIER" &
SERVEUR=$!
trap 'kill "$SERVEUR" 2>/dev/null || true' EXIT

# Laisser le serveur accepter les connexions avant d'ouvrir la page.
sleep 1

# Port déjà pris ou serveur mort : inutile d'ouvrir un onglet sur rien.
if ! kill -0 "$SERVEUR" 2>/dev/null; then
  echo "Erreur : le serveur n'a pas démarré, le port $PORT est sans doute occupé."
  echo "Relancez avec un autre port : $0 8900"
  exit 1
fi

echo "Page servie sur $URL"
xdg-open "$URL" >/dev/null 2>&1 || echo "Ouverture automatique impossible, ouvrez $URL à la main."

wait "$SERVEUR"
