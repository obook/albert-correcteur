# Conformite RGAA + Securite ANSSI -- Design

**Date :** 2026-03-28
**Objectif :** Atteindre la conformite aux bonnes pratiques ANSSI et au RGAA niveau AA, sans certification formelle, pour un deploiement institutionnel (Education nationale, collectivites).
**Perimetre :** Corrections techniques ciblees + documents de conformite. Pas de migration Manifest V3. Pas de refactoring d'architecture.

---

## 1. Corrections RGAA (accessibilite)

### 1.1 Focus trap dans les popups

- Quand une popup s'ouvre (correction, reformulation, traduction), le focus est capture a l'interieur.
- Tab / Shift+Tab cyclent entre les elements interactifs de la popup.
- Le focus est rendu a l'element declencheur a la fermeture.
- Implementation dans `albert-popup-common.js` (logique partagee par toutes les popups).

### 1.2 Indicateurs de focus visibles

- Ajout de styles `:focus-visible` sur tous les elements interactifs : badge, boutons des popups, selecteurs de mode, boutons navigation erreurs, liens.
- Outline de 2px avec offset, couleur adaptee au theme (sombre / clair).
- Fichiers concernes : `popup-light.css`, `popup-dark.css`, `badge.css`.

### 1.3 Ratios de contraste

- Verification des combinaisons existantes contre WCAG AA (4.5:1 texte normal, 3:1 grands textes).
- Ajustement des couleurs si necessaire -- en particulier l'orange grammaire (#f6993f) sur fond clair.
- Documentation des ratios dans la declaration d'accessibilite.

### 1.4 Hierarchie de titres dans les popups

- Ajout d'un `<h2>` visuellement masque (classe `.albert-sr-only`) dans chaque popup dynamique pour structurer le contenu pour les lecteurs d'ecran.

### 1.5 Attribut lang sur le contenu traduit

- Ajout de `lang="xx"` sur le conteneur du texte traduit, selon la langue cible selectionnee par l'utilisateur.

---

## 2. Renforcement securite ANSSI

### 2.1 Content Security Policy explicite

- Ajout de `content_security_policy` dans les deux `manifest.json` (Firefox et Thunderbird).
- Politique : `script-src 'self'; object-src 'none'; style-src 'self'`.
- Interdit l'execution de scripts inline, objets embarques, styles inline injectes.

### 2.2 Validation des reponses API

- Dans `service-api.js`, verifier la structure des reponses avant exploitation.
- Controler que les champs attendus (corrections, offsets, texte) sont presents et du bon type.
- Rejet propre avec message utilisateur si la reponse est malformee (protection contre API compromise ou proxy malveillant).

### 2.3 En-tetes de securite des requetes

- Ajout explicite de `Content-Type: application/json` et `Accept: application/json` sur les appels fetch.
- Verification que seules les reponses JSON sont traitees.

### 2.4 Elements deja conformes (pas de changement)

- Stockage : `browser.storage.local`, chiffre par Firefox.
- Permissions : deja minimales (`storage`, `activeTab`, `contextMenus`, domaine API unique).
- Zero dependance externe.
- Echappement XSS : `textContent` / `createTextNode` partout.
- Pas d'`eval()`, pas de `Function()`, pas d'`innerHTML` sur des donnees utilisateur.

---

## 3. Documents de conformite

### 3.1 Declaration d'accessibilite RGAA -- `ACCESSIBILITE.md`

Fichier a la racine du depot, conforme au modele DINUM :
- Etat de conformite (partielle ou totale).
- Technologies utilisees.
- Environnements de test (Firefox, Thunderbird, lecteur d'ecran).
- Liste des criteres RGAA verifies avec statut (conforme / non conforme / non applicable).
- Axes d'amelioration identifies.
- Contact pour signalement.

### 3.2 Fiche de securite ANSSI -- `SECURITE.md`

Fichier a la racine du depot, inspire du guide ANSSI de developpement securise :
- Surface d'attaque (permissions, reseau, stockage).
- Modele de menaces simplifie (donnees traitees, vecteurs d'attaque, mesures).
- Politique CSP.
- Gestion des donnees sensibles (cle API, texte utilisateur).
- Absence de dependances tierces.
- Pratiques de developpement (echappement, validation, pas d'eval).

### 3.3 Mention dans le README

- Ajout d'une section renvoyant vers `ACCESSIBILITE.md` et `SECURITE.md`.

---

## Decisions explicites

| Decision | Justification |
|----------|---------------|
| Rester en Manifest V2 | Thunderbird ne supporte pas V3 ; coherence Firefox/Thunderbird |
| Pas de Shadow DOM | Chantier distinct, risque architectural |
| Pas de tests axe-core | Chantier futur, le present se concentre sur les corrections |
| Pas de refactoring | Les corrections sont ciblees sur les manques identifies |

---

## Fichiers impactes (estimation)

| Fichier | Modification |
|---------|-------------|
| `sources-firefox/popup-contenu/albert-popup-common.js` | Focus trap |
| `sources-thunderbird/compose/compose-popup-common.js` | Focus trap (si existe) |
| `sources/css/popup-light.css` | Focus visible, contraste |
| `sources/css/popup-dark.css` | Focus visible, contraste |
| `sources-firefox/css/badge.css` | Focus visible |
| `sources-thunderbird/css/badge.css` | Focus visible |
| `sources-firefox/popup-contenu/albert-popup-correction.js` | Titre h2 sr-only |
| `sources-firefox/popup-contenu/albert-popup-reformulation.js` | Titre h2 sr-only |
| `sources-firefox/popup-contenu/albert-popup-traduction.js` | Titre h2 sr-only, lang |
| `sources-firefox/manifest.json` | CSP |
| `sources-thunderbird/manifest.json` | CSP |
| `sources/service/service-api.js` | Validation reponses, en-tetes |
| `ACCESSIBILITE.md` | Nouveau fichier |
| `SECURITE.md` | Nouveau fichier |
| `README.md` | Section conformite |
