## Albert Correcteur v0.6.1

Version corrective centrée sur Thunderbird, avec un correctif Firefox pour les éditeurs riches. Aucune nouvelle fonctionnalité, aucune rupture.

### Corrections

- **Thunderbird : l'extension ne démarrait plus dans la fenêtre de composition** ("Albert.buildInnerTextSegments is not a function"). Les modules partagés avec Firefox s'accrochaient à un objet global différent de celui du compose.
- **Thunderbird : cadre autour du badge et icône absente.** L'icône est maintenant posée par la feuille de style, plus fiable qu'une image pointant vers une ressource interne de l'extension.
- **Thunderbird : le badge disparaissait** après une sélection totale suivie d'une suppression, une annulation ou le rechargement d'un brouillon. L'interface de l'extension (badge, popups, notifications) vit désormais hors du corps éditable du message, ce qui supprime toute la famille de problèmes liée à sa présence dans le texte.
- **Soulignements et corrections décalés sur les longues réponses.** La correspondance entre le texte analysé et le document est mesurée sur le rendu réel au lieu d'être calculée par règles : sur un courriel avec citations, l'écart atteignait des dizaines de caractères et les remplacements tombaient à côté du mot.
- **Thunderbird : "Index or size is negative..."** interrompait l'affichage des soulignements quand l'API signalait deux corrections qui se chevauchent, et le clic sur le badge semblait mort.
- **Un remplacement incertain est refusé.** Si la position calculée ne couvre plus exactement le mot erroné (texte modifié entre-temps), l'extension affiche "Le texte a changé, relancez la vérification" au lieu d'écrire au mauvais endroit.
- **Firefox : sur x.com, la suggestion s'insérait en fin de texte** au lieu de remplacer le mot. L'insertion attend désormais que l'éditeur ait pris connaissance de la sélection, et vérifie qu'elle couvre bien le mot avant d'écrire.
- **Configuration : les modèles OCR ne figurent plus dans la liste des modèles**, ils ne peuvent pas servir à la correction.

### À noter lors de la mise à jour

Fermer les fenêtres de composition Thunderbird avant de réinstaller : une fenêtre restée ouverte garde les scripts de l'ancienne version.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
