## Albert Correcteur v0.8.2

Correction du remplacement au mauvais endroit sur x.com, apparu avec la 0.8.1.

Quand le message comptait plusieurs paragraphes séparés par une ligne vide, une correction pouvait s'écrire dans le paragraphe où le curseur avait été laissé, en y recopiant la ligne corrigée. La popup prend le focus à l'ouverture, pour rester utilisable au clavier, et l'éditeur de x.com ignore les changements de sélection le temps de traiter le retour de ce focus. La sélection est maintenant posée un tour plus tard, une fois qu'il peut l'entendre.

Deux défauts voisins sont corrigés : une correction appliquée après une autre pouvait viser une autre occurrence du même mot, et un champ minuscule portant `role="textbox"` recevait un badge alors qu'il n'est un lieu de rédaction pour personne.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
