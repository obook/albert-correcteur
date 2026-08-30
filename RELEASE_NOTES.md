## Albert Correcteur v0.8.3

Un rectangle blanc apparaissait dans le coin haut gauche de la page, bien visible en thème sombre.

Le conteneur qui accueille le badge et les popups porte l'attribut `contenteditable="false"`, nécessaire à la fenêtre de rédaction de Thunderbird. Les sites qui habillent leurs champs éditables avec un sélecteur `[contenteditable]` l'attrapaient au passage et lui donnaient un fond et un cadre. Il est maintenant isolé des styles de la page.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
