// service-api.js --- Appels à l'API Albert (correction, reformulation, traduction).

"use strict";

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
        Accept: "application/json",
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
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (!Array.isArray(parsed.corrections)) {
      return { error: "Réponse API invalide : corrections manquantes." };
    }
    // Filtrer les suggestions incorrectes
    const corrections = (parsed.corrections || []).map((c) => {
      if (c.suggestions) {
        c.suggestions = c.suggestions.filter((s) => {
          // Supprimer les suggestions identiques au mot erroné
          if (s === c.word) return false;
          // Si le mot erroné finit par "s" (pluriel), la suggestion doit aussi finir par "s"
          if (c.word.endsWith("s") && !s.endsWith("s")) return false;
          return true;
        });
      }
      return c;
    }).filter((c) => !c.suggestions || c.suggestions.length > 0);
    return { corrections, lang };
  } catch (err) {
    return { error: `Erreur réseau : ${err.message}` };
  }
}

async function translateText(text, targetLang) {
  const config = await loadConfig();
  if (!config.apiKey) {
    return { error: "Clé API non configurée." };
  }

  const langSource = detectLanguage(text);
  const systemPrompt = await buildTranslationPrompt(langSource, targetLang);

  try {
    const body = {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    };

    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After"), 10) || 30;
        return { error: `Limite de débit dépassée. Pause de ${retryAfter}s.`, retryAfter };
      }
      return { error: `Erreur API (${response.status}) : ${detail}` };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return { error: "Réponse API invalide : contenu manquant." };
    }
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { error: "Réponse API invalide : JSON malformé." };
    }
    if (typeof parsed.translation !== "string") {
      return { error: "Réponse API invalide : traduction manquante." };
    }
    return { translation: parsed.translation, langSource, langCible: targetLang };
  } catch (err) {
    return { error: `Erreur réseau : ${err.message}` };
  }
}
