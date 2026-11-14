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
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

/* Marque le badge d'un champ en état de panne API (clé invalide, 5xx,
   réseau coupé, etc.) avec un tooltip explicite et autorise la relance
   manuelle au clic. */
Albert.markBadgeApiError = function (el, message) {
  const state = Albert.getOrCreateState(el);
  state.lastError = { message, at: Date.now() };
  Albert.lastApiError = { message, at: Date.now() };
  if (!state.badge) return;
  state.badge.classList.remove("albert-loading", "albert-rate-limited");
  state.badge.classList.add("albert-api-error");
  state.badge.title = `Albert indisponible : ${message}\nCliquez pour réessayer.`;
  state.badge.setAttribute("aria-label", state.badge.title);
  const img = state.badge.querySelector("img");
  if (img) img.src = Albert.ICON_URL;
};

/* Efface l'état de panne d'un champ (appelé après une vérification
   réussie ou avant une relance manuelle). */
Albert.clearBadgeApiError = function (el) {
  const state = Albert.getOrCreateState(el);
  state.lastError = null;
  if (!state.badge) return;
  state.badge.classList.remove("albert-api-error");
  state.badge.title = "Albert Correcteur : cliquez pour vérifier";
  state.badge.setAttribute(
    "aria-label", "Albert Correcteur : cliquez pour vérifier"
  );
};

/* Envoie le texte au script de fond pour correction.
   Utilise un AbortController pour pouvoir annuler la requête si le texte change.
   Vérification incrémentale : si un seul paragraphe a changé, n'envoie que
   ce paragraphe (+ contexte adjacent) et fusionne avec les corrections existantes.
   Si force = true, ignore le cache lastCheckedText (relance manuelle après panne). */
Albert.triggerCheck = async function (el, force) {
  const text = Albert.getTextContent(el);
  const state = Albert.getOrCreateState(el);

  /* Requête en cours sur ce champ : reprendre après elle, sinon ce
     texte n'était vérifié qu'au cycle suivant. Pas de scheduleCheck,
     qui abandonnerait la requête déjà facturée. */
  if (state.checkRunning) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => Albert.triggerCheck(el, force), Albert.DEBOUNCE_MS);
    return;
  }

  /* Réinitialiser les timers (la vérification se lance) */
  clearTimeout(state.timer);
  clearTimeout(state.maxTimer);
  state.timer = null;
  state.maxTimer = null;

  if (text.trim().length < Albert.MIN_TEXT_LENGTH) {
    Albert.clearCorrections(el);
    Albert.clearBadgeApiError(el);
    return;
  }

  /* Une relance manuelle (clic sur badge en erreur) doit forcer la requête
     même si le texte est identique au dernier vérifié. */
  if (force) {
    state.lastCheckedText = null;
    Albert.clearBadgeApiError(el);
  }

  /* Quota atteint : seule une relance manuelle passe, sinon chaque
     pause de frappe renvoyait une requête et un toast d'erreur. */
  if (Albert.rateLimited && !force) return;

  if (state.lastCheckedText === text) return;

  /* Verrou par champ posé avant le premier await : sans lui, deux
     appels concurrents (frappe et cycle périodique) se croisent pendant
     le chargement des limites, partent tous les deux vers l'API et
     s'écrasent mutuellement le badge. */
  state.checkRunning = true;

  try {
    await Albert._triggerCheckInterne(el, state, text);
  } finally {
    state.checkRunning = false;
  }
};

/* Corps de la vérification, exécuté sous le verrou state.checkRunning. */
Albert._triggerCheckInterne = async function (el, state, text) {
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
      incremental = {
        sendText,
        baseOffset,
        modPara: newParas[modIdx],
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
      /* Toute réponse de rate-limit du service worker porte le champ
         retryAfter ; c'est notre marqueur unique, indépendant du libellé
         textuel du message. */
      if (response.retryAfter) {
        const delay = response.retryAfter * 1000;
        Albert.rateLimited = true;
        Albert.showRateLimitWarning(el, response.error);
        setTimeout(() => { Albert.rateLimited = false; }, delay);
      } else {
        /* Panne API persistante (clé invalide, 5xx, réseau, modèle introuvable...) :
           afficher un état d'erreur explicite sur le badge et un toast. */
        Albert.markBadgeApiError(el, response.error);
        Albert.showToast(`Albert : ${response.error}`, 15000);
      }
      return;
    }

    /* Vérification réussie : effacer un éventuel état de panne précédent */
    Albert.clearBadgeApiError(el);
    Albert.lastApiError = null;

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
      Albert.markBadgeApiError(el, err.message || "Erreur interne");
      Albert.showToast(`Albert : ${err.message || "Erreur interne"}`, 15000);
    }
  } finally {
    if (state.abortController === controller) {
      state.abortController = null;
    }
    if (state.badge && !state.badge.classList.contains("albert-api-error")) {
      state.badge.classList.remove("albert-loading");
      const img = state.badge.querySelector("img");
      const hasErrors = state.corrections && state.corrections.length > 0;
      if (img) img.src = hasErrors ? Albert.ICON_ERROR_URL : Albert.ICON_OK_URL;
    }
  }
};

/* Vérifie tous les champs de la page, un par un (séquentiel).
   Le champ actif est vérifié en premier. */
Albert.cycleCheckAll = async function () {
  if (Albert.checkInProgress || Albert.rateLimited) return;
  Albert.checkInProgress = true;

  try {
    /* Nettoyer les champs retirés du DOM, overlay et badge compris */
    for (const el of Albert.trackedFields) {
      if (!document.contains(el)) {
        Albert.detachField(el);
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
