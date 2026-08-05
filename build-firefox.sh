#!/bin/bash
# Construit le fichier .xpi pour installation directe dans Firefox.
# Assemble sources-commun/ (code partagé) + sources-firefox/ (code spécifique).
# Usage : ./build-firefox.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/sources-commun"
FIREFOX_DIR="$SCRIPT_DIR/sources-firefox"
OUT_DIR="$SCRIPT_DIR/firefox-release"
BUILD_DIR="$SCRIPT_DIR/.build-firefox"
OUT="$OUT_DIR/albert-correcteur-firefox.xpi"

# Vérifier que les dossiers source existent
if [ ! -d "$COMMON_DIR" ]; then
    echo "Erreur : le dossier sources-commun/ est introuvable."
    exit 1
fi
if [ ! -d "$FIREFOX_DIR" ]; then
    echo "Erreur : le dossier sources-firefox/ est introuvable."
    exit 1
fi

# Nettoyer et préparer le dossier d'assemblage
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copier le code partagé puis le code spécifique Firefox (écrase si conflit)
cp -r "$COMMON_DIR"/* "$BUILD_DIR"/
cp -r "$FIREFOX_DIR"/* "$BUILD_DIR"/

# Créer le dossier de release et supprimer l'ancien .xpi
mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Créer le .xpi (c'est un simple fichier ZIP)
cd "$BUILD_DIR"
zip -r "$OUT" . -x ".*"

# Nettoyer
rm -rf "$BUILD_DIR"

echo ""
echo "Extension packagée : $OUT"
echo ""
echo "Pour installer dans Firefox :"
echo "  1. Ouvrir about:addons"
echo "  2. Roue dentée -> Installer un module depuis un fichier..."
echo "  3. Sélectionner albert-correcteur-firefox.xpi"
