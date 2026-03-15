// albert-check.js — Vérification du texte via l'API Albert.
// Gère le debounce, l'appel API et le cycle de vérification.

"use strict";

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
  if (state.badge) state.badge.classList.add("albert-loading");

  try {
    const response = await browser.runtime.sendMessage({ type: "check", text });
    if (response.error) {
      console.warn("[Albert]", response.error);
      if (response.error.includes("Limite de débit")) {
        Albert.rateLimited = true;
        setTimeout(() => { Albert.rateLimited = false; }, 30000);
      }
      return;
    }
    state.corrections = response.corrections || [];
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
