# Roadmap Albert Correcteur

Idées à venir, numérotées `R..`. Les nouvelles s'ajoutent en bas avec le
prochain numéro libre.

## À venir

- [ ] **R01.** Dictée vocale depuis le badge, pour saisir un texte à la voix avant correction.
  - Le moteur existe : Albert expose `/v1/audio/transcriptions` (relevé dans son `openapi.json` le 2026-08-25), en `multipart/form-data`, champs `file` et `model` obligatoires, plus `language`, `prompt`, `response_format` et `temperature`. Nom du modèle audio à confirmer, `/health/models` demande une clé.
  - Le coût est dans la capture, pas dans l'appel : `getUserMedia` appelé depuis un content script demande le micro au nom du site, la fenêtre de permission afficherait le nom du site visité et sa politique de permissions peut le refuser. Depuis une page d'extension l'origine est propre, mais la popup d'action se ferme dès qu'elle perd le focus : il faudrait un panneau latéral ou un onglet. Non vérifié sur Firefox 128.
  - Budget estimé : environ 150 lignes (`MediaRecorder`, envoi multipart, insertion dans le champ, états d'interface).
  - Le badge est l'ancrage naturel, il est déjà posé à côté de chaque champ éditable, et la boucle "je saisis, l'extension corrige" est celle du projet. Sans code, la dictée du système (Win+H sous Windows) écrit déjà dans n'importe quel champ.
