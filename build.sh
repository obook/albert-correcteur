#!/bin/bash
# Construit le paquet d'extension pour une cible donnée.
#
# Cibles :
#   firefox      -> firefox-release/albert-correcteur-firefox.xpi
#   thunderbird  -> thunderbird-release/albert-correcteur-thunderbird.xpi
#   brave        -> brave-release/albert-correcteur-brave.zip
#                   + brave-release/albert-correcteur-brave/ (dossier à charger)
#   tout         -> les trois (valeur par défaut si aucun argument)
#
# Chaque paquet est assemblé en empilant des dossiers sources : le code partagé
# d'abord, les fichiers spécifiques ensuite (qui écrasent en cas de conflit).
#
# Usage : ./build.sh [firefox|thunderbird|brave|tout]

# Interrompre le script à la première erreur : sans cela, un cp ou un
# zip en échec produirait une archive incomplète sans le signaler.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
    echo "Usage : ./build.sh [firefox|thunderbird|brave|tout]"
    echo "Sans argument, les trois cibles sont construites."
}

construire() {
    local cible="$1" sources out_dir build_dir out src

    case "$cible" in
        firefox)
            sources="sources-commun sources-firefox"
            out_dir="firefox-release"
            build_dir=".build-firefox"
            out="$out_dir/albert-correcteur-firefox.xpi"
            ;;
        thunderbird)
            sources="sources-commun sources-thunderbird"
            out_dir="thunderbird-release"
            build_dir=".build-thunderbird"
            out="$out_dir/albert-correcteur-thunderbird.xpi"
            ;;
        brave)
            # sources-firefox apporte la logique content/UI, agnostique du
            # navigateur ; sources-brave passe en dernier et écrase le manifest
            # Firefox par les overrides MV3 (service worker, shim browser.*).
            # Le dossier d'assemblage est conservé : il sert au chargement en
            # mode développeur dans brave://extensions.
            sources="sources-commun sources-firefox sources-brave"
            out_dir="brave-release"
            build_dir="$out_dir/albert-correcteur-brave"
            out="$out_dir/albert-correcteur-brave.zip"
            ;;
    esac

    for src in $sources; do
        if [ ! -d "$src" ]; then
            echo "Erreur : le dossier $src/ est introuvable."
            exit 1
        fi
    done

    # Nettoyer et préparer le dossier d'assemblage
    rm -rf "$build_dir"
    mkdir -p "$build_dir" "$out_dir"

    for src in $sources; do
        cp -r "$src"/* "$build_dir"/
    done

    # Créer l'archive (un .xpi est un simple fichier ZIP)
    rm -f "$out"
    (cd "$build_dir" && zip -r "$SCRIPT_DIR/$out" . -x ".*")

    [ "$cible" = "brave" ] || rm -rf "$build_dir"

    echo ""
    case "$cible" in
        firefox)
            echo "Extension packagée : $out"
            echo ""
            echo "Pour installer dans Firefox :"
            echo "  1. Ouvrir about:addons"
            echo "  2. Roue dentée -> Installer un module depuis un fichier..."
            echo "  3. Sélectionner albert-correcteur-firefox.xpi"
            ;;
        thunderbird)
            echo "Extension packagée : $out"
            echo ""
            echo "Pour installer dans Thunderbird :"
            echo "  1. Ouvrir le gestionnaire de modules (Menu > Modules complémentaires)"
            echo "  2. Roue dentée -> Installer un module depuis un fichier..."
            echo "  3. Sélectionner albert-correcteur-thunderbird.xpi"
            ;;
        brave)
            echo "Extension assemblée (dossier) : $build_dir"
            echo "Paquet Chrome Web Store (.zip) : $out"
            echo ""
            echo "Pour tester dans Brave :"
            echo "  1. Ouvrir brave://extensions"
            echo "  2. Activer le \"Mode développeur\" (en haut à droite)"
            echo "  3. \"Charger l'extension non empaquetée\" -> sélectionner :"
            echo "     $SCRIPT_DIR/$build_dir"
            echo ""
            echo "Pour publier : envoyer $out sur le Chrome Web Store."
            ;;
    esac
}

# Sans argument : construire les trois cibles.
case "${1:-tout}" in
    firefox|thunderbird|brave)
        construire "$1"
        ;;
    tout|tous)
        construire firefox
        construire thunderbird
        construire brave
        ;;
    *)
        usage
        exit 1
        ;;
esac
