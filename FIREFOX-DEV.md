# Installation de Firefox Developer Edition

Pour tester l'extension non signée en local, Firefox Developer Edition est nécessaire.

## Installation

```bash
sudo ./install-firefox-dev.sh
```

## Configuration

1. Lancer `firefox-developer-edition`
2. Aller à `about:config` → passer `xpinstall.signatures.required` à `false`
3. Aller à `about:addons` → roue dentée → "Installer un module depuis un fichier"
4. Sélectionner `firefox-release/albert-correcteur.xpi`

L'extension restera installée après redémarrage.

## Recharger après modification

Après avoir recompilé le `.xpi` avec `./firefox-build.sh` :

1. Aller à `about:addons`
2. Roue dentée → "Installer un module depuis un fichier"
3. Sélectionner le nouveau `albert-correcteur.xpi`

Firefox détecte le même ID et met à jour l'extension en conservant la configuration.

## Compilation

```bash
./firefox-build.sh
```

Le fichier `firefox-release/albert-correcteur.xpi` est généré.
