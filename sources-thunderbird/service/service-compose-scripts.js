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
