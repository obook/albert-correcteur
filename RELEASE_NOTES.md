## Albert Correcteur v0.8.0

Version de correction, centrée sur les remplacements qui rataient leur cible.

Une correction portant sur un passage à espace insécable était refusée avec "le texte a changé". Le texte de la page garde ces insécables, le modèle renvoie des espaces ordinaires : la comparaison échouait sur ce seul caractère. Le cas est fréquent en français, devant ; : ! ? comme dans les guillemets et les séparateurs de milliers.

Sur x.com et les éditeurs de même famille, le remplacement s'écrivait parfois en fin de texte au lieu du mot visé. Le délai laissé à l'éditeur dépend maintenant de sa famille. L'événement par lequel il apprend où écrire n'est plus muselé.

Un champ qui s'agrandit au focus ne recevait jamais son badge, faute d'être mesuré au bon moment. Il se repliait aussi au clic sur un mot souligné ou sur le badge. Corrigé également : une correction appliquée décalait mal les suivantes. Le gestionnaire de mots de passe de Firefox se proposait sur le champ "URL de l'API".

Le panneau des limites affiche enfin les paliers du modèle "code".

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
