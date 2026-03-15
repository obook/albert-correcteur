#!/bin/bash
# Construit le fichier .xpi pour installation directe dans Firefox.
# Usage : ./build.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/firefox"
OUT_DIR="$SCRIPT_DIR/firefox-release"
OUT="$OUT_DIR/albert-correcteur.xpi"

# Vérifier que le dossier source existe
if [ ! -d "$SRC_DIR" ]; then
    echo "Erreur : le dossier firefox/ est introuvable."
    exit 1
fi

# Créer le dossier de release et supprimer l'ancien .xpi
mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Créer le .xpi (c'est un simple fichier ZIP)
cd "$SRC_DIR"
zip -r "$OUT" . -x ".*"

echo ""
echo "Extension packagée : $OUT"
echo ""
echo "Pour installer dans Firefox :"
echo "  1. Ouvrir about:addons"
echo "  2. Roue dentée → Installer un module depuis un fichier…"
echo "  3. Sélectionner albert-correcteur.xpi"
