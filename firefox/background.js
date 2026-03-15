// Background script — communique avec l'API Albert pour la correction de texte.

const DEFAULT_API_BASE = "https://albert.api.etalab.gouv.fr";

const SYSTEM_PROMPT = `Tu es un correcteur orthographique et grammatical français expert.
Analyse le texte fourni par l'utilisateur et retourne les erreurs trouvées au format JSON strict.

Pour chaque erreur, indique :
- "offset" : position du premier caractère erroné (index basé sur 0)
- "length" : nombre de caractères du mot ou groupe erroné
- "message" : explication courte de l'erreur
- "suggestions" : liste de 1 à 3 corrections possibles (la meilleure en premier)
- "type" : "spelling" (orthographe), "grammar" (grammaire) ou "style" (style)

Règles :
- Ne signale que les vraies erreurs, pas les variantes acceptables.
- Les offsets doivent correspondre exactement au texte original.
- Si aucune erreur, retourne {"corrections": []}.
- Retourne uniquement le JSON, sans commentaire ni explication autour.`;

async function loadConfig() {
  const result = await browser.storage.local.get(["apiKey", "apiBase", "model"]);
  return {
    apiKey: result.apiKey || "",
    apiBase: (result.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: result.model || "",
  };
}

async function checkText(text) {
  const config = await loadConfig();
  if (!config.apiKey) {
    return { error: "Clé API non configurée. Cliquez sur l'icône Albert pour la configurer." };
  }

  try {
    const body = {
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
        return { error: "Limite de débit dépassée. Réessayez dans quelques secondes." };
      }
      return { error: `Erreur API (${response.status}) : ${detail}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return { corrections: parsed.corrections || [] };
  } catch (err) {
    return { error: `Erreur réseau : ${err.message}` };
  }
}

// Écoute les messages du content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check") {
    checkText(message.text).then(sendResponse);
    return true; // réponse asynchrone
  }
  if (message.type === "getConfig") {
    loadConfig().then(sendResponse);
    return true;
  }
});
