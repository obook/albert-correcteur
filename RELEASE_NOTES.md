## Albert Correcteur v0.8.4

Version de correction.

Dans une fenêtre modale, comme le cahier de texte d'EcoleDirecte, cliquer sur un mot souligné n'affichait rien : la popup s'ouvrait derrière la modale. Elle passe maintenant devant.

Des fautes n'étaient jamais signalées quand la correction retirait ou remplaçait le "s" final ("chevals", "parmis"). Sur certains comptes, le délai entre deux corrections pendant la frappe était deux fois trop long.

Thunderbird n'envoie plus à l'API le texte cité ni la signature, seulement ce que vous rédigez. Un texte collé au-dessus de la citation est de nouveau vérifié et l'interface de l'extension ne part plus avec le courriel.

L'extension fonctionne avec un serveur local sans clé API : la clé devient facultative. Le lien de demande de clé pointe vers le playground Albert.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
