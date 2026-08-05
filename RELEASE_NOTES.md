## Albert Correcteur v0.6.0

Cette version corrige plusieurs défauts qui interrompaient la correction en cours d'utilisation, et améliore la qualité des suggestions renvoyées par le modèle.

### Corrections

- **La vérification s'arrêtait dès qu'une correction était affichée.** Un repère interne, destiné à éviter les requêtes en double, était écrasé à chaque frappe : plus aucune analyse ne partait tant que le champ n'était pas vidé. C'était la cause principale du comportement « ça fonctionne, puis ça s'arrête ».
- **Le badge pouvait rester en chargement plusieurs minutes.** Les appels à l'API ont désormais un délai maximal de 30 secondes, avec un message explicite si l'API ne répond pas.
- **Thunderbird : du contenu de l'extension pouvait partir dans le courriel.** Les popups, notifications et annonces destinées aux lecteurs d'écran sont maintenant retirées du corps du message avant l'envoi.
- **Thunderbird : après application d'une suggestion**, le mot corrigé restait souligné en rouge et les boutons de navigation entre erreurs ne répondaient plus.
- **Reformulation dans les éditeurs riches** (Draft.js, Lexical, CKEditor, ProseMirror) : le texte d'origine réapparaissait après le remplacement. La reformulation emprunte désormais le même chemin que la correction.
- **Soulignements décalés dans les longs textes.** Le calcul des positions suit maintenant le comportement réel du moteur de rendu, mesuré et non supposé. Sur un courriel de plusieurs paragraphes, les erreurs des derniers paragraphes n'étaient plus signalées.
- **Traduction dans Thunderbird** : la sélection était parfois perdue à la fermeture du menu contextuel, et la popup ne s'ouvrait pas.
- **Réponse à un courriel volumineux** : l'extension s'activait avant la fin du chargement du message et sautait la première vérification.
- Le bouton « Copier » de la traduction signale un échec au lieu d'annoncer une copie qui n'a pas eu lieu.
- Les mots à cheval sur plusieurs balises (une portion en gras, un lien) sont soulignés en entier et cliquables sur toute leur longueur.
- Le pluriel de « lieu » est de nouveau « lieux ».

### Améliorations

- **Qualité des suggestions.** Les exemples de référence transmis au modèle contenaient des positions et des longueurs erronées, ainsi qu'une règle de grammaire que son propre exemple contredisait. Leur correction améliore directement la pertinence des corrections proposées.
- **Préférence de langue de traduction commune** à Firefox et Thunderbird. La valeur déjà enregistrée est reprise automatiquement.
- Code partagé entre les trois cibles au lieu d'être dupliqué, ce qui réduit le risque qu'une correction ne soit appliquée que d'un côté.

### À noter lors de la mise à jour

L'extension Thunderbird demande une nouvelle autorisation, l'écriture dans le presse-papiers, nécessaire au bouton « Copier » de la popup de traduction.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
