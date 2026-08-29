## Albert Correcteur v0.8.1

Version de correction, centrée sur les webmails.

Zimbra et Roundcube montent leur zone de rédaction dans une iframe sans adresse. Le script n'y était pas injecté : ni badge, ni correction, rien. Même chose pour un corps de document en designMode, la forme classique de Zimbra. Les deux cas sont pris en charge, fenêtre de rédaction intégrée comme séparée.

Dans ces éditeurs, le corps du message est le champ lui-même. Badge, popups et zone d'annonce y étaient insérés : ils partaient avec le courriel, et le débordement du champ rognait les soulignements, qui restaient invisibles. Tout cela vit maintenant hors du texte.

Les soulignements ne reproduisent plus la mise en page du champ, ils mesurent les plages du document. Sur un message à plusieurs paragraphes, ils dérivaient dès le deuxième ; sur un mot en gras ou dans un lien, ils tombaient à côté. La popup de correction, elle, remontait hors de l'écran quand l'éditeur était plus petit qu'elle.

L'interface passe dans un shadow DOM : les feuilles de style de la page ne peuvent plus la déformer, et les nôtres ne fuient plus dans la page.

### Téléchargements

- Firefox : extension signée par Mozilla (.xpi)
- Thunderbird : extension (.xpi)
- Brave / Chromium : archive (.zip)
