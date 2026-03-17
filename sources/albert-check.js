// albert-check.js — Vérification du texte via l'API Albert.
// Gère le debounce, l'appel API, le cycle de vérification et le respect des limites API.

"use strict";

// Charge les limites depuis le background script (cache 10 min côté background).
Albert.loadLimits = async function () {
  if (!Albert.limits) {
    Albert.limits = await browser.runtime.sendMessage({ type: "getLimits" });
  }
  return Albert.limits;
};

// Vérifie si on peut envoyer une requête sans dépasser les limites.
// Retourne null si OK, ou un message d'erreur si limité.
Albert.checkRateLimit = function () {
  const limits = Albert.limits;
  if (!limits) return null;

  const now = Date.now();

  // Réinitialiser le compteur journalier si on a changé de jour
  const todayStart = new Date().setHours(0, 0, 0, 0);
  if (Albert.requestDayStart !== todayStart) {
    Albert.requestDayStart = todayStart;
    Albert.requestCountToday = 0;
  }

  // Nettoyer les timestamps de plus d'une minute
  Albert.requestTimestamps = Albert.requestTimestamps.filter(
    (t) => now - t < 60000
  );

  // Vérifier rpm (requêtes par minute)
  if (limits.rpm && Albert.requestTimestamps.length >= limits.rpm) {
    const waitSec = Math.ceil((60000 - (now - Albert.requestTimestamps[0])) / 1000);
    return `Limite atteinte (${limits.rpm} req/min). Pause ${waitSec}s.`;
  }

  // Vérifier rpd (requêtes par jour)
  if (limits.rpd && Albert.requestCountToday >= limits.rpd) {
    return `Limite journalière atteinte (${limits.rpd} req/jour). Réessayez demain.`;
  }

  return null;
};

// Enregistre qu'une requête vient d'être envoyée.
Albert.recordRequest = function () {
  Albert.requestTimestamps.push(Date.now());
  Albert.requestCountToday++;
};

// Programme une vérification après un délai (debounce).
Albert.scheduleCheck = function (el) {
  const state = Albert.getOrCreateState(el);
  clearTimeout(state.timer);
  state.timer = setTimeout(() => Albert.triggerCheck(el), Albert.DEBOUNCE_MS);
};

// Envoie le texte au background script pour correction.
Albert.triggerCheck = async function (el) {
  const text = Albert.getTextContent(el);
  if (text.trim().length < Albert.MIN_TEXT_LENGTH) {
    Albert.clearCorrections(el);
    return;
  }

  const state = Albert.getOrCreateState(el);
  if (state.lastCheckedText === text) return;

  // Charger les limites si pas encore fait
  await Albert.loadLimits();

  // Vérifier qu'on ne dépasse pas les limites
  const limitMsg = Albert.checkRateLimit();
  if (limitMsg) {
    console.warn("[Albert]", limitMsg);
    Albert.rateLimited = true;
    // Réessayer dans 60s si c'est une limite par minute
    const delay = limitMsg.includes("jour") ? 3600000 : 60000;
    setTimeout(() => { Albert.rateLimited = false; }, delay);
    return;
  }

  if (state.badge) state.badge.classList.add("albert-loading");

  try {
    Albert.recordRequest();
    const response = await browser.runtime.sendMessage({ type: "check", text, mode: Albert.mode });
    if (response.error) {
      console.warn("[Albert]", response.error);
      if (response.error.includes("Limite de débit")) {
        Albert.rateLimited = true;
        setTimeout(() => { Albert.rateLimited = false; }, 30000);
      }
      return;
    }
    const raw = response.corrections || [];
    state.corrections = Albert.filterIgnoredCorrections(raw, text);
    state.lang = response.lang || "fr";
    state.lastCheckedText = text;
    Albert.renderCorrections(el);
  } catch (err) {
    console.error("[Albert]", err);
  } finally {
    if (state.badge) state.badge.classList.remove("albert-loading");
  }
};

// Vérifie tous les champs de la page, un par un (séquentiel).
// Le champ actif est vérifié en premier.
Albert.cycleCheckAll = async function () {
  if (Albert.checkInProgress || Albert.rateLimited) return;
  Albert.checkInProgress = true;

  try {
    // Nettoyer les champs retirés du DOM
    for (const el of Albert.trackedFields) {
      if (!document.contains(el)) {
        Albert.trackedFields.delete(el);
      }
    }

    // Le champ actif en premier
    const active = document.activeElement;
    const sorted = [...Albert.trackedFields].sort((a, b) => {
      if (a === active) return -1;
      if (b === active) return 1;
      return 0;
    });

    for (const el of sorted) {
      if (Albert.rateLimited) break;

      const text = Albert.getTextContent(el);
      if (text.trim().length < Albert.MIN_TEXT_LENGTH) continue;

      const state = Albert.getOrCreateState(el);
      if (state.lastCheckedText === text) continue;

      await Albert.triggerCheck(el);
      await Albert.sleep(7000);
    }
  } finally {
    Albert.checkInProgress = false;
  }
};
