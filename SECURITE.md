# Fiche de sécurité - Albert Correcteur

**Date de mise à jour :** 2026-06-07
**Référentiel :** Guide ANSSI de développement sécurisé

## Surface d'attaque

### Permissions

| Permission | Justification |
|------------|--------------|
| `storage` | Stockage local de la clé API, préférences, dictionnaire personnel |
| `activeTab` | Accès au contenu de l'onglet actif uniquement |
| `contextMenus` | Menu contextuel (corriger, reformuler, traduire) |
| `https://albert.api.etalab.gouv.fr/*` | Seul domaine réseau autorisé |
| `compose` (Thunderbird) | Accès à la fenêtre de composition |
| `messagesRead` (Thunderbird) | Lecture du message pour traduction |

### Réseau

- **Unique destination :** le serveur API Albert configuré par l'utilisateur
- **Protocole :** HTTPS exclusivement (imposé par le domaine dans le manifest)
- **En-têtes :** `Authorization: Bearer <clé>`, `Content-Type: application/json`, `Accept: application/json`
- **Endpoints utilisés :** `/v1/chat/completions` (correction, reformulation, traduction), `/v1/me/info` (limites du compte), `/v1/me/usage` (compteur journalier rpd/tpd), `/v1/models` (résolution des alias)
- **Aucun CDN, aucun service tiers, aucune télémétrie**

### Stockage

- **Moteur :** `browser.storage.local` (protégé par Firefox, Thunderbird ou Brave selon la cible)
- **Données stockées :** clé API, URL du serveur, modèle, thème, mots ignorés, dernière langue de traduction
- **Aucune donnée synchronisée** (`browser.storage.sync` non utilisé)

## Modèle de menaces

| Menace | Mesure |
|--------|--------|
| Injection de code (XSS) | Utilisation systématique de `textContent` et `document.createTextNode()` pour tout contenu d'origine externe (texte de l'utilisateur, réponses de l'API). Les rares `innerHTML` ne reçoivent que des chaînes littérales du code. Aucun `eval()` ni `Function()`. |
| Réponse API malformée ou compromise | Validation structurelle des réponses JSON avant exploitation. Rejet avec message utilisateur si format inattendu. |
| Interception réseau (MITM) | HTTPS imposé par le manifest. Clé API transmise via en-tête Authorization (pas dans l'URL). |
| Extension malveillante tierce | Content Security Policy : `script-src 'self'` (`object-src 'none'` sous Firefox, `object-src 'self'` sous Brave). Aucun script inline. |
| Accès non autorisé aux données | Permissions minimales. Pas d'accès `<all_urls>` côté API. Stockage local protégé par le navigateur. Sous Brave, seules les trois icônes SVG du badge sont déclarées dans `web_accessible_resources` (aucune donnée exposée). |
| Détection de l'extension par les sites (fingerprinting) | Sous Brave, les ressources exposées utilisent `use_dynamic_url: true` : leur URL est un jeton tournant, ce qui empêche un site de sonder leur présence pour identifier l'utilisateur. |
| Abus de l'API (rate limiting) | Détection du code HTTP 429, lecture du Retry-After dans l'en-tête HTTP et dans le corps de la réponse, fenêtre glissante 60 s (`Albert.RollingWindow`), auto-fallback de modèle après deux 429 consécutifs (large -> medium -> small pendant 60 s), affichage du délai et du type de limite (rpm/rpd/tpm/tpd) à l'utilisateur. |

## Politique CSP

```
script-src 'self'; object-src 'none'    (Firefox, Thunderbird)
script-src 'self'; object-src 'self'     (Brave)
```

- Interdit l'exécution de scripts inline et de scripts chargés depuis des domaines tiers
- Interdit les plugins (Flash, Java, etc.)

## Pratiques de développement

- **Zéro dépendance externe** : aucun `npm install`, aucune bibliothèque tierce. Sous Brave, l'accès à l'API `browser.*` repose sur un alias maison d'une ligne vers `chrome.*` (`sources-brave/lib/browser-shim.js`), pas sur une bibliothèque externe.
- **Échappement systématique** : `textContent` et `createTextNode`, jamais `innerHTML`, pour toute donnée d'origine externe
- **Pas de code dynamique** : aucun `eval()`, `Function()`, `setTimeout(string)`
- **Validation d'entrée** : vérification du type et de la structure des réponses API
- **Tests de sécurité** : suite de tests incluant l'échappement HTML et les cas XSS (7+ cas)
- **Polices système** : aucune police externe chargée

## Conformité RGPD

- Aucun appel réseau en dehors du serveur API Albert configuré
- Détection de langue réalisée localement (pas d'appel externe)
- Les textes saisis ne transitent que vers le serveur API choisi par l'utilisateur
- Aucune collecte de données personnelles par l'extension
