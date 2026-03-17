// popup-limits.js — Affichage des limites du compte.

"use strict";

const limitsSection = document.getElementById("limits-section");
const limitsInfo = document.getElementById("limits-info");

const LIMIT_LABELS = {
  rpm: "Requêtes / minute",
  rpd: "Requêtes / jour",
  tpm: "Tokens / minute",
  tpd: "Tokens / jour",
};

async function fetchAndShowLimits() {
  const apiKey = document.getElementById("api-key").value.trim();
  const apiBase = (document.getElementById("api-base").value.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
  if (!apiKey) return;

  try {
    const response = await fetch(`${apiBase}/v1/me/info`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return;

    const data = await response.json();
    const rawLimits = data.limits || [];
    if (rawLimits.length === 0) return;

    // Regrouper par type et garder la valeur la plus restrictive (minimum)
    const merged = {};
    for (const l of rawLimits) {
      if (!(l.type in merged)) {
        merged[l.type] = l.value;
      } else if (l.value === null) {
        // null = illimité, on garde la valeur existante (plus restrictive)
      } else if (merged[l.type] === null) {
        merged[l.type] = l.value;
      } else {
        merged[l.type] = Math.min(merged[l.type], l.value);
      }
    }

    limitsInfo.textContent = "";
    for (const [type, value] of Object.entries(merged)) {
      const label = LIMIT_LABELS[type] || type;
      const display = value === null ? "illimité" : value.toLocaleString("fr-FR");
      const cls = value === null ? "limit-value unlimited" : "limit-value";
      const row = document.createElement("div");
      row.className = "limit-row";
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      const valueSpan = document.createElement("span");
      valueSpan.className = cls;
      valueSpan.textContent = display;
      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      limitsInfo.appendChild(row);
    }
    limitsSection.style.display = "block";
  } catch {
    // Silencieux si l'endpoint n'est pas disponible
  }
}
