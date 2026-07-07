// FlowWeek Backend-Proxy für Anthropic
// Der API-Key liegt NUR hier als Vercel-Umgebungsvariable, nie im Frontend-Code.

module.exports = async function handler(req, res) {
  // CORS: erlaubt Aufrufe von GitHub Pages (und überall, da kein Nutzer-Login hier nötig ist)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Nur POST erlaubt" }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server-Konfigurationsfehler: ANTHROPIC_API_KEY fehlt in Vercel." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch (e) { res.status(400).json({ error: "Ungültiges JSON im Request-Body." }); return; }
  }
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "Feld 'messages' (Array) fehlt." });
    return;
  }

  const payload = {
    model: "claude-sonnet-5", // fest codiert: gültige Modell-ID für die echte Anthropic-API
    max_tokens: Math.min(Number(body.max_tokens) || 1000, 2000),
    messages: body.messages
  };
  if (body.system) payload.system = body.system;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Anthropic nicht erreichbar", detail: String(err) });
  }
};

