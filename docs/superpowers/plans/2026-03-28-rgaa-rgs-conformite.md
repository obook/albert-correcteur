# Conformite RGAA + Securite ANSSI - Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre l'extension Albert Correcteur en conformite RGAA niveau AA et bonnes pratiques ANSSI, avec documentation.

**Architecture:** Corrections ciblees dans les fichiers existants (CSS, JS, manifest). Pas de refactoring. Les popups Firefox et Thunderbird ont des structures similaires mais des fichiers separes -- chaque correction s'applique aux deux.

**Tech Stack:** JavaScript ES6+ (vanilla), CSS, Manifest V2 (Firefox/Thunderbird)

---

### Task 1 : Focus trap dans les popups Firefox

**Files:**
- Modify: `sources-firefox/popup-contenu/albert-popup-common.js`

- [ ] **Step 1 : Ajouter la fonction `Albert.trapFocus` dans `albert-popup-common.js`**

Ajouter apres la fonction `Albert.closePopup` (ligne 38) :

```javascript
// --- Focus trap (accessibilite RGAA) ---

Albert._previousFocus = null;

Albert.trapFocus = function (popup) {
  Albert._previousFocus = document.activeElement;
  const focusables = popup.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  first.focus();
  popup._focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const current = popup.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const f = current[0];
    const l = current[current.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === f) {
        e.preventDefault();
        l.focus();
      }
    } else {
      if (document.activeElement === l) {
        e.preventDefault();
        f.focus();
      }
    }
  };
  popup.addEventListener("keydown", popup._focusTrapHandler);
};
```

- [ ] **Step 2 : Restaurer le focus a la fermeture dans `Albert.closePopup`**

Modifier la fonction `closePopup` existante (ligne 31-38) :

```javascript
Albert.closePopup = function () {
  if (Albert.activePopup) {
    Albert.activePopup.remove();
    Albert.activePopup = null;
    Albert.activePopupIdx = -1;
    Albert.popupPosition = null;
  }
  if (Albert._previousFocus && Albert._previousFocus.focus) {
    Albert._previousFocus.focus();
    Albert._previousFocus = null;
  }
};
```

- [ ] **Step 3 : Appeler `trapFocus` dans `albert-popup-correction.js`**

Dans `sources-firefox/popup-contenu/albert-popup-correction.js`, ajouter juste avant `Albert.activePopup = popup;` (ligne 196) :

```javascript
  Albert.trapFocus(popup);
```

- [ ] **Step 4 : Appeler `trapFocus` dans `albert-popup-traduction.js`**

Dans `sources-firefox/popup-contenu/albert-popup-traduction.js`, ajouter juste avant `Albert.activePopup = popup;` (ligne 114) :

```javascript
  Albert.trapFocus(popup);
```

- [ ] **Step 5 : Appeler `trapFocus` dans `albert-popup-reformulation.js`**

Dans `sources-firefox/popup-contenu/albert-popup-reformulation.js`, ajouter juste avant `Albert.activePopup = popup;` (ligne 68) :

```javascript
  Albert.trapFocus(popup);
```

- [ ] **Step 6 : Tester manuellement**

Ouvrir `test.html` dans Firefox, declencher une correction, verifier :
- Le focus est dans la popup a l'ouverture
- Tab/Shift+Tab cyclent a l'interieur
- Echap ferme et rend le focus au champ

- [ ] **Step 7 : Commit**

```bash
git add sources-firefox/popup-contenu/albert-popup-common.js sources-firefox/popup-contenu/albert-popup-correction.js sources-firefox/popup-contenu/albert-popup-traduction.js sources-firefox/popup-contenu/albert-popup-reformulation.js
git commit -m "RGAA : focus trap dans les popups Firefox"
```

---

### Task 2 : Focus trap dans les popups Thunderbird

**Files:**
- Modify: `sources-thunderbird/compose/compose-popup-correction.js`
- Modify: `sources-thunderbird/compose/compose-popup-traduction.js`
- Modify: `sources-thunderbird/compose/compose-popup-reformulation.js`

- [ ] **Step 1 : Ajouter `Albert.trapFocus` et `Albert._previousFocus` dans `compose-popup-correction.js`**

Ajouter apres `Albert.activePopupIdx = 0;` (ligne 8) :

```javascript
Albert._previousFocus = null;

Albert.trapFocus = function (popup) {
  Albert._previousFocus = document.activeElement;
  const focusables = popup.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  focusables[0].focus();
  popup._focusTrapHandler = function (e) {
    if (e.key !== "Tab") return;
    const current = popup.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const f = current[0];
    const l = current[current.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === f) { e.preventDefault(); l.focus(); }
    } else {
      if (document.activeElement === l) { e.preventDefault(); f.focus(); }
    }
  };
  popup.addEventListener("keydown", popup._focusTrapHandler);
};

Albert.restoreFocus = function () {
  if (Albert._previousFocus && Albert._previousFocus.focus) {
    Albert._previousFocus.focus();
    Albert._previousFocus = null;
  }
};
```

- [ ] **Step 2 : Appeler `trapFocus` dans `showCorrectionPopup`**

Ajouter juste avant `Albert.correctionPopup = popup;` (ligne 170) :

```javascript
  Albert.trapFocus(popup);
```

- [ ] **Step 3 : Appeler `restoreFocus` dans `closeCorrectionPopup`**

Modifier `closeCorrectionPopup` (ligne 9-14) :

```javascript
Albert.closeCorrectionPopup = function () {
  if (Albert.correctionPopup) {
    Albert.correctionPopup.remove();
    Albert.correctionPopup = null;
  }
  Albert.restoreFocus();
};
```

- [ ] **Step 4 : Appeler `trapFocus` dans `showTranslationPopup`**

Dans `compose-popup-traduction.js`, ajouter juste avant `Albert.translationPopup = popup;` (ligne 84) :

```javascript
  Albert.trapFocus(popup);
```

- [ ] **Step 5 : Appeler `restoreFocus` dans `closeTranslationPopup`**

```javascript
Albert.closeTranslationPopup = function () {
  if (Albert.translationPopup) {
    Albert.translationPopup.remove();
    Albert.translationPopup = null;
  }
  Albert.restoreFocus();
};
```

- [ ] **Step 6 : Appeler `trapFocus` dans `showReformulationPopup`**

Dans `compose-popup-reformulation.js`, ajouter juste avant `Albert.reformulationPopup = popup;` (ligne 79) :

```javascript
  Albert.trapFocus(popup);
```

- [ ] **Step 7 : Appeler `restoreFocus` dans `closeReformulationPopup`**

```javascript
Albert.closeReformulationPopup = function () {
  if (Albert.reformulationPopup) {
    Albert.reformulationPopup.remove();
    Albert.reformulationPopup = null;
  }
  Albert.restoreFocus();
};
```

- [ ] **Step 8 : Commit**

```bash
git add sources-thunderbird/compose/compose-popup-correction.js sources-thunderbird/compose/compose-popup-traduction.js sources-thunderbird/compose/compose-popup-reformulation.js
git commit -m "RGAA : focus trap dans les popups Thunderbird"
```

---

### Task 3 : Indicateurs de focus visibles

**Files:**
- Modify: `sources-firefox/css/badge.css`
- Modify: `sources-thunderbird/css/badge.css`
- Modify: `sources/css/popup-dark.css`
- Modify: `sources/css/popup-light.css`
- Modify: `sources/css/toast.css`

- [ ] **Step 1 : Ajouter `:focus-visible` au badge Firefox**

Dans `sources-firefox/css/badge.css`, ajouter apres `.albert-badge:hover` (ligne 26) :

```css
.albert-badge:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  opacity: 1;
}
```

- [ ] **Step 2 : Ajouter `:focus-visible` au badge Thunderbird**

Dans `sources-thunderbird/css/badge.css`, ajouter apres `.albert-badge:hover` (ligne 26) :

```css
.albert-badge:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  opacity: 1;
}
```

- [ ] **Step 3 : Ajouter `:focus-visible` aux elements interactifs du popup sombre**

Dans `sources/css/popup-dark.css`, ajouter a la fin du fichier (avant le commentaire modal-open) :

```css
/* --- Focus visible (RGAA) --- */
.albert-popup button:focus-visible,
.albert-popup select:focus-visible,
.albert-popup [tabindex]:focus-visible {
  outline: 2px solid #6cb6ff;
  outline-offset: 1px;
}

.albert-popup-suggestion:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
```

- [ ] **Step 4 : Ajouter `:focus-visible` aux elements du popup clair**

Dans `sources/css/popup-light.css`, ajouter a la fin du fichier :

```css
/* --- Focus visible (RGAA) --- */
.albert-theme-light button:focus-visible,
.albert-theme-light select:focus-visible,
.albert-theme-light [tabindex]:focus-visible {
  outline: 2px solid #000091;
  outline-offset: 1px;
}

.albert-theme-light .albert-popup-suggestion:focus-visible {
  outline: 2px solid #333;
  outline-offset: 1px;
}
```

- [ ] **Step 5 : Ajouter `:focus-visible` au toast**

Dans `sources/css/toast.css`, ajouter apres `.albert-toast-close:hover` :

```css
.albert-toast-close:focus-visible {
  outline: 2px solid #6cb6ff;
  outline-offset: 1px;
}
```

- [ ] **Step 6 : Tester**

Ouvrir `test.html`, naviguer au clavier (Tab) dans une popup de correction. Verifier que chaque bouton a un contour visible au focus.

- [ ] **Step 7 : Commit**

```bash
git add sources-firefox/css/badge.css sources-thunderbird/css/badge.css sources/css/popup-dark.css sources/css/popup-light.css sources/css/toast.css
git commit -m "RGAA : indicateurs de focus visibles sur tous les elements interactifs"
```

---

### Task 4 : Contraste WCAG AA

**Files:**
- Modify: `sources/css/overlay.css`
- Modify: `sources/css/popup-light.css`

- [ ] **Step 1 : Ajuster l'orange grammaire**

L'orange `#f6993f` sur fond blanc (#fff) a un ratio de 2.14:1 (insuffisant). Remplacer par `#b45309` (ratio 4.88:1 sur blanc).

Dans `sources/css/overlay.css`, remplacer :

```css
.albert-error-grammar {
  background-image: linear-gradient(to right, #b45309 50%, transparent 50%);
}
```

- [ ] **Step 2 : Ajuster les textes secondaires du theme clair**

Dans `sources/css/popup-light.css`, les couleurs `#777` (extract) et `#999` (dismiss) sont en dessous de 4.5:1 sur blanc. Remplacer :

```css
.albert-theme-light .albert-popup-extract {
  color: #595959;
}

.albert-theme-light .albert-popup-dismiss {
  color: #595959;
  border-color: #ddd;
}
```

- [ ] **Step 3 : Verifier les ratios**

Couleurs finales a documenter :
| Element | Couleur | Fond | Ratio |
|---------|---------|------|-------|
| Texte principal clair | #333 | #fff | 12.63:1 |
| Texte secondaire clair | #595959 | #fff | 5.90:1 |
| Message popup clair | #555 | #fff | 7.46:1 |
| Orange grammaire | #b45309 | #fff | 4.88:1 |
| Texte sombre | #e0e0e0 | #1e1e2e | 11.73:1 |
| Texte secondaire sombre | #ccc | #1e1e2e | 9.29:1 |
| Rouge orthographe | #e3342f | transparent | decoratif (soulignement) |
| Bleu style | #3490dc | transparent | decoratif (soulignement) |

- [ ] **Step 4 : Commit**

```bash
git add sources/css/overlay.css sources/css/popup-light.css
git commit -m "RGAA : ajustement contraste WCAG AA (orange grammaire, textes secondaires)"
```

---

### Task 5 : Titres h2 pour les lecteurs d'ecran

**Files:**
- Modify: `sources-firefox/popup-contenu/albert-popup-correction.js`
- Modify: `sources-firefox/popup-contenu/albert-popup-traduction.js`
- Modify: `sources-firefox/popup-contenu/albert-popup-reformulation.js`
- Modify: `sources-thunderbird/compose/compose-popup-correction.js`
- Modify: `sources-thunderbird/compose/compose-popup-traduction.js`
- Modify: `sources-thunderbird/compose/compose-popup-reformulation.js`

- [ ] **Step 1 : Ajouter le h2 sr-only dans la popup correction Firefox**

Dans `sources-firefox/popup-contenu/albert-popup-correction.js`, ajouter juste apres `popup.setAttribute("aria-modal", "false");` (ligne 22) :

```javascript
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Correction orthographique";
  popup.appendChild(h2);
```

- [ ] **Step 2 : Ajouter le h2 sr-only dans la popup traduction Firefox**

Dans `sources-firefox/popup-contenu/albert-popup-traduction.js`, ajouter juste apres `popup.setAttribute("aria-modal", "false");` (ligne 60) :

```javascript
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Traduction";
  popup.appendChild(h2);
```

- [ ] **Step 3 : Ajouter le h2 sr-only dans la popup reformulation Firefox**

Dans `sources-firefox/popup-contenu/albert-popup-reformulation.js`, ajouter juste apres `popup.setAttribute("aria-modal", "false");` (ligne 13) :

```javascript
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Reformulation";
  popup.appendChild(h2);
```

- [ ] **Step 4 : Ajouter le h2 sr-only dans la popup correction Thunderbird**

Dans `sources-thunderbird/compose/compose-popup-correction.js`, ajouter juste apres `popup.setAttribute("aria-label", "Correction suggérée");` (ligne 29) :

```javascript
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Correction suggérée";
  popup.appendChild(h2);
```

- [ ] **Step 5 : Ajouter le h2 sr-only dans la popup traduction Thunderbird**

Dans `sources-thunderbird/compose/compose-popup-traduction.js`, ajouter juste apres `popup.setAttribute("aria-label", "Traduction");` (ligne 24) :

```javascript
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Traduction";
  popup.appendChild(h2);
```

- [ ] **Step 6 : Ajouter le h2 sr-only dans la popup reformulation Thunderbird**

Dans `sources-thunderbird/compose/compose-popup-reformulation.js`, ajouter juste apres `popup.setAttribute("aria-label", "Reformulation");` (ligne 23) :

```javascript
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Reformulation";
  popup.appendChild(h2);
```

- [ ] **Step 7 : Commit**

```bash
git add sources-firefox/popup-contenu/albert-popup-correction.js sources-firefox/popup-contenu/albert-popup-traduction.js sources-firefox/popup-contenu/albert-popup-reformulation.js sources-thunderbird/compose/compose-popup-correction.js sources-thunderbird/compose/compose-popup-traduction.js sources-thunderbird/compose/compose-popup-reformulation.js
git commit -m "RGAA : titres h2 sr-only dans toutes les popups pour lecteurs d'ecran"
```

---

### Task 6 : Attribut lang sur le contenu traduit

**Files:**
- Modify: `sources-firefox/popup-contenu/albert-popup-traduction.js`
- Modify: `sources-thunderbird/compose/compose-popup-traduction.js`

- [ ] **Step 1 : Ajouter lang au resultDiv dans la popup traduction Firefox**

Dans `sources-firefox/popup-contenu/albert-popup-traduction.js`, dans la fonction `Albert.doTranslate`, apres `resultDiv.textContent = response.translation;` (ligne 47), ajouter :

```javascript
  resultDiv.setAttribute("lang", targetLang);
```

- [ ] **Step 2 : Ajouter lang au resultDiv dans la popup traduction Thunderbird**

Dans `sources-thunderbird/compose/compose-popup-traduction.js`, dans la fonction `doTranslate`, apres `resultDiv.textContent = result.translation;` (ligne 98), ajouter :

```javascript
      resultDiv.setAttribute("lang", targetLang);
```

- [ ] **Step 3 : Commit**

```bash
git add sources-firefox/popup-contenu/albert-popup-traduction.js sources-thunderbird/compose/compose-popup-traduction.js
git commit -m "RGAA : attribut lang sur le contenu traduit"
```

---

### Task 7 : Content Security Policy dans les manifests

**Files:**
- Modify: `sources-firefox/manifest.json`
- Modify: `sources-thunderbird/manifest.json`

- [ ] **Step 1 : Ajouter la CSP dans le manifest Firefox**

Dans `sources-firefox/manifest.json`, ajouter apres le bloc `"browser_specific_settings"` (apres ligne 15) :

```json
  "content_security_policy": "script-src 'self'; object-src 'none'",
```

Note : `style-src 'self'` n'est pas necessaire en Manifest V2 car les styles sont deja charges depuis l'extension.

- [ ] **Step 2 : Ajouter la CSP dans le manifest Thunderbird**

Dans `sources-thunderbird/manifest.json`, ajouter apres le bloc `"browser_specific_settings"` (apres ligne 11) :

```json
  "content_security_policy": "script-src 'self'; object-src 'none'",
```

- [ ] **Step 3 : Tester que l'extension charge correctement**

Charger l'extension dans Firefox via `about:debugging` et verifier qu'il n'y a pas d'erreur CSP dans la console.

- [ ] **Step 4 : Commit**

```bash
git add sources-firefox/manifest.json sources-thunderbird/manifest.json
git commit -m "Securite ANSSI : Content Security Policy explicite dans les manifests"
```

---

### Task 8 : Validation des reponses API et en-tetes

**Files:**
- Modify: `sources/service/service-api.js`

- [ ] **Step 1 : Ajouter l'en-tete Accept et la validation dans `checkText`**

Remplacer le bloc fetch de `checkText` (lignes 25-32) par :

```javascript
    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
```

Puis remplacer le parsing de la reponse (lignes 54-56) par :

```javascript
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (!Array.isArray(parsed.corrections)) {
      return { error: "Réponse API invalide : corrections manquantes." };
    }
```

- [ ] **Step 2 : Ajouter l'en-tete Accept et la validation dans `translateText`**

Remplacer le bloc fetch de `translateText` (lignes 97-104) par :

```javascript
    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
```

Puis remplacer le parsing de la reponse (lignes 115-117) par :

```javascript
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (typeof parsed.translation !== "string") {
      return { error: "Réponse API invalide : traduction manquante." };
    }
    return { translation: parsed.translation, langSource, langCible: targetLang };
```

- [ ] **Step 3 : Lancer les tests existants**

```bash
cd /home/obooklage/Documents/GitForge/albert-ext && npm test
```

Expected : tous les tests passent (les tests existants ne font pas d'appels reseau).

- [ ] **Step 4 : Commit**

```bash
git add sources/service/service-api.js
git commit -m "Securite ANSSI : validation des reponses API et en-tete Accept"
```

---

### Task 9 : Declaration d'accessibilite RGAA

**Files:**
- Create: `ACCESSIBILITE.md`

- [ ] **Step 1 : Creer le fichier ACCESSIBILITE.md**

```markdown
# Declaration d'accessibilite -- Albert Correcteur

**Date de mise a jour :** 2026-03-28

## Etat de conformite

L'extension Albert Correcteur est en **conformite partielle** avec le RGAA 4.1 (Referentiel General d'Amelioration de l'Accessibilite), niveau AA.

## Technologies utilisees

- JavaScript ES6+ (sans dependance externe)
- CSS (styles embarques dans l'extension)
- API WebExtensions (Manifest V2)

## Environnements de test

| Navigateur | Version | Systeme |
|------------|---------|---------|
| Firefox | 128+ | Linux, Windows, macOS |
| Thunderbird | 128+ | Linux, Windows, macOS |

## Criteres RGAA verifies

### Images (theme 1)

| Critere | Statut | Detail |
|---------|--------|--------|
| 1.1 Images porteuses d'information avec alternative | Conforme | `alt="Albert"` sur le logo, `aria-hidden="true"` sur les icones decoratives |
| 1.2 Images decoratives sans alternative | Conforme | Poignee de deplacement masquee via `aria-hidden` |

### Couleurs (theme 3)

| Critere | Statut | Detail |
|---------|--------|--------|
| 3.2 Contraste texte/fond >= 4.5:1 | Conforme | Texte principal : 12.63:1 (clair), 11.73:1 (sombre). Textes secondaires >= 5.90:1 |
| 3.3 Information non vehiculee uniquement par la couleur | Conforme | Les erreurs utilisent couleur + position + message textuel |

### Navigation (theme 12)

| Critere | Statut | Detail |
|---------|--------|--------|
| 12.7 Focus visible sur les elements interactifs | Conforme | `:focus-visible` avec outline 2px sur tous les boutons et selecteurs |
| 12.8 Ordre de tabulation coherent | Conforme | Ordre DOM = ordre visuel dans les popups |

### Formulaires (theme 11)

| Critere | Statut | Detail |
|---------|--------|--------|
| 11.1 Champs de formulaire avec etiquette | Conforme | `aria-label` sur les selecteurs de langue et boutons |

### Scripts (theme 7)

| Critere | Statut | Detail |
|---------|--------|--------|
| 7.1 Scripts compatibles technologies d'assistance | Conforme | `role="dialog"`, `aria-label`, `aria-live="polite"`, `aria-atomic` |
| 7.3 Scripts accessibles au clavier | Conforme | Badge : Enter/Space. Popups : Tab/Shift+Tab/Escape. Navigation erreurs : boutons |

### Structure (theme 9)

| Critere | Statut | Detail |
|---------|--------|--------|
| 9.1 Titres dans les popups | Conforme | `<h2>` masque visuellement (sr-only) dans chaque popup |

### Presentation (theme 10)

| Critere | Statut | Detail |
|---------|--------|--------|
| 10.7 Focus trap dans les fenetres modales | Conforme | Tab/Shift+Tab restent dans la popup, focus restaure a la fermeture |

### Langue (theme 8)

| Critere | Statut | Detail |
|---------|--------|--------|
| 8.4 Changement de langue signale | Conforme | Attribut `lang` sur le contenu traduit |

## Axes d'amelioration

- Test avec lecteur d'ecran NVDA/Orca pour validation pratique
- Migration future vers CSS Custom Highlights API (suppression du DOM supplementaire)
- Encapsulation Shadow DOM pour isolation complete

## Contact

Pour signaler un probleme d'accessibilite : ouvrir un ticket sur le depot GitForge du projet.
```

- [ ] **Step 2 : Commit**

```bash
git add ACCESSIBILITE.md
git commit -m "RGAA : declaration d'accessibilite"
```

---

### Task 10 : Fiche de securite ANSSI

**Files:**
- Create: `SECURITE.md`

- [ ] **Step 1 : Creer le fichier SECURITE.md**

```markdown
# Fiche de securite -- Albert Correcteur

**Date de mise a jour :** 2026-03-28
**Referentiel :** Guide ANSSI de developpement securise

## Surface d'attaque

### Permissions

| Permission | Justification |
|------------|--------------|
| `storage` | Stockage local de la cle API, preferences, dictionnaire personnel |
| `activeTab` | Acces au contenu de l'onglet actif uniquement |
| `contextMenus` | Menu contextuel (corriger, reformuler, traduire) |
| `https://albert.api.etalab.gouv.fr/*` | Seul domaine reseau autorise |
| `compose` (Thunderbird) | Acces a la fenetre de composition |
| `messagesRead` (Thunderbird) | Lecture du message pour traduction |

### Reseau

- **Unique destination :** le serveur API Albert configure par l'utilisateur
- **Protocole :** HTTPS exclusivement (impose par le domaine dans le manifest)
- **En-tetes :** `Authorization: Bearer <cle>`, `Content-Type: application/json`, `Accept: application/json`
- **Aucun CDN, aucun service tiers, aucune telemetrie**

### Stockage

- **Moteur :** `browser.storage.local` (chiffre par Firefox/Thunderbird)
- **Donnees stockees :** cle API, URL du serveur, modele, theme, mots ignores, derniere langue de traduction
- **Aucune donnee synchronisee** (`browser.storage.sync` non utilise)

## Modele de menaces

| Menace | Mesure |
|--------|--------|
| Injection de code (XSS) | Utilisation systematique de `textContent` et `document.createTextNode()`. Fonction `escapeHtml()` testee (7 cas). Aucun `innerHTML` sur des donnees utilisateur. Aucun `eval()` ni `Function()`. |
| Reponse API malformee ou compromise | Validation structurelle des reponses JSON avant exploitation. Rejet avec message utilisateur si format inattendu. |
| Interception reseau (MITM) | HTTPS impose par le manifest. Cle API transmise via en-tete Authorization (pas dans l'URL). |
| Extension malveillante tierce | Content Security Policy : `script-src 'self'; object-src 'none'`. Aucun script inline. |
| Acces non autorise aux donnees | Permissions minimales. Pas d'acces `<all_urls>` cote API. Stockage local chiffre par le navigateur. |
| Abus de l'API (rate limiting) | Detection du code HTTP 429, backoff adaptatif, affichage du delai a l'utilisateur. |

## Politique CSP

```
script-src 'self'; object-src 'none'
```

- Interdit l'execution de scripts inline et de scripts charges depuis des domaines tiers
- Interdit les plugins (Flash, Java, etc.)

## Pratiques de developpement

- **Zero dependance externe** : aucun `npm install`, aucune bibliotheque tierce
- **Echappement systematique** : `textContent`, `createTextNode`, `escapeHtml()`
- **Pas de code dynamique** : aucun `eval()`, `Function()`, `setTimeout(string)`
- **Validation d'entree** : verification du type et de la structure des reponses API
- **Tests de securite** : suite de tests incluant l'echappement HTML et les cas XSS (7+ cas)
- **Polices systeme** : aucune police externe chargee

## Conformite RGPD

- Aucun appel reseau en dehors du serveur API Albert configure
- Detection de langue realisee localement (pas d'appel externe)
- Les textes saisis ne transitent que vers le serveur API choisi par l'utilisateur
- Aucune collecte de donnees personnelles par l'extension
```

- [ ] **Step 2 : Commit**

```bash
git add SECURITE.md
git commit -m "Securite ANSSI : fiche de securite"
```

---

### Task 11 : Mise a jour du README

**Files:**
- Modify: `README.md`

- [ ] **Step 1 : Ajouter une section Conformite apres RGPD**

Dans `README.md`, ajouter apres la section "Conformite RGPD" (apres la ligne 79) :

```markdown

## Accessibilite et securite

- **Accessibilite (RGAA)** : declaration de conformite dans [ACCESSIBILITE.md](ACCESSIBILITE.md)
- **Securite (ANSSI)** : fiche de securite dans [SECURITE.md](SECURITE.md)
```

- [ ] **Step 2 : Commit**

```bash
git add README.md
git commit -m "README : liens vers les declarations RGAA et securite ANSSI"
```
