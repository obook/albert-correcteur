// Background script — communique avec l'API Albert pour la correction de texte.

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

// ── Détection de langue locale (sans appel externe, RGPD) ──

const LANG_WORDS = {
  fr: ["le", "la", "les", "de", "des", "un", "une", "du", "est", "et", "en", "que", "qui", "dans", "pour", "pas", "sur", "avec", "ce", "sont", "nous", "vous", "ils", "mais", "plus", "être", "avoir", "cette", "tout", "aussi"],
  en: ["the", "is", "are", "was", "were", "of", "and", "to", "in", "that", "it", "for", "not", "on", "with", "this", "but", "from", "they", "have", "has", "been", "would", "will", "can", "which", "their", "there", "about"],
  es: ["el", "la", "los", "las", "de", "en", "que", "es", "un", "una", "por", "con", "para", "del", "como", "más", "pero", "sus", "está", "son", "tiene", "todo", "esta", "también", "nos", "fue", "hay", "muy", "entre"],
  de: ["der", "die", "das", "und", "ist", "ein", "eine", "für", "mit", "auf", "den", "dem", "sich", "des", "nicht", "von", "sind", "wird", "auch", "als", "ich", "wir", "aber", "nach", "noch", "wie", "bei", "nur", "kann"],
};

const LANG_NAMES = { fr: "français", en: "anglais", es: "espagnol", de: "allemand" };

function detectLanguage(text) {
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, "").split(/\s+/);
  const scores = {};

  for (const [lang, markers] of Object.entries(LANG_WORDS)) {
    scores[lang] = words.filter((w) => markers.includes(w)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  // Seuil minimum : au moins 2 mots reconnus
  if (best[1] < 2) return "fr";
  return best[0];
}

// ── Prompts (chargés depuis les fichiers texte dans prompts/) ──

const promptCache = {};

async function loadPromptTemplate(name) {
  if (promptCache[name]) return promptCache[name];
  const url = browser.runtime.getURL(`prompts/${name}.txt`);
  const response = await fetch(url);
  const text = await response.text();
  promptCache[name] = text;
  return text;
}

async function buildPrompt(mode, lang) {
  const name = mode === "reformulation" ? "reformulation" : "correction";
  const template = await loadPromptTemplate(name);
  const langName = LANG_NAMES[lang] || "français";
  return template.replace(/\{\{LANG\}\}/g, langName);
}

async function loadConfig() {
  const result = await browser.storage.local.get(["apiKey", "apiBase", "model"]);
  return {
    apiKey: result.apiKey || "",
    apiBase: (result.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: result.model || "",
  };
}

// Cache des limites utilisateur (durée : 10 minutes)
let cachedLimits = null;
let limitsExpiry = 0;

async function fetchLimits() {
  const now = Date.now();
  if (cachedLimits && now < limitsExpiry) return cachedLimits;

  const config = await loadConfig();
  if (!config.apiKey) return null;

  try {
    const response = await fetch(`${config.apiBase}/v1/me/info`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) return cachedLimits;

    const data = await response.json();
    const limits = {};
    for (const l of data.limits || []) {
      if (l.value === null) continue;
      if (!(l.type in limits) || l.value < limits[l.type]) {
        limits[l.type] = l.value;
      }
    }
    cachedLimits = limits;
    limitsExpiry = now + 10 * 60 * 1000;
    return limits;
  } catch {
    return cachedLimits;
  }
}

async function checkText(text, mode) {
  const config = await loadConfig();
  if (!config.apiKey) {
    return { error: "Clé API non configurée. Cliquez sur l'icône Albert pour la configurer." };
  }

  const lang = detectLanguage(text);
  const systemPrompt = await buildPrompt(mode, lang);

  try {
    const body = {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    };

    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After"), 10) || 30;
        // Extraire le type de limite depuis la réponse API si disponible
        let limitType = "";
        try {
          const err = JSON.parse(detail);
          const msg = (err.detail || err.message || "").toLowerCase();
          if (msg.includes("rpm") || msg.includes("requests per minute")) limitType = "requêtes/minute (rpm)";
          else if (msg.includes("rpd") || msg.includes("requests per day")) limitType = "requêtes/jour (rpd)";
          else if (msg.includes("tpm") || msg.includes("tokens per minute")) limitType = "tokens/minute (tpm)";
          else if (msg.includes("tpd") || msg.includes("tokens per day")) limitType = "tokens/jour (tpd)";
        } catch { /* réponse non-JSON */ }
        const desc = limitType ? `Limite ${limitType} dépassée.` : "Limite de débit dépassée.";
        return { error: `${desc} Pause de ${retryAfter}s.`, retryAfter };
      }
      return { error: `Erreur API (${response.status}) : ${detail}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return { corrections: parsed.corrections || [], lang };
  } catch (err) {
    return { error: `Erreur réseau : ${err.message}` };
  }
}

// ── Menu contextuel : Reformuler avec Albert ──

browser.contextMenus.create({
  id: "albert-reformulate",
  title: "Reformuler avec Albert",
  contexts: ["selection"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "albert-reformulate") return;
  const text = info.selectionText;
  if (!text || text.trim().length < 3) return;

  const result = await checkText(text, "reformulation");
  // Envoyer le résultat au content script de l'onglet actif
  browser.tabs.sendMessage(tab.id, {
    type: "reformulateResult",
    originalText: text,
    result,
  });
});

// Invalider le cache des limites quand la config change (clé API, modèle, URL)
browser.storage.onChanged.addListener((changes) => {
  if (changes.apiKey || changes.model || changes.apiBase) {
    cachedLimits = null;
    limitsExpiry = 0;
  }
});

// Écoute les messages du content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check") {
    checkText(message.text, message.mode).then(sendResponse);
    return true; // réponse asynchrone
  }
  if (message.type === "getConfig") {
    loadConfig().then(sendResponse);
    return true;
  }
  if (message.type === "getLimits") {
    fetchLimits().then(sendResponse);
    return true;
  }
});
