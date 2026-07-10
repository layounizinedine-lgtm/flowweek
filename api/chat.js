// FlowWeek Backend-Proxy fuer Anthropic
// Der API-Key liegt nur hier als Vercel-Umgebungsvariable, nie im Frontend-Code.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://layounizinedine-lgtm.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
const requestBuckets = new Map();

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function setSecurityHeaders(req, res) {
  const origin = req.headers.origin;
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return !origin || allowed.includes(origin);
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function rateLimit(req) {
  const key = clientIp(req);
  const now = Date.now();
  // Abgelaufene Buckets entfernen, damit die Map nicht unbegrenzt waechst
  if (requestBuckets.size > 1000) {
    for (const [k, b] of requestBuckets) {
      if (now > b.resetAt) requestBuckets.delete(k);
    }
  }
  const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return {
    ok: bucket.count <= MAX_REQUESTS_PER_WINDOW,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

module.exports = async function handler(req, res) {
  const originAllowed = setSecurityHeaders(req, res);

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Nur POST erlaubt" }); return; }
  if (!originAllowed) { res.status(403).json({ error: "Origin nicht erlaubt." }); return; }
  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    res.status(415).json({ error: "Content-Type muss application/json sein." });
    return;
  }
  if (Number(req.headers["content-length"] || 0) > 64 * 1024) {
    res.status(413).json({ error: "Request zu gross." });
    return;
  }
  const limit = rateLimit(req);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(429).json({ error: "Zu viele Anfragen. Bitte kurz warten." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server-Konfigurationsfehler: ANTHROPIC_API_KEY fehlt in Vercel." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    if (body.length > 64 * 1024) { res.status(413).json({ error: "Request zu gross." }); return; }
    try { body = JSON.parse(body); }
    catch (e) { res.status(400).json({ error: "Ungueltiges JSON im Request-Body." }); return; }
  }
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "Feld 'messages' (Array) fehlt." });
    return;
  }
  const safeMessages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!safeMessages.length) {
    res.status(400).json({ error: "Keine gueltigen Nachrichten gefunden." });
    return;
  }

  const payload = {
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
    max_tokens: Math.max(64, Math.min(Number(body.max_tokens) || 1000, 1600)),
    messages: safeMessages
  };
  if (body.system && typeof body.system === "string") payload.system = body.system.slice(0, 8000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      // Keine Upstream-Details an den Client durchreichen (Info-Leak)
      console.error("Anthropic error", upstream.status, data.error?.message);
      res.status(502).json({ error: "KI-Dienst aktuell nicht verfuegbar." });
      return;
    }
    const text = Array.isArray(data.content)
      ? data.content.filter((b) => b.type === "text").map((b) => b.text || "").join("\n").trim()
      : "";
    res.status(200).json({ text });
  } catch (err) {
    console.error("Anthropic unreachable", err);
    res.status(502).json({ error: "KI-Dienst aktuell nicht erreichbar." });
  } finally {
    clearTimeout(timeout);
  }
};


