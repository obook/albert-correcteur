// compose-limites.js --- Vérification des limites API côté client dans le compose.

"use strict";

Albert.checkRateLimit = function () {
  const limits = Albert.limits;
  if (!limits) return true;

  const now = Date.now();
  Albert.requestTimestamps = Albert.requestTimestamps.filter((t) => now - t < 60000);

  const rpm = limits.rpm;
  if (rpm && Albert.requestTimestamps.length >= rpm * 0.8) {
    return false;
  }

  return true;
};

Albert.recordRequest = function () {
  Albert.requestTimestamps.push(Date.now());
};

Albert.loadLimits = async function () {
  const limits = await browser.runtime.sendMessage({ type: "getLimits" });
  Albert.limits = limits;

  if (limits && limits.rpm) {
    const interval = Math.ceil(60000 / (limits.rpm * 0.4));
    Albert.DEBOUNCE_SHORT = Math.max(1500, interval);
    Albert.DEBOUNCE_MAX = Albert.DEBOUNCE_SHORT * 2.5;
  }
};
