## Albert Correcteur v0.6.2

Version corrective. Un seul changement, sur la liste des modèles de la page de configuration. Aucune rupture.

### Corrections

- **La liste des modèles restait vide face à un serveur compatible OpenAI.** L'extension ne retenait que les modèles annonçant un type de tâche ("text-generation"), un champ propre à l'API Albert. Pointée sur une autre URL, un proxy local par exemple, elle affichait "Aucun modèle disponible" alors que le serveur répondait. Une entrée sans ce champ est maintenant retenue. Rien ne change quand l'URL reste celle d'Albert, et les modèles de reconnaissance de texte dans l'image restent écartés.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
