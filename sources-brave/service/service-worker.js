/*
 * service-worker.js - Point d'entrée du background pour Chromium / Brave (Manifest V3).
 *
 * Sous Manifest V2 (Firefox), le background charge une LISTE de scripts dans un
 * scope global partagé (voir background.scripts du manifest Firefox). Manifest V3
 * n'autorise qu'un seul point d'entrée de service worker. On reproduit donc le
 * même comportement avec importScripts() : les scripts sont exécutés dans l'ordre,
 * dans le scope global PARTAGÉ du worker. Le namespace global "Albert" et les
 * variables de cache (promptCache, cachedLimits, etc.) restent donc accessibles
 * d'un module à l'autre, exactement comme en MV2. Aucun refactor du code commun
 * n'est nécessaire.
 *
 * IMPORTANT : browser-shim.js DOIT être importé en premier. Chromium n'expose pas
 * le namespace "browser.*" ; le shim l'aliase simplement sur "chrome.*", qui
 * renvoie déjà des promesses sous Manifest V3 pour toutes les API employées ici.
 * Le reste du code commun peut alors continuer d'utiliser "browser.*" tel quel,
 * sans dépendance externe.
 *
 * L'ordre ci-dessous reproduit exactement background.scripts du manifest Firefox.
 *
 * Limite MV3 connue (non bloquante) : le service worker est arrêté après ~30 s
 * d'inactivité, ce qui vide les caches en mémoire. Ils sont simplement re-remplis
 * à la demande (dégradation gracieuse). Le rate-limiting local tourne côté content
 * script, donc lié à la page, et n'est pas affecté.
 */

importScripts(
  "../lib/browser-shim.js",

  "../util/model-aliases.js",
  "../util/personas.js",
  "service-update.js",
  "service-config.js",
  "service-langue.js",
  "service-prompts.js",
  "service-limites.js",
  "service-fallback.js",
  "service-rate-limit.js",
  "../verification/regles-locales.js",
  "service-api.js",
  "service-dispatch.js",
  "service-menus.js"
);
