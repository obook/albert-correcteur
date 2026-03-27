// albert-check.js --- Envoi du texte au script de fond et cycle de vérification.

"use strict";

// Envoie le texte au script de fond pour correction.
// Utilise un AbortController pour pouvoir annuler la requête si le texte change.
Albert.triggerCheck = async function (el) {
  const text = Albert.getTextContent(el);
  const state = Albert.getOrCreateState(el);

  // Réinitialiser les timers (la vérification se lance)
  clearTimeout(state.timer);
  clearTimeout(state.maxTimer);
  state.timer = null;
  state.maxTimer = null;

  if (text.trim().length < Albert.MIN_TEXT_LENGTH) {
    Albert.clearCorrections(el);
    return;
  }

  if (state.lastCheckedText === text) return;

  // Charger les limites si pas encore fait
  await Albert.loadLimits();

  // Vérifier qu'on ne dépasse pas les limites
  const limitMsg = Albert.checkRateLimit();
  if (limitMsg) {
    console.warn("[Albert]", limitMsg);
    Albert.showRateLimitWarning(el, limitMsg);
    Albert.rateLimited = true;
    const delay = limitMsg.includes("jour") ? 3600000 : 60000;
    setTimeout(() => { Albert.rateLimited = false; }, delay);
    return;
  }

  if (state.badge) state.badge.classList.add("albert-loading");

  // Créer un AbortController pour cette requête
  const controller = new AbortController();
  state.abortController = controller;

  try {
    Albert.recordRequest();
    const response = await browser.runtime.sendMessage({ type: "check", text, mode: Albert.mode });

    // Vérifier si la requête a été annulée pendant l'attente
    if (controller.signal.aborted) return;

    if (response.error) {
      console.warn("[Albert]", response.error);
      if (response.retryAfter || response.error.includes("Limite de débit") || response.error.includes("Pause")) {
        const delay = (response.retryAfter || 30) * 1000;
        Albert.rateLimited = true;
        Albert.showRateLimitWarning(el, response.error);
        setTimeout(() => { Albert.rateLimited = false; }, delay);
      }
      return;
    }

    // Vérifier que le texte n'a pas changé pendant l'appel API
    if (controller.signal.aborted) return;
    const currentText = Albert.getTextContent(el);
    if (currentText !== text) return;

    const raw = response.corrections || [];
    state.corrections = Albert.filterIgnoredCorrections(raw, text);
    state.lang = response.lang || "fr";
    state.checkedText = text;
    state.lastCheckedText = text;
    Albert.renderCorrections(el);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("[Albert]", err);
    }
  } finally {
    if (state.abortController === controller) {
      state.abortController = null;
    }
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

      const state = Albert.getOrCreateState(el);
      if (!state.focused) continue;

      const text = Albert.getTextContent(el);
      if (text.trim().length < Albert.MIN_TEXT_LENGTH) continue;

      if (state.lastCheckedText === text) continue;

      await Albert.triggerCheck(el);
      await Albert.sleep(7000);
    }
  } finally {
    Albert.checkInProgress = false;
  }
};
