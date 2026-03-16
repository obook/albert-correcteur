#!/bin/bash
# Installe Firefox Developer Edition et l'extension Albert Correcteur.
# Usage : sudo ./install-firefox-dev.sh

set -e

REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
ARCHIVE="$REAL_HOME/Téléchargements/firefox-dev.tar.bz2"
INSTALL_DIR="/opt/firefox-developer-edition"
LINK="/usr/local/bin/firefox-developer-edition"
DESKTOP="/usr/share/applications/firefox-developer-edition.desktop"

# Vérifier les droits root
if [ "$EUID" -ne 0 ]; then
    echo "Ce script doit être lancé avec sudo."
    echo "Usage : sudo $0"
    exit 1
fi

# Vérifier que l'archive existe
if [ ! -f "$ARCHIVE" ]; then
    echo "Erreur : archive introuvable : $ARCHIVE"
    echo "Lancez d'abord le téléchargement."
    exit 1
fi

# Supprimer une installation précédente
if [ -d "$INSTALL_DIR" ]; then
    echo "Suppression de l'ancienne installation..."
    rm -rf "$INSTALL_DIR"
fi

# Extraire (le fichier est en réalité du .tar.xz)
echo "Extraction dans /opt..."
tar -xJf "$ARCHIVE" -C /opt/
mv /opt/firefox "$INSTALL_DIR"

# Créer le lien symbolique
ln -sf "$INSTALL_DIR/firefox" "$LINK"

# Créer un raccourci bureau
cat > "$DESKTOP" <<'EOF'
[Desktop Entry]
Name=Firefox Developer Edition
Comment=Navigateur Web Firefox Developer Edition
Exec=/opt/firefox-developer-edition/firefox %u
Icon=/opt/firefox-developer-edition/browser/chrome/icons/default/default128.png
Terminal=false
Type=Application
Categories=Network;WebBrowser;
StartupWMClass=firefox-aurora
EOF

echo ""
echo "Firefox Developer Edition installé !"
echo ""
echo "Étapes suivantes :"
echo "  1. Lancer :  firefox-developer-edition"
echo "  2. Aller à about:config"
echo "  3. Passer xpinstall.signatures.required à false"
echo "  4. Aller à about:addons → roue dentée → Installer un module depuis un fichier"
echo "  5. Sélectionner firefox-release/albert-correcteur.xpi"
echo ""
echo "L'extension restera installée après redémarrage."
