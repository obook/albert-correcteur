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
  - [x] Vérifier le rendu sous Thunderbird, où le conteneur n'a pas de shadow DOM et où ses enfants héritent donc de lui. Vérifié à l'écran le 30/08/2026, badge et popup intacts dans la fenêtre de rédaction. Chromium n'est pas un cas distinct : `./build.sh chromium` reprend `sources-firefox`, donc le shadow DOM y est présent comme sous Firefox.

- [ ] **R03.** Étendre l'exclusion du texte cité à Firefox, pour les webmails (Zimbra en premier).
  - Thunderbird ne soumet plus la citation depuis le 03/09/2026 (`sources-commun/util/citations.js`). Le module est partagé et couvre déjà les marqueurs des webmails : `blockquote` sans attribut, et les `data-marker` de Zimbra (`__QUOTED_TEXT__`, `__DIVIDER__`, `__SIG__`), vérifiés par `tests/test-citations.js`. Il n'y a pas de nouveau code de repérage à écrire.
  - Le gain attendu est celui mesuré sous Thunderbird : sur une réponse ordinaire, 464 caractères soumis au lieu de 8 623, et une réponse du modèle d'autant plus rapide.
  - Le point délicat est la vérification incrémentale, absente de Thunderbird : `albert-check.js` décale déjà les offsets d'un `baseOffset` quand un seul paragraphe a changé. Deux décalages empilés sont l'endroit où cela peut déraper. La parade est de placer le filtre tout en amont, dans `getTextContent()` : l'incrémental travaille alors sur le texte réduit sans le savoir, et le seul décalage vers le DOM se fait au rendu.
  - Le filtre ne doit pas s'appliquer aux `<textarea>` et aux `<input>`, dont la valeur n'a pas de structure HTML : `getTextContent()` renvoie `el.value` pour eux, et il n'y a rien à écarter.
  - [ ] Ajouter `util/citations.js` aux `content_scripts` de `sources-firefox/manifest.json`, après `util/inner-text.js`.
  - [ ] Brancher le filtre dans `Albert.getTextContent()` (`sources-firefox/etat/albert-utils.js`), pour les seuls champs éditables riches.
  - [ ] Ramener les offsets vers le champ dans `albert-check.js`, en vérifiant l'interaction avec le chemin incrémental.
  - [ ] Vérifier sur un vrai Zimbra que les marqueurs sont bien ceux attendus : ils n'ont été observés que dans la documentation, pas sur une instance.

