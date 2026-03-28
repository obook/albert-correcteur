# Extension Thunderbird Albert Correcteur - Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une extension Thunderbird avec parité complète (correction, reformulation, traduction) en réorganisant le code pour partager la couche service entre Firefox et Thunderbird.

**Architecture:** Le code partagé (service API, prompts, icônes) reste dans `sources/`. Le code spécifique Firefox migre dans `sources-firefox/`. Le code spécifique Thunderbird est créé dans `sources-thunderbird/`. Les scripts de build assemblent sources/ + sources-{platform}/ en .xpi. L'extension Thunderbird utilise Manifest V2 avec `composeScripts.register()` pour injecter les scripts dans la fenêtre de composition.

**Tech Stack:** JavaScript ES6+ vanilla, API WebExtensions (MV2), API Thunderbird MailExtensions (`compose`, `composeScripts`, `menus`), pas de dépendance externe.

---

## Structure de fichiers cible

```
albert-ext/
  sources/                          # Code partagé (identique Firefox + Thunderbird)
    service/
      service-config.js
      service-langue.js
      service-prompts.js
      service-limites.js
      service-api.js
    prompts/
      correction.txt
      reformulation.txt
      traduction.txt
    icons/
      icon.svg, icon-error.svg, icon-48.png, icon-96.png, icon-128.png

  sources-firefox/                  # Code spécifique Firefox
    manifest.json
    service/
      service-menus.js              # contextMenus + dispatch (Firefox)
    etat/
      albert-state.js
      albert-utils.js
    affichage/
      albert-badge.js
      albert-render-arialive.js
      albert-render-overlay.js
      albert-render.js
    correction/
      albert-apply.js
      albert-apply-rich.js
      albert-apply-segments.js
    popup-contenu/
      albert-popup-common.js
      albert-popup-correction.js
      albert-popup-reformulation.js
      albert-popup-traduction.js
      albert-popup-messages.js
    notification/
      albert-toast.js
    verification/
      albert-check.js
      albert-debounce.js
      albert-limites.js
    demarrage/
      albert-main.js
    popup-configuration/
      popup.html, popup.css, popup.js
      popup-limits.js, popup-models.js, popup-status.js
      popup-settings.html, popup-settings.css, popup-settings.js
    css/
      badge.css, overlay.css, popup-dark.css, popup-light.css, toast.css

  sources-thunderbird/              # Code spécifique Thunderbird
    manifest.json
    service/
      service-menus.js              # menus compose_body + dispatch (Thunderbird)
      service-compose-scripts.js    # Enregistrement des compose scripts
    compose/
      compose-state.js              # Constantes et état pour le compose
      compose-utils.js              # Utilitaires spécifiques compose
      compose-badge.js              # Badge dans le compose
      compose-overlay.js            # Overlay soulignements dans le compose
      compose-render.js             # Orchestration rendu
      compose-popup-correction.js   # Popup de correction
      compose-popup-reformulation.js# Popup de reformulation
      compose-popup-traduction.js   # Popup de traduction
      compose-popup-messages.js     # Dispatch messages background
      compose-apply.js              # Application des corrections
      compose-toast.js              # Notifications toast
      compose-check.js              # Déclenchement vérification
      compose-debounce.js           # Debounce adaptatif
      compose-limites.js            # Vérification limites côté client
      compose-main.js               # Point d'entrée compose
    popup-configuration/
      popup.html, popup.css, popup.js
      popup-limits.js, popup-models.js, popup-status.js
      popup-settings.html, popup-settings.css, popup-settings.js
    css/
      badge.css, overlay.css, popup-dark.css, popup-light.css, toast.css

  firefox-build.sh                  # Assemble sources/ + sources-firefox/ -> .xpi
  thunderbird-build.sh              # Assemble sources/ + sources-thunderbird/ -> .xpi
  firefox-release/
  thunderbird-release/
```

---

## Task 1 : Réorganiser sources/ - extraire le code partagé

**Files:**
- Déplacer : `sources/service/service-menus.js` -> `sources-firefox/service/service-menus.js`
- Déplacer : `sources/manifest.json` -> `sources-firefox/manifest.json`
- Déplacer : `sources/etat/` -> `sources-firefox/etat/`
- Déplacer : `sources/affichage/` -> `sources-firefox/affichage/`
- Déplacer : `sources/correction/` -> `sources-firefox/correction/`
- Déplacer : `sources/popup-contenu/` -> `sources-firefox/popup-contenu/`
- Déplacer : `sources/popup-configuration/` -> `sources-firefox/popup-configuration/`
- Déplacer : `sources/notification/` -> `sources-firefox/notification/`
- Déplacer : `sources/verification/` -> `sources-firefox/verification/`
- Déplacer : `sources/demarrage/` -> `sources-firefox/demarrage/`
- Déplacer : `sources/css/` -> `sources-firefox/css/`
- Conserver dans `sources/` : `service/service-config.js`, `service/service-langue.js`, `service/service-prompts.js`, `service/service-limites.js`, `service/service-api.js`, `prompts/`, `icons/`

- [ ] **Step 1 : Créer la structure sources-firefox/**

```bash
mkdir -p sources-firefox/service
```

- [ ] **Step 2 : Déplacer les fichiers spécifiques Firefox**

```bash
git mv sources/manifest.json sources-firefox/manifest.json
git mv sources/service/service-menus.js sources-firefox/service/service-menus.js
git mv sources/etat sources-firefox/etat
git mv sources/affichage sources-firefox/affichage
git mv sources/correction sources-firefox/correction
git mv sources/popup-contenu sources-firefox/popup-contenu
git mv sources/popup-configuration sources-firefox/popup-configuration
git mv sources/notification sources-firefox/notification
git mv sources/verification sources-firefox/verification
git mv sources/demarrage sources-firefox/demarrage
git mv sources/css sources-firefox/css
```

- [ ] **Step 3 : Vérifier que sources/ ne contient plus que le code partagé**

```bash
ls sources/
# Attendu : service/ prompts/ icons/
ls sources/service/
# Attendu : service-config.js service-langue.js service-prompts.js service-limites.js service-api.js
```

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "Réorganisation : extraction du code partagé dans sources/, code Firefox dans sources-firefox/"
```

---

## Task 2 : Adapter firefox-build.sh pour assembler sources/ + sources-firefox/

**Files:**
- Modifier : `firefox-build.sh`

- [ ] **Step 1 : Modifier firefox-build.sh**

```bash
#!/bin/bash
# Construit le fichier .xpi pour installation directe dans Firefox.
# Assemble sources/ (code partagé) + sources-firefox/ (code spécifique).
# Usage : ./firefox-build.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/sources"
FIREFOX_DIR="$SCRIPT_DIR/sources-firefox"
OUT_DIR="$SCRIPT_DIR/firefox-release"
BUILD_DIR="$SCRIPT_DIR/.build-firefox"
OUT="$OUT_DIR/albert-correcteur.xpi"

# Vérifier que les dossiers source existent
if [ ! -d "$COMMON_DIR" ]; then
    echo "Erreur : le dossier sources/ est introuvable."
    exit 1
fi
if [ ! -d "$FIREFOX_DIR" ]; then
    echo "Erreur : le dossier sources-firefox/ est introuvable."
    exit 1
fi

# Nettoyer et préparer le dossier d'assemblage
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copier le code partagé puis le code spécifique Firefox (écrase si conflit)
cp -r "$COMMON_DIR"/* "$BUILD_DIR"/
cp -r "$FIREFOX_DIR"/* "$BUILD_DIR"/

# Créer le dossier de release et supprimer l'ancien .xpi
mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Créer le .xpi (c'est un simple fichier ZIP)
cd "$BUILD_DIR"
zip -r "$OUT" . -x ".*"

# Nettoyer
rm -rf "$BUILD_DIR"

echo ""
echo "Extension packagée : $OUT"
echo ""
echo "Pour installer dans Firefox :"
echo "  1. Ouvrir about:addons"
echo "  2. Roue dentée -> Installer un module depuis un fichier..."
echo "  3. Sélectionner albert-correcteur.xpi"
```

- [ ] **Step 2 : Tester le build Firefox**

```bash
./firefox-build.sh
# Vérifier que le .xpi est créé
ls -la firefox-release/albert-correcteur.xpi
# Vérifier le contenu du .xpi
unzip -l firefox-release/albert-correcteur.xpi | head -40
# Doit contenir : manifest.json, service/, prompts/, icons/, etat/, affichage/, etc.
```

- [ ] **Step 3 : Commit**

```bash
git add firefox-build.sh
git commit -m "firefox-build.sh : assemblage sources/ + sources-firefox/"
```

---

## Task 3 : Adapter le CI/CD (.gitlab-ci.yml) pour la nouvelle structure

**Files:**
- Modifier : `.gitlab-ci.yml`

- [ ] **Step 1 : Modifier le stage build pour assembler les deux dossiers**

Remplacer dans le stage `build` :

```yaml
  script:
    - VERSION="${CI_COMMIT_TAG#v}"
    - XPI_NAME="albert-correcteur_${VERSION}.xpi"
    - mkdir -p .build-firefox
    - cp -r sources/* .build-firefox/
    - cp -r sources-firefox/* .build-firefox/
    - cd .build-firefox
    - zip -r "../${XPI_NAME}" . -x ".*"
    - cd ..
    - rm -rf .build-firefox
    - echo "XPI_NAME=${XPI_NAME}" > build.env
    - echo "VERSION=${VERSION}" >> build.env
    - echo "Extension packagée -> ${XPI_NAME}"
```

- [ ] **Step 2 : Modifier le stage sign pour pointer vers le bon dossier source**

Dans le stage `sign`, remplacer la commande `web-ext sign` :

```yaml
    - mkdir -p .build-firefox
    - cp -r sources/* .build-firefox/
    - cp -r sources-firefox/* .build-firefox/
    - web-ext sign --source-dir=.build-firefox/ --channel=unlisted --api-key="${WEB_EXT_API_KEY}" --api-secret="${WEB_EXT_API_SECRET}" || true
    - rm -rf .build-firefox
```

- [ ] **Step 3 : Commit**

```bash
git add .gitlab-ci.yml
git commit -m "CI : adaptation build et sign pour la nouvelle structure sources/ + sources-firefox/"
```

---

## Task 4 : Adapter les tests pour la nouvelle arborescence

**Files:**
- Modifier : `tests/test-structure.js` (les tests qui vérifient l'existence des fichiers)
- Vérifier : tous les autres tests (ceux-ci importent des fonctions, pas des chemins)

- [ ] **Step 1 : Lire tests/test-structure.js et identifier les chemins codés en dur**

Lire le fichier et mettre à jour tous les chemins de `sources/` vers `sources/` ou `sources-firefox/` selon le fichier.

Par exemple :
- `sources/manifest.json` -> `sources-firefox/manifest.json`
- `sources/service/service-config.js` -> `sources/service/service-config.js` (inchangé)
- `sources/etat/albert-state.js` -> `sources-firefox/etat/albert-state.js`
- etc.

- [ ] **Step 2 : Lancer tous les tests**

```bash
for f in tests/test-*.js; do echo "-- $(basename $f) --" && node "$f"; done
```

Attendu : tous les tests passent.

- [ ] **Step 3 : Commit**

```bash
git add tests/
git commit -m "Tests : adaptation des chemins pour la nouvelle structure"
```

---

## Task 5 : Créer sources-thunderbird/manifest.json

**Files:**
- Créer : `sources-thunderbird/manifest.json`

- [ ] **Step 1 : Créer le manifest Thunderbird**

```json
{
  "manifest_version": 2,
  "name": "Albert Correcteur",
  "version": "0.1.0",
  "description": "Extension de correction orthographique, grammaticale et de traduction pour Thunderbird, propulsée par l'API Albert (DINUM).",
  "browser_specific_settings": {
    "gecko": {
      "id": "albert-correcteur-thunderbird@ac-bordeaux.fr",
      "strict_min_version": "128.0"
    }
  },
  "permissions": [
    "compose",
    "storage",
    "menus",
    "https://albert.api.etalab.gouv.fr/*"
  ],
  "icons": {
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png",
    "128": "icons/icon-128.png"
  },
  "compose_action": {
    "default_icon": "icons/icon-48.png",
    "default_popup": "popup-configuration/popup.html",
    "default_title": "Albert Correcteur"
  },
  "options_ui": {
    "page": "popup-configuration/popup-settings.html",
    "open_in_tab": false
  },
  "background": {
    "scripts": [
      "service/service-config.js",
      "service/service-langue.js",
      "service/service-prompts.js",
      "service/service-limites.js",
      "service/service-api.js",
      "service/service-menus.js",
      "service/service-compose-scripts.js"
    ]
  }
}
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/manifest.json
git commit -m "Thunderbird : manifest.json initial (MV2, compose, menus)"
```

---

## Task 6 : Créer service-compose-scripts.js (enregistrement des scripts compose)

**Files:**
- Créer : `sources-thunderbird/service/service-compose-scripts.js`

- [ ] **Step 1 : Créer le script d'enregistrement**

```javascript
// service-compose-scripts.js --- Enregistrement des scripts dans la fenêtre de composition Thunderbird.

"use strict";

browser.composeScripts.register({
  js: [
    { file: "compose/compose-state.js" },
    { file: "compose/compose-utils.js" },
    { file: "compose/compose-badge.js" },
    { file: "compose/compose-overlay.js" },
    { file: "compose/compose-render.js" },
    { file: "compose/compose-popup-correction.js" },
    { file: "compose/compose-popup-reformulation.js" },
    { file: "compose/compose-popup-traduction.js" },
    { file: "compose/compose-popup-messages.js" },
    { file: "compose/compose-apply.js" },
    { file: "compose/compose-toast.js" },
    { file: "compose/compose-limites.js" },
    { file: "compose/compose-debounce.js" },
    { file: "compose/compose-check.js" },
    { file: "compose/compose-main.js" },
  ],
  css: [
    { file: "css/badge.css" },
    { file: "css/overlay.css" },
    { file: "css/popup-dark.css" },
    { file: "css/popup-light.css" },
    { file: "css/toast.css" },
  ],
});
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/service/service-compose-scripts.js
git commit -m "Thunderbird : enregistrement des compose scripts"
```

---

## Task 7 : Créer service-menus.js Thunderbird (menus compose + dispatch)

**Files:**
- Créer : `sources-thunderbird/service/service-menus.js`

- [ ] **Step 1 : Créer le fichier**

```javascript
// service-menus.js --- Menus contextuels Thunderbird et dispatch des messages.

"use strict";

// --- Menus contextuels (fenêtre de composition) ---

browser.menus.create({
  id: "albert-reformulate",
  title: "Reformuler avec Albert",
  contexts: ["compose_body"],
});

browser.menus.create({
  id: "albert-translate",
  title: "Traduire avec Albert",
  contexts: ["compose_body"],
});

browser.menus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText;
  if (!text || text.trim().length < 3) return;

  if (info.menuItemId === "albert-reformulate") {
    const result = await checkText(text, "reformulation");
    browser.tabs.sendMessage(tab.id, {
      type: "reformulateResult",
      originalText: text,
      result,
    });
  }

  if (info.menuItemId === "albert-translate") {
    browser.tabs.sendMessage(tab.id, { type: "translateGetSelection" });
  }
});

// --- Dispatch des messages du compose script ---

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check") {
    checkText(message.text, message.mode).then(sendResponse);
    return true;
  }
  if (message.type === "getConfig") {
    loadConfig().then(sendResponse);
    return true;
  }
  if (message.type === "getLimits") {
    fetchLimits().then(sendResponse);
    return true;
  }
  if (message.type === "translate") {
    translateText(message.text, message.targetLang).then(sendResponse);
    return true;
  }
});
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/service/service-menus.js
git commit -m "Thunderbird : menus contextuels compose_body et dispatch messages"
```

---

## Task 8 : Créer compose-state.js et compose-utils.js

**Files:**
- Créer : `sources-thunderbird/compose/compose-state.js`
- Créer : `sources-thunderbird/compose/compose-utils.js`

- [ ] **Step 1 : Créer compose-state.js**

Adapté depuis `sources-firefox/etat/albert-state.js` mais simplifié : un seul champ (le body de composition).

```javascript
// compose-state.js --- Constantes et état global pour la fenêtre de composition Thunderbird.

"use strict";

const Albert = {
  // Drapeaux
  applyingCorrection: false,

  // État du champ de composition (un seul champ par fenêtre)
  composeState: null,

  // Mots ignorés (dictionnaire personnel)
  ignoredWords: new Set(),

  // Thème courant
  popupTheme: "dark",

  // Limites API côté client
  limits: null,
  requestTimestamps: [],

  // Debounce
  DEBOUNCE_SHORT: 1500,
  DEBOUNCE_MAX: 4000,

  // Seuils badge
  BADGE_MIN_LENGTH: 3,
};

// Charger les mots ignorés et le thème au démarrage
(async () => {
  const data = await browser.storage.local.get(["ignoredWords", "popupTheme"]);
  if (data.ignoredWords) {
    Albert.ignoredWords = new Set(data.ignoredWords);
  }
  Albert.popupTheme = data.popupTheme || "dark";
})();

// Synchroniser les changements de storage
browser.storage.onChanged.addListener((changes) => {
  if (changes.ignoredWords) {
    Albert.ignoredWords = new Set(changes.ignoredWords.newValue || []);
  }
  if (changes.popupTheme) {
    Albert.popupTheme = changes.popupTheme.newValue || "dark";
  }
});
```

- [ ] **Step 2 : Créer compose-utils.js**

```javascript
// compose-utils.js --- Utilitaires pour la fenêtre de composition Thunderbird.

"use strict";

Albert.getComposeBody = function () {
  // Dans un compose script, document.body est le corps éditable
  return document.body;
};

Albert.getBodyText = function () {
  const body = Albert.getComposeBody();
  return body ? body.innerText : "";
};

Albert.filterIgnoredCorrections = function (corrections) {
  if (!corrections || !corrections.length) return corrections;
  return corrections.filter(
    (c) => !Albert.ignoredWords.has(c.word.toLowerCase())
  );
};

Albert.getPopupThemeClass = function () {
  return Albert.popupTheme === "light" ? "albert-theme-light" : "";
};

Albert.escapeHtml = function (str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

Albert.findRealOffset = function (text, word, apiOffset) {
  // Chercher le mot exact à la position indiquée par l'API
  const idx = text.indexOf(word, Math.max(0, apiOffset - 10));
  if (idx !== -1) return idx;
  // Fallback : chercher depuis le début
  return text.indexOf(word);
};
```

- [ ] **Step 3 : Commit**

```bash
git add sources-thunderbird/compose/
git commit -m "Thunderbird : compose-state.js et compose-utils.js"
```

---

## Task 9 : Créer compose-badge.js (badge dans le coin du compose)

**Files:**
- Créer : `sources-thunderbird/compose/compose-badge.js`

- [ ] **Step 1 : Créer compose-badge.js**

Adapté depuis `sources-firefox/affichage/albert-badge.js`. Dans Thunderbird, le badge se positionne en fixed dans le coin supérieur droit du compose body.

```javascript
// compose-badge.js --- Badge Albert dans la fenêtre de composition Thunderbird.

"use strict";

Albert.badge = null;

Albert.createBadge = function () {
  if (Albert.badge) return Albert.badge;

  const badge = document.createElement("div");
  badge.className = "albert-badge";
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "Albert Correcteur - cliquer pour vérifier");
  badge.setAttribute("tabindex", "0");
  badge.title = "Albert Correcteur";

  // Icône SVG inline (évite un appel réseau)
  badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24" height="24">'
    + '<circle cx="24" cy="24" r="20" fill="#1a73e8" opacity="0.9"/>'
    + '<text x="24" y="31" text-anchor="middle" fill="white" font-size="22" font-weight="bold">A</text>'
    + '</svg>';

  badge.addEventListener("click", () => {
    Albert.triggerManualCheck();
  });
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      Albert.triggerManualCheck();
    }
  });

  document.body.appendChild(badge);
  Albert.badge = badge;
  return badge;
};

Albert.setBadgeState = function (state) {
  const badge = Albert.badge;
  if (!badge) return;
  badge.className = "albert-badge";
  if (state) badge.classList.add("albert-" + state);
};

Albert.removeBadge = function () {
  if (Albert.badge) {
    Albert.badge.remove();
    Albert.badge = null;
  }
};
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-badge.js
git commit -m "Thunderbird : badge Albert dans le compose"
```

---

## Task 10 : Créer compose-overlay.js (soulignements d'erreurs)

**Files:**
- Créer : `sources-thunderbird/compose/compose-overlay.js`

- [ ] **Step 1 : Créer compose-overlay.js**

Dans Thunderbird, le compose body est un document entier en designMode. On utilise des `<span>` injectés directement dans le DOM (comme pour contenteditable dans Firefox) plutôt qu'un overlay transparent (pas de textarea/input ici).

```javascript
// compose-overlay.js --- Soulignements d'erreurs dans le compose Thunderbird.

"use strict";

Albert.UNDERLINE_CLASSES = {
  orthographe: "albert-error-spelling",
  grammaire: "albert-error-grammar",
  style: "albert-error-style",
};

Albert.clearUnderlines = function () {
  const marks = document.querySelectorAll("span.albert-error");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  });
};

Albert.createUnderlineSpan = function (correction, index) {
  const span = document.createElement("span");
  span.className = "albert-error " + (Albert.UNDERLINE_CLASSES[correction.type] || "albert-error-spelling");
  span.dataset.correctionIndex = index;
  span.setAttribute("role", "button");
  span.setAttribute("tabindex", "0");
  span.setAttribute("aria-label", correction.message || "Erreur détectée");
  return span;
};

Albert.applyUnderlines = function (corrections) {
  Albert.clearUnderlines();
  if (!corrections || !corrections.length) return;

  const body = Albert.getComposeBody();
  if (!body) return;

  // Construire une carte texte -> noeuds DOM
  const textNodes = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
  let node;
  let offset = 0;
  while ((node = walker.nextNode())) {
    textNodes.push({ node, start: offset, end: offset + node.textContent.length });
    offset += node.textContent.length;
  }

  // Appliquer les corrections en ordre inverse (pour ne pas décaler les offsets)
  const sorted = corrections
    .map((c, i) => ({ ...c, index: i }))
    .sort((a, b) => b.offset - a.offset);

  for (const correction of sorted) {
    const realOffset = Albert.findRealOffset(body.innerText, correction.word, correction.offset);
    if (realOffset === -1) continue;

    const endOffset = realOffset + correction.word.length;

    // Trouver le noeud texte contenant le début du mot
    const startInfo = textNodes.find((n) => n.start <= realOffset && n.end > realOffset);
    if (!startInfo) continue;

    const localStart = realOffset - startInfo.start;
    const localEnd = Math.min(localStart + correction.word.length, startInfo.node.textContent.length);

    // Découper le noeud texte et envelopper dans un span
    const range = document.createRange();
    range.setStart(startInfo.node, localStart);
    range.setEnd(startInfo.node, localEnd);

    const span = Albert.createUnderlineSpan(correction, correction.index);
    range.surroundContents(span);

    span.addEventListener("click", (e) => {
      e.stopPropagation();
      Albert.showCorrectionPopup(correction, span);
    });
    span.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        Albert.showCorrectionPopup(correction, span);
      }
    });
  }
};
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-overlay.js
git commit -m "Thunderbird : soulignements d'erreurs dans le compose"
```

---

## Task 11 : Créer compose-render.js (orchestration du rendu)

**Files:**
- Créer : `sources-thunderbird/compose/compose-render.js`

- [ ] **Step 1 : Créer compose-render.js**

```javascript
// compose-render.js --- Orchestration du rendu des corrections dans le compose Thunderbird.

"use strict";

Albert.ariaLive = null;

Albert.ensureAriaLive = function () {
  if (Albert.ariaLive) return Albert.ariaLive;
  const div = document.createElement("div");
  div.setAttribute("role", "status");
  div.setAttribute("aria-live", "polite");
  div.className = "albert-aria-live";
  div.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);";
  document.body.appendChild(div);
  Albert.ariaLive = div;
  return div;
};

Albert.announce = function (message) {
  const live = Albert.ensureAriaLive();
  live.textContent = "";
  setTimeout(() => { live.textContent = message; }, 100);
};

Albert.renderCorrections = function (corrections) {
  const state = Albert.composeState;
  if (!state) return;

  state.corrections = corrections;

  if (!corrections || corrections.length === 0) {
    Albert.clearUnderlines();
    Albert.setBadgeState("ok");
    Albert.announce("Aucune erreur détectée.");
    return;
  }

  Albert.applyUnderlines(corrections);
  Albert.setBadgeState("has-errors");

  const n = corrections.length;
  const s = n > 1 ? "s" : "";
  Albert.announce(n + " erreur" + s + " détectée" + s + ".");
};
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-render.js
git commit -m "Thunderbird : orchestration du rendu des corrections"
```

---

## Task 12 : Créer compose-popup-correction.js

**Files:**
- Créer : `sources-thunderbird/compose/compose-popup-correction.js`

- [ ] **Step 1 : Créer compose-popup-correction.js**

Adapté depuis `sources-firefox/popup-contenu/albert-popup-common.js` + `albert-popup-correction.js`. Popup positionnée sous le mot souligné.

```javascript
// compose-popup-correction.js --- Popup de correction dans le compose Thunderbird.

"use strict";

Albert.correctionPopup = null;

Albert.closeCorrectionPopup = function () {
  if (Albert.correctionPopup) {
    Albert.correctionPopup.remove();
    Albert.correctionPopup = null;
  }
};

Albert.showCorrectionPopup = function (correction, markEl) {
  Albert.closeCorrectionPopup();
  Albert.closeReformulationPopup();
  Albert.closeTranslationPopup();

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Correction suggérée");

  // En-tête avec type d'erreur et bouton fermer
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const typeLabel = document.createElement("span");
  typeLabel.className = "albert-popup-type";
  typeLabel.textContent = correction.type || "orthographe";
  header.appendChild(typeLabel);

  // Navigation entre erreurs
  const state = Albert.composeState;
  if (state && state.corrections && state.corrections.length > 1) {
    const nav = document.createElement("span");
    nav.className = "albert-popup-nav";

    const idx = state.corrections.indexOf(correction);
    nav.textContent = (idx + 1) + " / " + state.corrections.length;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "\u25C0";
    prevBtn.className = "albert-popup-nav-btn";
    prevBtn.setAttribute("aria-label", "Erreur précédente");
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const prevIdx = (idx - 1 + state.corrections.length) % state.corrections.length;
      const prevMark = document.querySelector('[data-correction-index="' + prevIdx + '"]');
      if (prevMark) Albert.showCorrectionPopup(state.corrections[prevIdx], prevMark);
    });

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "\u25B6";
    nextBtn.className = "albert-popup-nav-btn";
    nextBtn.setAttribute("aria-label", "Erreur suivante");
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nextIdx = (idx + 1) % state.corrections.length;
      const nextMark = document.querySelector('[data-correction-index="' + nextIdx + '"]');
      if (nextMark) Albert.showCorrectionPopup(state.corrections[nextIdx], nextMark);
    });

    nav.insertBefore(prevBtn, nav.firstChild);
    nav.appendChild(nextBtn);
    header.appendChild(nav);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeCorrectionPopup();
  });
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // Message d'explication
  if (correction.message) {
    const msg = document.createElement("div");
    msg.className = "albert-popup-message";
    msg.textContent = correction.message;
    popup.appendChild(msg);
  }

  // Suggestions
  if (correction.suggestions && correction.suggestions.length) {
    const sugDiv = document.createElement("div");
    sugDiv.className = "albert-popup-suggestions";
    for (const sug of correction.suggestions) {
      const btn = document.createElement("button");
      btn.className = "albert-popup-suggestion";
      btn.textContent = sug;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Albert.applySuggestion(correction, sug);
        Albert.closeCorrectionPopup();
      });
      sugDiv.appendChild(btn);
    }
    popup.appendChild(sugDiv);
  }

  // Bouton "Ignorer partout"
  const ignoreBtn = document.createElement("button");
  ignoreBtn.className = "albert-popup-ignore";
  ignoreBtn.textContent = "Ignorer partout";
  ignoreBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    Albert.ignoredWords.add(correction.word.toLowerCase());
    const arr = Array.from(Albert.ignoredWords);
    await browser.storage.local.set({ ignoredWords: arr });
    Albert.closeCorrectionPopup();
    // Relancer le rendu sans ce mot
    if (state) {
      const filtered = Albert.filterIgnoredCorrections(state.corrections);
      Albert.renderCorrections(filtered);
    }
  });
  popup.appendChild(ignoreBtn);

  // Positionnement sous le mot souligné
  document.body.appendChild(popup);
  const rect = markEl.getBoundingClientRect();
  popup.style.position = "absolute";
  popup.style.left = rect.left + "px";
  popup.style.top = (rect.bottom + 4) + "px";
  popup.style.zIndex = "2147483647";

  Albert.correctionPopup = popup;
};

// Fermeture par Escape ou clic en dehors
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeCorrectionPopup();
});
document.addEventListener("mousedown", (e) => {
  if (Albert.correctionPopup && !Albert.correctionPopup.contains(e.target) && !e.target.closest(".albert-error")) {
    Albert.closeCorrectionPopup();
  }
});
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-popup-correction.js
git commit -m "Thunderbird : popup de correction dans le compose"
```

---

## Task 13 : Créer compose-popup-reformulation.js

**Files:**
- Créer : `sources-thunderbird/compose/compose-popup-reformulation.js`

- [ ] **Step 1 : Créer compose-popup-reformulation.js**

```javascript
// compose-popup-reformulation.js --- Popup de reformulation dans le compose Thunderbird.

"use strict";

Albert.reformulationPopup = null;

Albert.closeReformulationPopup = function () {
  if (Albert.reformulationPopup) {
    Albert.reformulationPopup.remove();
    Albert.reformulationPopup = null;
  }
};

Albert.showReformulationPopup = function (originalText, result) {
  Albert.closeReformulationPopup();
  Albert.closeCorrectionPopup();
  Albert.closeTranslationPopup();

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Reformulation");

  // En-tête
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const title = document.createElement("span");
  title.className = "albert-popup-type";
  title.textContent = "Reformulation";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeReformulationPopup();
  });
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // Texte original
  const origDiv = document.createElement("div");
  origDiv.className = "albert-popup-message";
  origDiv.textContent = "Original : " + originalText;
  popup.appendChild(origDiv);

  // Suggestions de reformulation
  if (result && result.corrections && result.corrections.length) {
    const sugDiv = document.createElement("div");
    sugDiv.className = "albert-popup-suggestions";
    for (const c of result.corrections) {
      for (const sug of (c.suggestions || [])) {
        const btn = document.createElement("button");
        btn.className = "albert-popup-suggestion";
        btn.textContent = sug;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          Albert.replaceSelection(sug);
          Albert.closeReformulationPopup();
        });
        sugDiv.appendChild(btn);
      }
    }
    popup.appendChild(sugDiv);
  } else if (result && result.error) {
    const errDiv = document.createElement("div");
    errDiv.className = "albert-popup-message";
    errDiv.textContent = result.error;
    popup.appendChild(errDiv);
  }

  // Positionner au centre du viewport
  document.body.appendChild(popup);
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "30%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = "2147483647";

  Albert.reformulationPopup = popup;
};

Albert.replaceSelection = function (text) {
  // Utiliser execCommand pour que l'undo fonctionne
  document.execCommand("insertText", false, text);
};

// Fermeture par Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeReformulationPopup();
});
document.addEventListener("mousedown", (e) => {
  if (Albert.reformulationPopup && !Albert.reformulationPopup.contains(e.target)) {
    Albert.closeReformulationPopup();
  }
});
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-popup-reformulation.js
git commit -m "Thunderbird : popup de reformulation dans le compose"
```

---

## Task 14 : Créer compose-popup-traduction.js

**Files:**
- Créer : `sources-thunderbird/compose/compose-popup-traduction.js`

- [ ] **Step 1 : Créer compose-popup-traduction.js**

```javascript
// compose-popup-traduction.js --- Popup de traduction dans le compose Thunderbird.

"use strict";

Albert.translationPopup = null;
Albert.lastTranslationLang = "en";

Albert.closeTranslationPopup = function () {
  if (Albert.translationPopup) {
    Albert.translationPopup.remove();
    Albert.translationPopup = null;
  }
};

Albert.showTranslationPopup = function (text) {
  Albert.closeTranslationPopup();
  Albert.closeCorrectionPopup();
  Albert.closeReformulationPopup();

  const popup = document.createElement("div");
  popup.className = "albert-popup " + Albert.getPopupThemeClass();
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Traduction");

  // En-tête avec sélecteur de langue
  const header = document.createElement("div");
  header.className = "albert-popup-header";

  const title = document.createElement("span");
  title.className = "albert-popup-type";
  title.textContent = "Traduction";
  header.appendChild(title);

  const langSelect = document.createElement("select");
  langSelect.className = "albert-popup-lang-select";
  langSelect.setAttribute("aria-label", "Langue cible");
  const langs = { fr: "Français", en: "Anglais", es: "Espagnol", de: "Allemand" };
  for (const [code, name] of Object.entries(langs)) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    if (code === Albert.lastTranslationLang) opt.selected = true;
    langSelect.appendChild(opt);
  }
  header.appendChild(langSelect);

  const closeBtn = document.createElement("button");
  closeBtn.className = "albert-popup-close";
  closeBtn.textContent = "\u00D7";
  closeBtn.setAttribute("aria-label", "Fermer");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Albert.closeTranslationPopup();
  });
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // Zone de résultat
  const resultDiv = document.createElement("div");
  resultDiv.className = "albert-popup-translation-result";
  resultDiv.textContent = "Traduction en cours...";
  popup.appendChild(resultDiv);

  // Info langue source
  const langInfo = document.createElement("div");
  langInfo.className = "albert-popup-lang-info";
  popup.appendChild(langInfo);

  // Bouton copier
  const copyBtn = document.createElement("button");
  copyBtn.className = "albert-popup-suggestion";
  copyBtn.textContent = "Copier";
  copyBtn.style.display = "none";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(resultDiv.textContent);
    copyBtn.textContent = "Copié !";
    setTimeout(() => { copyBtn.textContent = "Copier"; }, 1500);
  });
  popup.appendChild(copyBtn);

  // Positionner au centre
  document.body.appendChild(popup);
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "30%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.zIndex = "2147483647";

  Albert.translationPopup = popup;

  // Fonction de traduction
  const doTranslate = async (targetLang) => {
    Albert.lastTranslationLang = targetLang;
    resultDiv.textContent = "Traduction en cours...";
    copyBtn.style.display = "none";
    const result = await browser.runtime.sendMessage({
      type: "translate",
      text: text,
      targetLang: targetLang,
    });
    if (result.error) {
      resultDiv.textContent = result.error;
    } else {
      resultDiv.textContent = result.translation;
      const langNames = { fr: "français", en: "anglais", es: "espagnol", de: "allemand" };
      langInfo.textContent = "Langue détectée : " + (langNames[result.langSource] || result.langSource);
      copyBtn.style.display = "";
    }
  };

  langSelect.addEventListener("change", () => doTranslate(langSelect.value));

  // Traduction automatique à l'ouverture
  doTranslate(Albert.lastTranslationLang);
};

// Fermeture par Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") Albert.closeTranslationPopup();
});
document.addEventListener("mousedown", (e) => {
  if (Albert.translationPopup && !Albert.translationPopup.contains(e.target)) {
    Albert.closeTranslationPopup();
  }
});
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-popup-traduction.js
git commit -m "Thunderbird : popup de traduction dans le compose"
```

---

## Task 15 : Créer compose-popup-messages.js (dispatch des messages du background)

**Files:**
- Créer : `sources-thunderbird/compose/compose-popup-messages.js`

- [ ] **Step 1 : Créer compose-popup-messages.js**

```javascript
// compose-popup-messages.js --- Réception des messages du background script dans le compose.

"use strict";

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "reformulateResult") {
    Albert.showReformulationPopup(message.originalText, message.result);
  }

  if (message.type === "translateGetSelection") {
    const selection = document.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (text.length >= 3) {
      Albert.showTranslationPopup(text);
    }
  }
});
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-popup-messages.js
git commit -m "Thunderbird : dispatch des messages background vers le compose"
```

---

## Task 16 : Créer compose-apply.js (application des corrections)

**Files:**
- Créer : `sources-thunderbird/compose/compose-apply.js`

- [ ] **Step 1 : Créer compose-apply.js**

Dans Thunderbird, le compose body est en designMode. On utilise `document.execCommand` pour que CTRL+Z fonctionne nativement.

```javascript
// compose-apply.js --- Application des corrections dans le compose Thunderbird.

"use strict";

Albert.applySuggestion = function (correction, suggestion) {
  Albert.applyingCorrection = true;

  try {
    const body = Albert.getComposeBody();
    if (!body) return;

    // Trouver le span souligné correspondant
    const mark = document.querySelector('[data-correction-index="' + correction.index + '"]');
    if (mark) {
      // Sélectionner le contenu du span
      const range = document.createRange();
      range.selectNodeContents(mark);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      // Remplacer via execCommand (support undo natif)
      document.execCommand("insertText", false, suggestion);
    } else {
      // Fallback : chercher le mot dans le texte et le remplacer
      const text = body.innerText;
      const realOffset = Albert.findRealOffset(text, correction.word, correction.offset);
      if (realOffset === -1) return;

      // Construire un range sur le texte brut
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
      let node;
      let offset = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;

      while ((node = walker.nextNode())) {
        const nodeEnd = offset + node.textContent.length;
        if (!startNode && realOffset < nodeEnd) {
          startNode = node;
          startOffset = realOffset - offset;
        }
        if (startNode && realOffset + correction.word.length <= nodeEnd) {
          endNode = node;
          endOffset = realOffset + correction.word.length - offset;
          break;
        }
        offset = nodeEnd;
      }

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("insertText", false, suggestion);
      }
    }

    // Mettre à jour les corrections restantes
    const state = Albert.composeState;
    if (state && state.corrections) {
      state.corrections = state.corrections.filter((c) => c !== correction);
      // Invalider le texte vérifié pour déclencher une nouvelle vérification
      state.checkedText = null;
    }
  } finally {
    Albert.applyingCorrection = false;
  }
};

Albert.triggerManualCheck = function () {
  const text = Albert.getBodyText();
  if (text.trim().length < Albert.BADGE_MIN_LENGTH) return;
  Albert.requestCheck(text);
};
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-apply.js
git commit -m "Thunderbird : application des corrections avec support undo"
```

---

## Task 17 : Créer compose-toast.js, compose-limites.js, compose-debounce.js, compose-check.js

**Files:**
- Créer : `sources-thunderbird/compose/compose-toast.js`
- Créer : `sources-thunderbird/compose/compose-limites.js`
- Créer : `sources-thunderbird/compose/compose-debounce.js`
- Créer : `sources-thunderbird/compose/compose-check.js`

- [ ] **Step 1 : Créer compose-toast.js**

```javascript
// compose-toast.js --- Notifications toast dans le compose Thunderbird.

"use strict";

Albert.showToast = function (message, duration) {
  duration = duration || 3000;
  let container = document.querySelector(".albert-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "albert-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "albert-toast";
  toast.textContent = message;
  toast.setAttribute("role", "alert");
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("albert-toast-fade");
    setTimeout(() => toast.remove(), 300);
  }, duration);
};
```

- [ ] **Step 2 : Créer compose-limites.js**

```javascript
// compose-limites.js --- Vérification des limites API côté client dans le compose.

"use strict";

Albert.checkRateLimit = function () {
  const limits = Albert.limits;
  if (!limits) return true;

  const now = Date.now();
  // Nettoyer les timestamps de plus d'une minute
  Albert.requestTimestamps = Albert.requestTimestamps.filter((t) => now - t < 60000);

  const rpm = limits.rpm;
  if (rpm && Albert.requestTimestamps.length >= rpm * 0.8) {
    return false;
  }

  return true;
};

Albert.recordRequest = function () {
  Albert.requestTimestamps.push(Date.now());
};

Albert.loadLimits = async function () {
  const limits = await browser.runtime.sendMessage({ type: "getLimits" });
  Albert.limits = limits;

  // Recalculer le debounce
  if (limits && limits.rpm) {
    const interval = Math.ceil(60000 / (limits.rpm * 0.4));
    Albert.DEBOUNCE_SHORT = Math.max(1500, interval);
    Albert.DEBOUNCE_MAX = Albert.DEBOUNCE_SHORT * 2.5;
  }
};
```

- [ ] **Step 3 : Créer compose-debounce.js**

```javascript
// compose-debounce.js --- Double debounce adaptatif pour le compose Thunderbird.

"use strict";

Albert.debounceTimer = null;
Albert.debounceMaxTimer = null;

Albert.scheduleCheck = function () {
  const text = Albert.getBodyText();
  if (text.trim().length < Albert.BADGE_MIN_LENGTH) {
    Albert.clearUnderlines();
    Albert.setBadgeState(null);
    return;
  }

  // Annuler le timer court précédent
  if (Albert.debounceTimer) clearTimeout(Albert.debounceTimer);

  // Timer court : attend la fin de la frappe
  Albert.debounceTimer = setTimeout(() => {
    Albert.requestCheck(text);
  }, Albert.DEBOUNCE_SHORT);

  // Timer max : force la vérification même si l'utilisateur tape toujours
  if (!Albert.debounceMaxTimer) {
    Albert.debounceMaxTimer = setTimeout(() => {
      Albert.debounceMaxTimer = null;
      if (Albert.debounceTimer) {
        clearTimeout(Albert.debounceTimer);
        Albert.debounceTimer = null;
      }
      const currentText = Albert.getBodyText();
      if (currentText.trim().length >= Albert.BADGE_MIN_LENGTH) {
        Albert.requestCheck(currentText);
      }
    }, Albert.DEBOUNCE_MAX);
  }
};
```

- [ ] **Step 4 : Créer compose-check.js**

```javascript
// compose-check.js --- Déclenchement de la vérification dans le compose Thunderbird.

"use strict";

Albert.pendingAbort = null;

Albert.requestCheck = function (text) {
  const state = Albert.composeState;
  if (!state) return;

  // Ne pas revérifier le même texte
  if (state.checkedText === text) return;

  // Vérifier les limites
  if (!Albert.checkRateLimit()) {
    Albert.showToast("Limite API approchée, vérification reportée.");
    return;
  }

  // Annuler la requête précédente
  if (Albert.pendingAbort) Albert.pendingAbort.abort();
  const controller = new AbortController();
  Albert.pendingAbort = controller;

  Albert.setBadgeState("loading");
  Albert.recordRequest();

  browser.runtime.sendMessage({ type: "check", text: text, mode: "correction" }).then((result) => {
    if (controller.signal.aborted) return;
    Albert.pendingAbort = null;

    // Annuler les timers
    if (Albert.debounceTimer) { clearTimeout(Albert.debounceTimer); Albert.debounceTimer = null; }
    if (Albert.debounceMaxTimer) { clearTimeout(Albert.debounceMaxTimer); Albert.debounceMaxTimer = null; }

    if (result.error) {
      Albert.setBadgeState("error");
      if (result.retryAfter) {
        Albert.showToast(result.error, result.retryAfter * 1000);
      } else {
        Albert.showToast(result.error);
      }
      return;
    }

    state.checkedText = text;
    const filtered = Albert.filterIgnoredCorrections(result.corrections);
    Albert.renderCorrections(filtered);
  }).catch(() => {
    if (!controller.signal.aborted) {
      Albert.setBadgeState("error");
    }
  });
};
```

- [ ] **Step 5 : Commit**

```bash
git add sources-thunderbird/compose/compose-toast.js sources-thunderbird/compose/compose-limites.js sources-thunderbird/compose/compose-debounce.js sources-thunderbird/compose/compose-check.js
git commit -m "Thunderbird : toast, limites, debounce et vérification dans le compose"
```

---

## Task 18 : Créer compose-main.js (point d'entrée)

**Files:**
- Créer : `sources-thunderbird/compose/compose-main.js`

- [ ] **Step 1 : Créer compose-main.js**

```javascript
// compose-main.js --- Point d'entrée du compose script Thunderbird.

"use strict";

(async () => {
  // Initialiser l'état de composition
  Albert.composeState = {
    corrections: [],
    checkedText: null,
  };

  // Charger les limites API
  await Albert.loadLimits();

  // Créer le badge
  Albert.createBadge();

  const body = Albert.getComposeBody();
  if (!body) return;

  // Écouter les modifications du texte
  body.addEventListener("input", (e) => {
    if (Albert.applyingCorrection) return;

    // Fermer les popups en cours
    Albert.closeCorrectionPopup();

    // Effacer les soulignements pendant la frappe
    Albert.clearUnderlines();
    Albert.setBadgeState(null);

    // Déclencher le debounce
    Albert.scheduleCheck();
  });

  // Gestion IME/composition (langues CJK)
  let composing = false;
  body.addEventListener("compositionstart", () => { composing = true; });
  body.addEventListener("compositionend", () => {
    composing = false;
    Albert.scheduleCheck();
  });

  // Vérification immédiate au collage
  body.addEventListener("paste", () => {
    setTimeout(() => {
      if (Albert.debounceTimer) clearTimeout(Albert.debounceTimer);
      if (Albert.debounceMaxTimer) { clearTimeout(Albert.debounceMaxTimer); Albert.debounceMaxTimer = null; }
      const text = Albert.getBodyText();
      if (text.trim().length >= Albert.BADGE_MIN_LENGTH) {
        Albert.requestCheck(text);
      }
    }, 100);
  });

  // Vérification initiale si du texte est déjà présent (réponse, transfert)
  const initialText = Albert.getBodyText();
  if (initialText.trim().length >= Albert.BADGE_MIN_LENGTH) {
    setTimeout(() => Albert.requestCheck(initialText), 500);
  }
})();
```

- [ ] **Step 2 : Commit**

```bash
git add sources-thunderbird/compose/compose-main.js
git commit -m "Thunderbird : point d'entrée compose-main.js"
```

---

## Task 19 : Créer les CSS Thunderbird

**Files:**
- Créer : `sources-thunderbird/css/badge.css`
- Créer : `sources-thunderbird/css/overlay.css`
- Créer : `sources-thunderbird/css/popup-dark.css`
- Créer : `sources-thunderbird/css/popup-light.css`
- Créer : `sources-thunderbird/css/toast.css`

- [ ] **Step 1 : Copier les CSS depuis Firefox comme base**

```bash
mkdir -p sources-thunderbird/css
cp sources-firefox/css/badge.css sources-thunderbird/css/badge.css
cp sources-firefox/css/overlay.css sources-thunderbird/css/overlay.css
cp sources-firefox/css/popup-dark.css sources-thunderbird/css/popup-dark.css
cp sources-firefox/css/popup-light.css sources-thunderbird/css/popup-light.css
cp sources-firefox/css/toast.css sources-thunderbird/css/toast.css
```

- [ ] **Step 2 : Adapter badge.css pour le compose Thunderbird**

Dans `sources-thunderbird/css/badge.css`, modifier le positionnement du badge. Au lieu de se positionner relativement à un champ de saisie, le badge est en position fixe dans le coin supérieur droit du compose :

```css
.albert-badge {
  position: fixed;
  top: 8px;
  right: 8px;
  /* ... garder le reste identique */
}
```

Supprimer les règles `.modal-open .albert-badge { display: none !important; }` (pas de modales Bootstrap dans Thunderbird).

- [ ] **Step 3 : Commit**

```bash
git add sources-thunderbird/css/
git commit -m "Thunderbird : CSS pour badge, overlay, popups et toast"
```

---

## Task 20 : Créer la popup de configuration Thunderbird

**Files:**
- Copier et adapter : `sources-thunderbird/popup-configuration/`

- [ ] **Step 1 : Copier les fichiers de configuration depuis Firefox**

```bash
cp -r sources-firefox/popup-configuration sources-thunderbird/popup-configuration
```

- [ ] **Step 2 : Adapter si nécessaire**

La popup de configuration (clé API, modèle, URL, thème, dictionnaire) est quasi identique. La seule différence : dans Thunderbird, `browser_action` devient `compose_action`, mais les fichiers HTML/JS/CSS restent les mêmes. Vérifier que les appels `browser.storage.local` et `browser.runtime.sendMessage` fonctionnent (ils sont identiques dans Thunderbird).

Pas de modification attendue sauf si des tests révèlent un problème.

- [ ] **Step 3 : Commit**

```bash
git add sources-thunderbird/popup-configuration/
git commit -m "Thunderbird : popup de configuration (copie depuis Firefox)"
```

---

## Task 21 : Créer thunderbird-build.sh

**Files:**
- Créer : `thunderbird-build.sh`

- [ ] **Step 1 : Créer le script**

```bash
#!/bin/bash
# Construit le fichier .xpi pour installation dans Thunderbird.
# Assemble sources/ (code partagé) + sources-thunderbird/ (code spécifique).
# Usage : ./thunderbird-build.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/sources"
TB_DIR="$SCRIPT_DIR/sources-thunderbird"
OUT_DIR="$SCRIPT_DIR/thunderbird-release"
BUILD_DIR="$SCRIPT_DIR/.build-thunderbird"
OUT="$OUT_DIR/albert-correcteur-thunderbird.xpi"

# Vérifier que les dossiers source existent
if [ ! -d "$COMMON_DIR" ]; then
    echo "Erreur : le dossier sources/ est introuvable."
    exit 1
fi
if [ ! -d "$TB_DIR" ]; then
    echo "Erreur : le dossier sources-thunderbird/ est introuvable."
    exit 1
fi

# Nettoyer et préparer le dossier d'assemblage
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copier le code partagé puis le code spécifique Thunderbird (écrase si conflit)
cp -r "$COMMON_DIR"/* "$BUILD_DIR"/
cp -r "$TB_DIR"/* "$BUILD_DIR"/

# Créer le dossier de release et supprimer l'ancien .xpi
mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Créer le .xpi (c'est un simple fichier ZIP)
cd "$BUILD_DIR"
zip -r "$OUT" . -x ".*"

# Nettoyer
rm -rf "$BUILD_DIR"

echo ""
echo "Extension packagée : $OUT"
echo ""
echo "Pour installer dans Thunderbird :"
echo "  1. Ouvrir le gestionnaire de modules (Menu > Modules complémentaires)"
echo "  2. Roue dentée -> Installer un module depuis un fichier..."
echo "  3. Sélectionner albert-correcteur-thunderbird.xpi"
```

- [ ] **Step 2 : Rendre exécutable et tester**

```bash
chmod +x thunderbird-build.sh
./thunderbird-build.sh
ls -la thunderbird-release/albert-correcteur-thunderbird.xpi
unzip -l thunderbird-release/albert-correcteur-thunderbird.xpi | head -40
```

- [ ] **Step 3 : Commit**

```bash
git add thunderbird-build.sh
git commit -m "thunderbird-build.sh : assemblage sources/ + sources-thunderbird/"
```

---

## Task 22 : Ajouter thunderbird-release/ au .gitignore

**Files:**
- Modifier : `.gitignore`

- [ ] **Step 1 : Ajouter la ligne**

```
thunderbird-release/
```

- [ ] **Step 2 : Commit**

```bash
git add .gitignore
git commit -m "gitignore : ajout de thunderbird-release/"
```

---

## Task 23 : Mettre à jour le README.md

**Files:**
- Modifier : `README.md`

- [ ] **Step 1 : Ajouter une section Thunderbird dans le README**

Ajouter après la section "Installation" :

```markdown
## Extension Thunderbird

Une version pour Thunderbird 128+ est également disponible. Elle offre les mêmes fonctionnalités (correction, reformulation, traduction) directement dans la fenêtre de composition de mail.

### Installation Thunderbird

1. Télécharger le `.xpi` Thunderbird depuis les [Releases GitForge](https://forge.apps.education.fr/booklageolivier/albert-correcteur/-/releases)
2. Dans Thunderbird : Menu > Modules complémentaires > roue dentée > "Installer un module depuis un fichier..."
3. Sélectionner le fichier `.xpi`
```

- [ ] **Step 2 : Mettre à jour la section Architecture pour mentionner la nouvelle structure**

Ajouter une note expliquant la structure `sources/` (partagé) + `sources-firefox/` + `sources-thunderbird/`.

- [ ] **Step 3 : Commit**

```bash
git add README.md
git commit -m "README : ajout de la section Thunderbird et nouvelle structure"
```

---

## Task 24 : Mettre à jour ARCHITECTURE.md

**Files:**
- Modifier : `ARCHITECTURE.md`

- [ ] **Step 1 : Mettre à jour l'arborescence et les explications**

Documenter la nouvelle structure avec les trois dossiers et le principe d'assemblage.

- [ ] **Step 2 : Commit**

```bash
git add ARCHITECTURE.md
git commit -m "ARCHITECTURE : documentation de la structure partagée Firefox/Thunderbird"
```

---

## Task 25 : Tests manuels dans Thunderbird

- [ ] **Step 1 : Builder le .xpi Thunderbird**

```bash
./thunderbird-build.sh
```

- [ ] **Step 2 : Installer dans Thunderbird**

Ouvrir Thunderbird, installer le .xpi, configurer la clé API.

- [ ] **Step 3 : Tester la correction**

Ouvrir un nouveau message, taper du texte avec des fautes, vérifier que :
- Le badge Albert apparaît
- Les erreurs sont soulignées après le debounce
- Cliquer sur un soulignement affiche la popup de correction
- Cliquer sur une suggestion remplace le mot
- CTRL+Z annule la correction

- [ ] **Step 4 : Tester la reformulation**

Sélectionner du texte dans le compose, clic droit > "Reformuler avec Albert", vérifier que la popup s'affiche avec des suggestions.

- [ ] **Step 5 : Tester la traduction**

Sélectionner du texte, clic droit > "Traduire avec Albert", vérifier que la popup de traduction s'affiche, changer de langue, copier le résultat.

- [ ] **Step 6 : Tester le build Firefox (non-régression)**

```bash
./firefox-build.sh
```

Installer le .xpi Firefox, vérifier que tout fonctionne toujours.
