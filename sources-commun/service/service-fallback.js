/*
 * service-fallback.js - Auto-fallback de modèle après 429 répétés.
 *
 * Si le modèle principal renvoie deux 429 d'affilée, on bascule
 * automatiquement vers un modèle plus petit pendant 60 s avant de
 * retenter le principal. Évite à l'utilisateur de subir des erreurs en
 * chaîne quand le large est saturé.
 *
 * API exposée (au scope global du service worker) :
 *   - selectEffectiveModel(primary) : renvoie le modèle à utiliser
 *     (primaire ou fallback selon l'état).
 *   - record429(primary)            : à appeler après chaque 429.
 *   - recordSuccess(primary)        : à appeler après chaque succès.
 *
 * Les ids canoniques (openai/gpt-oss-120b, etc.) sont normalisés en
 * alias par [[normalizeModelId]] dans service-config.js avant
 * d'arriver ici, donc la chaîne de fallback ne couvre que les alias.
 *
 * Auteur : O. Booklage
 * Date : mai 2026
 * Licence : MIT
 */

"use strict";

/* 429 consécutifs déclenchant le fallback. */
const FALLBACK_TRIGGER_429 = 2;

/* Durée pendant laquelle le fallback reste actif (en millisecondes). */
const FALLBACK_DURATION_MS = 60000;

/* Chaîne de fallback : modèle -> modèle de repli, en alias serveur. */
const FALLBACK_CHAIN = {
  "openweight-large": "openweight-medium",
  "openweight-medium": "openweight-small",
};

const consecutive429 = new Map();
const fallbackUntil = new Map();

/**
 * Renvoie le modèle effectif à utiliser pour un appel.
 * Si le primaire est en fallback actif, retourne son fallback.
 *
 * @param {string} primary - Modèle configuré par l'utilisateur.
 * @returns {string}
 */
function selectEffectiveModel(primary) {
  const until = fallbackUntil.get(primary);
  if (until) {
    if (until > Date.now()) {
      return FALLBACK_CHAIN[primary] || primary;
    }
    /* Entrée expirée : purger pour éviter une croissance lente de la Map
       sur une session longue avec de nombreux modèles testés. */
    fallbackUntil.delete(primary);
  }
  return primary;
}

/**
 * À appeler après un 429. Incrémente le compteur consécutif et, si le
 * seuil est atteint et qu'un fallback est connu, ouvre la fenêtre de
 * bascule.
 *
 * @param {string} primary - Modèle qui a échoué.
 */
function record429(primary) {
  if (!primary) return;
  const next = (consecutive429.get(primary) || 0) + 1;
  consecutive429.set(primary, next);
  const fallback = FALLBACK_CHAIN[primary];
  if (next >= FALLBACK_TRIGGER_429 && fallback) {
    fallbackUntil.set(primary, Date.now() + FALLBACK_DURATION_MS);
    consecutive429.set(primary, 0);
    AlbertLog.log(
      `[Albert] Fallback ${primary} -> ${fallback} pendant `
      + `${FALLBACK_DURATION_MS / 1000}s (deux 429 consécutifs)`
    );
  }
}

/**
 * À appeler après un succès. Réinitialise le compteur consécutif pour
 * que la prochaine série de 429 reparte de zéro.
 *
 * @param {string} primary - Modèle qui a réussi.
 */
function recordSuccess(primary) {
  if (!primary) return;
  consecutive429.delete(primary);
}
