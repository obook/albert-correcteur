/*
 * rolling-window.js - Compteur d'évènements sur une fenêtre glissante.
 *
 * Petite structure utilitaire pour suivre les requêtes (rpm) ou les
 * tokens (tpm) consommés sur les 60 dernières secondes. Inspirée de
 * la classe RollingWindow d'AlbertCode (Python), portée en JavaScript.
 *
 * API :
 *   - add(count = 1)            ajoute un évènement (1 requête, N tokens).
 *   - total()                   somme des évènements toujours dans la fenêtre.
 *   - secondsUntilNextSlot()    secondes avant qu'un slot ne se libère.
 *   - reset()                   vide la fenêtre.
 *
 * Usage :
 *   const win = new Albert.RollingWindow(60000);
 *   win.add();                              // 1 requête à l'instant
 *   if (win.total() >= rpm) {
 *     const wait = win.secondsUntilNextSlot();
 *     ...
 *   }
 *
 * Ce fichier doit être chargé APRÈS le script qui définit Albert
 * (albert-state.js côté Firefox, compose-state.js côté Thunderbird).
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

Albert.RollingWindow = class RollingWindow {
  /**
   * @param {number} windowMs - Largeur de la fenêtre en millisecondes.
   */
  constructor(windowMs = 60000) {
    this._windowMs = windowMs;
    /** @type {Array<{ts: number, count: number}>} */
    this._events = [];
  }

  /**
   * Ajoute un évènement daté de maintenant.
   *
   * @param {number} count - Quantité (1 pour une requête, N pour tokens).
   */
  add(count = 1) {
    this._events.push({ ts: Date.now(), count });
  }

  /**
   * Total des évènements toujours dans la fenêtre.
   */
  total() {
    this._evict();
    let sum = 0;
    for (const ev of this._events) sum += ev.count;
    return sum;
  }

  /**
   * Temps avant qu'un slot ne se libère, en secondes.
   */
  secondsUntilNextSlot() {
    this._evict();
    if (this._events.length === 0) return 0;
    const oldest = this._events[0].ts;
    const remaining = (oldest + this._windowMs - Date.now()) / 1000;
    return Math.max(0, remaining);
  }

  reset() {
    this._events = [];
  }

  /** Évince les évènements sortis de la fenêtre. */
  _evict() {
    const cutoff = Date.now() - this._windowMs;
    while (this._events.length && this._events[0].ts < cutoff) {
      this._events.shift();
    }
  }
};
