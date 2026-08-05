## Albert Correcteur v0.5.2

### Corrections

- Enregistrement de la clé API plus fiable. Quand la liste des modèles ne pouvait pas se charger (par exemple avec une clé expirée), le bouton "Enregistrer" refusait de sauvegarder la nouvelle clé tant qu'aucun modèle n'était sélectionné. La nouvelle clé restait donc inactive et les corrections continuaient d'échouer. Le bouton tente désormais de recharger les modèles avec la clé saisie avant de renoncer.
- Messages d'erreur plus clairs. En cas de clé invalide ou non autorisée (codes 401 et 403), l'extension affiche un message explicite invitant à vérifier la clé, au lieu du message générique précédent.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
