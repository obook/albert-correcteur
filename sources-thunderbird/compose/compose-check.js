// compose-check.js --- Déclenchement de la vérification dans le compose Thunderbird.

"use strict";

Albert.pendingAbort = null;

Albert.requestCheck = function (text) {
  const state = Albert.composeState;
  if (!state) return;

  if (state.checkedText === text) return;

  if (!Albert.checkRateLimit()) {
    Albert.showToast("Limite API approchée, vérification reportée.");
    return;
  }

  if (Albert.pendingAbort) Albert.pendingAbort.abort();
  const controller = new AbortController();
  Albert.pendingAbort = controller;

  Albert.setBadgeState("loading");
  Albert.recordRequest();

  browser.runtime.sendMessage({ type: "check", text: text, mode: "correction" }).then((result) => {
    if (controller.signal.aborted) return;
    Albert.pendingAbort = null;

    if (Albert.debounceTimer) { clearTimeout(Albert.debounceTimer); Albert.debounceTimer = null; }
    if (Albert.debounceMaxTimer) { clearTimeout(Albert.debounceMaxTimer); Albert.debounceMaxTimer = null; }

    if (result.error) {
      Albert.setBadgeState("error");
      if (result.retryAfter) {
        Albert.showToast(result.error, result.retryAfter * 1000);
      } else {
        Albert.showToast(result.error);
      }
      return;
    }

    state.checkedText = text;
    const filtered = Albert.filterIgnoredCorrections(result.corrections);
    Albert.renderCorrections(filtered);
  }).catch(() => {
    if (!controller.signal.aborted) {
      Albert.setBadgeState("error");
    }
  });
};
