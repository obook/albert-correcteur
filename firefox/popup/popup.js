// Popup — configuration de la clé API, du modèle et de l'URL.

const form = document.getElementById("config-form");
const apiKeyInput = document.getElementById("api-key");
const modelSelect = document.getElementById("model");
const apiBaseInput = document.getElementById("api-base");
const refreshBtn = document.getElementById("refresh-models");
const statusDiv = document.getElementById("status");

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

// ── Charger les modèles depuis l'API ──

async function fetchModels() {
  const apiKey = apiKeyInput.value.trim();
  const apiBase = (apiBaseInput.value.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");

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

    // Récupérer le modèle précédemment sauvegardé
    const saved = (await browser.storage.local.get("model")).model || "";

    modelSelect.innerHTML = "";
    for (const id of models) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      if (id === saved) opt.selected = true;
      modelSelect.appendChild(opt);
    }

    // Si aucun modèle sauvegardé, le premier est sélectionné par défaut
    showStatus(`${models.length} modèle${models.length > 1 ? "s" : ""} disponible${models.length > 1 ? "s" : ""}`, "ok");
  } catch (err) {
    showStatus(`Erreur réseau : ${err.message}`, "err");
    modelSelect.innerHTML = '<option value="">Erreur réseau</option>';
  }
}

function showStatus(text, type) {
  statusDiv.textContent = text;
  statusDiv.className = `status ${type}`;
  if (type === "ok") {
    setTimeout(() => { statusDiv.textContent = ""; }, 3000);
  }
}

// ── Charger la config existante ──

browser.storage.local.get(["apiKey", "apiBase", "model"]).then((result) => {
  if (result.apiKey) apiKeyInput.value = result.apiKey;
  apiBaseInput.value = result.apiBase || DEFAULT_API_BASE;

  // Charger les modèles si la clé est déjà configurée
  if (result.apiKey) {
    fetchModels();
  }
});

// ── Recharger les modèles ──

refreshBtn.addEventListener("click", () => fetchModels());

// ── Enregistrer ──

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;

  if (!apiKey) {
    showStatus("La clé API est obligatoire.", "err");
    return;
  }
  if (!model) {
    showStatus("Sélectionnez un modèle.", "err");
    return;
  }

  await browser.storage.local.set({ apiKey, model, apiBase });
  showStatus("Configuration enregistrée.", "ok");
});
