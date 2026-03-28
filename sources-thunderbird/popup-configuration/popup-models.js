// popup-models.js — Chargement des modèles depuis l'API.

"use strict";

const modelSelect = document.getElementById("model");
const refreshBtn = document.getElementById("refresh-models");

async function fetchModels() {
  const apiKey = document.getElementById("api-key").value.trim();
  const apiBase = (document.getElementById("api-base").value.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");

  if (!apiKey) {
    showStatus("Entrez d'abord la clé API.", "err");
    return;
  }

  modelSelect.innerHTML = '<option value="">Chargement…</option>';

  try {
    const response = await fetch(`${apiBase}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      showStatus(`Erreur API (${response.status})`, "err");
      modelSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      return;
    }

    const data = await response.json();
    const models = (data.data || [])
      .filter((m) => m.type === "text-generation")
      .map((m) => m.id)
      .sort();

    if (models.length === 0) {
      modelSelect.innerHTML = '<option value="">Aucun modèle text-generation</option>';
      return;
    }

    const saved = (await browser.storage.local.get("model")).model || "";

    modelSelect.innerHTML = "";
    for (const id of models) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      if (id === saved) opt.selected = true;
      modelSelect.appendChild(opt);
    }

    showStatus(`${models.length} modèle${models.length > 1 ? "s" : ""} disponible${models.length > 1 ? "s" : ""}`, "ok");
  } catch (err) {
    showStatus(`Erreur réseau : ${err.message}`, "err");
    modelSelect.innerHTML = '<option value="">Erreur réseau</option>';
  }
}

refreshBtn.addEventListener("click", () => fetchModels());
