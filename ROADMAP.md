# Roadmap Albert Correcteur

Idées à venir, numérotées `R..`. Les nouvelles s'ajoutent en bas avec le
prochain numéro libre.

Une case à cocher marque une action, cochée quand elle est faite. Les
puces sans case sont des constats, il n'y a rien à y exécuter.

## À venir

- [ ] **R01.** Dictée vocale depuis le badge, pour saisir un texte à la voix avant correction.
  - Le moteur existe : Albert expose `/v1/audio/transcriptions` (relevé dans son `openapi.json` le 25/08/2026), en `multipart/form-data`, champs `file` et `model` obligatoires, plus `language`, `prompt`, `response_format` et `temperature`.
  - Le coût est dans la capture, pas dans l'appel : `getUserMedia` appelé depuis un content script demande le micro au nom du site, la fenêtre de permission afficherait le nom du site visité et sa politique de permissions peut le refuser. Depuis une page d'extension l'origine est propre, mais la popup d'action se ferme dès qu'elle perd le focus, il faudrait donc un panneau latéral ou un onglet.
  - Budget estimé : environ 150 lignes (`MediaRecorder`, envoi multipart, insertion dans le champ, états d'interface).
  - Le badge est l'ancrage naturel, il est déjà posé à côté de chaque champ éditable, et la boucle "je saisis, l'extension corrige" est celle du projet. Sans code, la dictée du système (Win+H sous Windows) écrit déjà dans n'importe quel champ.
  - [ ] Confirmer le nom du modèle audio. `/health/models` demande une clé.
  - [ ] Vérifier le comportement de `getUserMedia` depuis un content script sur Firefox 128.

- [x] **R02.** Isoler le conteneur `<albert-ui>` des feuilles de style de la page.
  - Le conteneur porte `contenteditable="false"`, nécessaire au compose Thunderbird. Un sélecteur `[contenteditable]` du site le capte quand même, la valeur `false` comprise : sur `exemple/test.html` il héritait du fond blanc, du cadre, de l'arrondi et de la hauteur minimale des éditeurs, et dessinait un rectangle de 22x80 px dans le coin haut gauche de la fenêtre. Accroché à `<html>`, il échappait en plus à la règle de thème sombre portée par `body.dark`.
  - Si un site déborde malgré le correctif, la piste de repli est de ne poser `contenteditable` que sous Thunderbird, là où le `designMode` du compose le rend utile.
  - [x] Poser `all:initial` en tête du style inline, dans `sources-commun/util/ui-root.js`. Fait le 30/08/2026, vérifié sur Firefox : le conteneur retombe à 0x0 et transparent.
  - [x] Vérifier le rendu sous Thunderbird, où le conteneur n'a pas de shadow DOM et où ses enfants héritent donc de lui. Vérifié à l'écran le 30/08/2026, badge et popup intacts dans la fenêtre de rédaction. Brave n'est pas un cas distinct : `build-brave.sh` reprend `sources-firefox`, donc le shadow DOM y est présent comme sous Firefox.
