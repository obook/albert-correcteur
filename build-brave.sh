#!/bin/bash
# Construit le paquet pour Brave / Chromium (Manifest V3).
# Assemble sources-commun/ (code partagé) + sources-firefox/ (logique content/UI,
# agnostique du navigateur) + sources-brave/ (overrides MV3 : manifest, service
# worker, polyfill). L'ordre de copie fait que sources-brave/ écrase le manifest
# de Firefox.
#
# Produit :
#   - un dossier décompressé prêt pour "load unpacked" dans brave://extensions
#   - un .zip prêt pour l'envoi sur le Chrome Web Store
#
# Usage : ./build-brave.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/sources-commun"
FIREFOX_DIR="$SCRIPT_DIR/sources-firefox"
BRAVE_DIR="$SCRIPT_DIR/sources-brave"
OUT_DIR="$SCRIPT_DIR/brave-release"
BUILD_DIR="$OUT_DIR/albert-correcteur-brave"
OUT="$OUT_DIR/albert-correcteur-brave.zip"

# Vérifier que les dossiers source existent
if [ ! -d "$COMMON_DIR" ]; then
    echo "Erreur : le dossier sources-commun/ est introuvable."
    exit 1
fi
if [ ! -d "$FIREFOX_DIR" ]; then
    echo "Erreur : le dossier sources-firefox/ est introuvable."
    exit 1
fi
if [ ! -d "$BRAVE_DIR" ]; then
    echo "Erreur : le dossier sources-brave/ est introuvable."
    exit 1
fi

# Vérifier que le polyfill a bien été fourni (non versionné, à vendorer)
if [ ! -f "$BRAVE_DIR/lib/browser-polyfill.js" ]; then
    echo "Erreur : sources-brave/lib/browser-polyfill.js est manquant."
    echo "  Récupérer webextension-polyfill (Mozilla) et le placer à cet emplacement :"
    echo "    npm pack webextension-polyfill"
    echo "    # puis extraire dist/browser-polyfill.min.js vers sources-brave/lib/browser-polyfill.js"
    exit 1
fi

# Nettoyer et préparer le dossier d'assemblage
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copier le code partagé, puis la logique content/UI de Firefox (agnostique),
# puis les overrides Brave/MV3 (écrase le manifest Firefox au passage).
cp -r "$COMMON_DIR"/* "$BUILD_DIR"/
cp -r "$FIREFOX_DIR"/* "$BUILD_DIR"/
cp -r "$BRAVE_DIR"/* "$BUILD_DIR"/

# Créer le .zip (Chrome Web Store)
rm -f "$OUT"
cd "$BUILD_DIR"
zip -r "$OUT" . -x ".*"

echo ""
echo "Extension assemblée (dossier) : $BUILD_DIR"
echo "Paquet Chrome Web Store (.zip) : $OUT"
echo ""
echo "Pour tester dans Brave :"
echo "  1. Ouvrir brave://extensions"
echo "  2. Activer le \"Mode développeur\" (en haut à droite)"
echo "  3. \"Charger l'extension non empaquetée\" -> sélectionner :"
echo "     $BUILD_DIR"
echo ""
echo "Pour publier : envoyer $OUT sur le Chrome Web Store."
