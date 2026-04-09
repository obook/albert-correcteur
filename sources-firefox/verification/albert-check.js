/*
 * albert-check.js - Envoi du texte au service worker et cycle de vérification.
 *
 * Ce module contient la logique centrale de vérification :
 *
 * 1. triggerCheck(el) - Vérifie un champ unique :
 *    - Charge les limites API si nécessaire.
 *    - Vérifie qu'on ne dépasse pas le quota (rpm/rpd).
 *    - Détecte si un seul paragraphe a changé → vérification
 *      incrémentale (n'envoie que le paragraphe + contexte adjacent).
 *    - Envoie le texte au service worker via browser.runtime.sendMessage.
 *    - Recalibre les offsets, filtre les mots ignorés, fusionne
 *      les corrections et lance le rendu.
 *
 * 2. cycleCheckAll() - Vérifie tous les champs de la page :
 *    - Parcourt séquentiellement les champs suivis (le champ actif
 *      en premier) avec une pause de 7 s entre chaque.
 *    - Appelé périodiquement par setInterval (albert-main.js).
 *
 * Dépendances :
 *   - albert-utils.js    (splitParagraphs, findModifiedParagraph,
 *                          recalibrateOffsets, filterIgnoredCorrections)
 *   - albert-limites.js  (loadLimits, checkRateLimit, recordRequest)
 *   - albert-render.js   (renderCorrections, clearCorrections)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

/* Envoie le texte au script de fond pour correction.
   Utilise un AbortController pour pouvoir annuler la requête si le texte change.
   Vérification incrémentale : si un seul paragraphe a changé, n'envoie que
   ce paragraphe (+ contexte adjacent) et fusionne avec les corrections existantes. */
Albert.triggerCheck = async function (el) {
  const text = Albert.getTextContent(el);
  const state = Albert.getOrCreateState(el);

  /* Réinitialiser les timers (la vérification se lance) */
  clearTimeout(state.timer);
  clearTimeout(state.maxTimer);
  state.timer = null;
  state.maxTimer = null;

  if (text.trim().length < Albert.MIN_TEXT_LENGTH) {
    Albert.clearCorrections(el);
    return;
  }

  if (state.lastCheckedText === text) return;

  /* Charger les limites si pas encore fait */
  await Albert.loadLimits();

  /* Vérifier qu'on ne dépasse pas les limites */
  const limitMsg = Albert.checkRateLimit();
  if (limitMsg) {
    console.warn("[Albert]", limitMsg);
    Albert.showRateLimitWarning(el, limitMsg);
    Albert.rateLimited = true;
    const delay = limitMsg.includes("jour") ? 3600000 : 60000;
    setTimeout(() => { Albert.rateLimited = false; }, delay);
    return;
  }

  /* Détecter si un seul paragraphe a changé (vérification incrémentale) */
  let incremental = null;
  const oldChecked = state.lastCheckedText || "";
  if (oldChecked && state.corrections) {
    const oldParas = Albert.splitParagraphs(oldChecked);
    const newParas = Albert.splitParagraphs(text);
    const modIdx = Albert.findModifiedParagraph(oldParas, newParas);
    if (modIdx !== -1) {
      /* Construire le texte à envoyer : paragraphe modifié + contexte adjacent */
      const ctxStart = Math.max(0, modIdx - 1);
      const ctxEnd = Math.min(newParas.length - 1, modIdx + 1);
      const contextParas = newParas.slice(ctxStart, ctxEnd + 1);
      const sendText = contextParas.map((p) => p.text).join("\n");
      /* Offset du premier paragraphe du contexte dans le texte complet */
      const baseOffset = contextParas[0].offset;
      /* Offset du paragraphe modifié dans le texte envoyé */
      const modOffsetInSend = newParas[modIdx].offset - baseOffset;
      incremental = {
        sendText,
        baseOffset,
        modPara: newParas[modIdx],
        modOffsetInSend,
      };
    }
  }

  if (state.badge) {
    state.badge.classList.add("albert-loading");
    const img = state.badge.querySelector("img");
    if (img) img.src = Albert.ICON_URL;
  }

  /* Créer un AbortController pour cette requête */
  const controller = new AbortController();
  state.abortController = controller;

  try {
    Albert.recordRequest();
    const checkText = incremental ? incremental.sendText : text;
    const response = await browser.runtime.sendMessage({ type: "check", text: checkText, mode: Albert.mode });

    /* Vérifier si la requête a été annulée pendant l'attente */
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

    /* Vérifier que le texte n'a pas changé pendant l'appel API */
    if (controller.signal.aborted) return;
    const currentText = Albert.getTextContent(el);
    if (currentText !== text) return;

    const raw = response.corrections || [];

    if (incremental) {
      /* Recalibrer les offsets dans le texte envoyé */
      const recalibrated = Albert.recalibrateOffsets(raw, incremental.sendText);
      /* Décaler les offsets vers le texte complet */
      const shifted = recalibrated.map((c) =>
        Object.assign({}, c, { offset: c.offset + incremental.baseOffset })
      );
      const filtered = Albert.filterIgnoredCorrections(shifted, text);
      /* Fusionner : garder les corrections hors du paragraphe modifié + nouvelles */
      const modStart = incremental.modPara.offset;
      const modEnd = modStart + incremental.modPara.text.length;
      const kept = (state.corrections || []).filter((c) =>
        c.offset + c.length <= modStart || c.offset >= modEnd
      );
      state.corrections = kept.concat(filtered.filter((c) =>
        c.offset >= modStart && c.offset < modEnd
      )).sort((a, b) => a.offset - b.offset);
    } else {
      const recalibrated = Albert.recalibrateOffsets(raw, text);
      state.corrections = Albert.filterIgnoredCorrections(recalibrated, text);
    }

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
    if (state.badge) {
      state.badge.classList.remove("albert-loading");
      const img = state.badge.querySelector("img");
      const hasErrors = state.corrections && state.corrections.length > 0;
      if (img) img.src = hasErrors ? Albert.ICON_ERROR_URL : Albert.ICON_URL;
    }
  }
};

/* Vérifie tous les champs de la page, un par un (séquentiel).
   Le champ actif est vérifié en premier. */
Albert.cycleCheckAll = async function () {
  if (Albert.checkInProgress || Albert.rateLimited) return;
  Albert.checkInProgress = true;

  try {
    /* Nettoyer les champs retirés du DOM */
    for (const el of Albert.trackedFields) {
      if (!document.contains(el)) {
        Albert.trackedFields.delete(el);
      }
    }

    /* Le champ actif en premier */
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
