/*
 * albert-limites.js - Gestion des limites API et debounce adaptatif.
 *
 * Ce module gère trois aspects liés aux limites de l'API Albert :
 *
 * 1. Chargement des limites :
 *    Récupère les quotas du compte (rpm, rpd, tpm, tpd) depuis le
 *    service worker et les met en cache côté content script.
 *
 * 2. Calcul du debounce adaptatif :
 *    Ajuste les délais de debounce en fonction du rpm du compte.
 *    On réserve ~40 % du quota pour les vérifications automatiques
 *    (le reste pour les clics manuels, le cycle de fond, le paste).
 *
 * 3. Vérification avant envoi :
 *    Contrôle que la prochaine requête ne dépasse pas les limites
 *    rpm et rpd, et affiche un avertissement visuel si nécessaire.
 *    Le compteur rpm utilise une fenêtre glissante propre
 *    (Albert.RollingWindow) pour calculer précisément le temps
 *    d'attente avant le prochain slot disponible.
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* Fenêtre glissante de 60 s pour suivre les requêtes (rpm).
   Mutualise le code avec compose-limites.js (Thunderbird) via
   sources-commun/verification/rolling-window.js. */
Albert.requestWindow = new Albert.RollingWindow(60000);

/* Charge les limites depuis le script de fond (cache 10 min côté service). */
Albert.loadLimits = async function () {
  if (!Albert.limits) {
    Albert.limits = await browser.runtime.sendMessage({ type: "getLimits" });
    Albert.updateDebounceFromRpm();
  }
  return Albert.limits;
};

/* Invalider le cache des limites quand la config change (changement de modèle, clé API, etc.)
   pour forcer le rechargement et le recalcul des délais de debounce. */
browser.storage.onChanged.addListener((changes) => {
  if (changes.apiKey || changes.model || changes.apiBase) {
    Albert.limits = null;
    Albert.requestWindow.reset();
  }
});

/* Calcule les délais de debounce en fonction du rpm du compte.
   Logique : on réserve ~40 % du quota rpm pour les vérifications automatiques
   (le reste pour les clics manuels, le cycle de fond, le paste, etc.).
     rpm 10  -> debounce 3000ms, max 10s   (utilise ~4 rpm en frappe continue)
     rpm 30  -> debounce 2000ms, max 6s    (~10 rpm)
     rpm 60  -> debounce 1500ms, max 4s    (~15 rpm)
     rpm 100+-> debounce 1500ms, max 4s    (plafonné, inutile d'aller plus vite) */
Albert.updateDebounceFromRpm = function () {
  const limits = Albert.limits;
  if (!limits || !limits.rpm) return;

  const rpm = limits.rpm;
  /* Intervalle minimal entre requêtes pour utiliser ~40 % du quota */
  const interval = Math.ceil(60000 / (rpm * 0.4));

  /* Bornes : 1500ms minimum (confort), 4000ms maximum (pas trop lent) */
  Albert.DEBOUNCE_MS = Math.max(1500, Math.min(interval, 4000));
  /* Le max debounce = 3x le debounce (frappe continue sans pause) */
  Albert.MAX_DEBOUNCE_MS = Math.max(4000, Albert.DEBOUNCE_MS * 3);

  /* Délais quand on approche de la limite (80 % atteints) */
  Albert.THROTTLE_DEBOUNCE_MS = Math.max(Albert.DEBOUNCE_MS * 2, 6000);
  Albert.THROTTLE_MAX_DEBOUNCE_MS = Math.max(Albert.MAX_DEBOUNCE_MS * 2, 15000);

  console.info(`[Albert] rpm=${rpm} -> debounce=${Albert.DEBOUNCE_MS}ms, max=${Albert.MAX_DEBOUNCE_MS}ms`);
};

/* Vérifie si on peut envoyer une requête sans dépasser les limites.
   Retourne null si OK, ou un message d'erreur si limité. */
Albert.checkRateLimit = function () {
  const limits = Albert.limits;
  if (!limits) return null;

  /* Réinitialiser le compteur journalier si on a changé de jour */
  const todayStart = new Date().setHours(0, 0, 0, 0);
  if (Albert.requestDayStart !== todayStart) {
    Albert.requestDayStart = todayStart;
    Albert.requestCountToday = 0;
  }

  /* Vérifier rpm (requêtes par minute) avec fenêtre glissante */
  if (limits.rpm && Albert.requestWindow.total() >= limits.rpm) {
    const waitSec = Math.ceil(Albert.requestWindow.secondsUntilNextSlot());
    return `Limite requêtes/minute (rpm) atteinte : ${limits.rpm} max. Pause ${waitSec}s.`;
  }

  /* Vérifier rpd (requêtes par jour) */
  if (limits.rpd && Albert.requestCountToday >= limits.rpd) {
    return `Limite requêtes/jour (rpd) atteinte : ${limits.rpd} max. Réessayez demain.`;
  }

  return null;
};

/* Enregistre qu'une requête vient d'être envoyée. */
Albert.recordRequest = function () {
  Albert.requestWindow.add();
  Albert.requestCountToday++;
};

/* Affiche un avertissement de limite sur les badges et via un toast. */
Albert.showRateLimitWarning = function (el, message) {
  /* Griser tous les badges */
  for (const field of Albert.trackedFields) {
    const st = Albert.getOrCreateState(field);
    if (st.badge) {
      st.badge.classList.add("albert-rate-limited");
      st.badge.title = message;
    }
  }

  /* Afficher le toast */
  const delay = /(\d+)s/.exec(message);
  const sec = delay ? parseInt(delay[1], 10) : 30;
  Albert.showToast(message, sec);

  /* Retirer l'état visuel après la pause */
  setTimeout(() => {
    for (const field of Albert.trackedFields) {
      const st = Albert.getOrCreateState(field);
      if (st.badge) {
        st.badge.classList.remove("albert-rate-limited");
        st.badge.title = "Albert Correcteur";
      }
    }
  }, sec * 1000);
};
