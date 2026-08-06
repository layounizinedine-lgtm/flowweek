// FlowWeek Kalender-Feed (iCalendar / ICS)
//
// Liefert den Wochenplan eines Nutzers als abonnierbaren Kalender aus. Apple
// Kalender, Google Kalender und Outlook holen sich diese URL selbststaendig in
// regelmaessigen Abstaenden - der Nutzer verbindet also EINMAL und muss danach
// nie wieder etwas exportieren oder importieren.
//
// Authentifizierung laeuft ueber einen geheimen Feed-Token in der URL, weil
// Kalender-Apps sich nicht per OAuth anmelden koennen. Der Server kennt nur den
// SHA-256-Hash des Tokens; nachgeschlagen wird mit dem Supabase-Service-Key,
// der ausschliesslich hier als Vercel-Umgebungsvariable liegt.

const crypto = require("node:crypto");

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const CATS = ["Fokus", "Lernen", "Arbeit", "Sport", "Privat", "Erholung"];
const PRIO_LABEL = { high: "Wichtig", medium: "Sollte", normal: "Normal", low: "Optional" };
const TOKEN_RX = /^[A-Za-z0-9_-]{32,128}$/;
const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RX = /^[A-Za-z0-9_-]{1,40}$/;
const DEFAULT_TZ = "Europe/Berlin";
const WINDOW_MS = 60 * 1000;
const ACCESS_TOUCH_MS = 5 * 60 * 1000; // last_access_at nicht bei jedem Abruf schreiben

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const WEEKS_BACK = clampInt(process.env.CALENDAR_WEEKS_BACK, 8, 0, 52);
const WEEKS_AHEAD = clampInt(process.env.CALENDAR_WEEKS_AHEAD, 26, 1, 104);
const MAX_REQUESTS_PER_WINDOW = clampInt(process.env.CALENDAR_RATE_LIMIT_PER_MINUTE, 60, 1, 600);
const requestBuckets = new Map();

/* ============================================================
   iCalendar-Bausteine (pur, ohne Netzwerk - wird von test/ics.test.mjs getestet)
   ============================================================ */

function pad(n) { return String(n).padStart(2, "0"); }

/* Steuerzeichen entfernen und kuerzen - Titel/Notizen stammen aus Nutzereingaben. */
function sanitize(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, max)
    .trim();
}

/* RFC 5545: Backslash, Semikolon, Komma und Zeilenumbrueche maskieren. */
function icsEscape(value) {
  return String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/* RFC 5545: Zeilen duerfen max. 75 Oktette lang sein. Umbruch mit CRLF + Space.
   Es wird nach Bytes gezaehlt, aber nie mitten in ein UTF-8-Zeichen geschnitten. */
function foldLine(line) {
  const bytes = Buffer.from(String(line), "utf8");
  if (bytes.length <= 75) return String(line);
  const parts = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    if (end === start) end = Math.min(start + limit, bytes.length); // Notbremse
    parts.push(bytes.slice(start, end).toString("utf8"));
    start = end;
    limit = 74; // Folgezeilen beginnen mit einem Leerzeichen
  }
  return parts.join("\r\n ");
}

function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!m) return null;
  const part = { y: +m[1], m: +m[2], d: +m[3] };
  const probe = new Date(Date.UTC(part.y, part.m - 1, part.d));
  if (probe.getUTCMonth() + 1 !== part.m || probe.getUTCDate() !== part.d) return null;
  return part;
}

function formatDateKey(part) {
  return part.y + "-" + pad(part.m) + "-" + pad(part.d);
}

function addDays(part, days) {
  const d = new Date(Date.UTC(part.y, part.m - 1, part.d) + days * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/* Zeitzone nur uebernehmen, wenn sie wie eine IANA-Zone aussieht UND von Intl
   akzeptiert wird - der Wert landet sonst ungeprueft im Kalender-Feed. */
function safeTimeZone(tz) {
  const t = String(tz || "").trim();
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(t)) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: t }).format(new Date());
    return t;
  } catch (e) {
    return DEFAULT_TZ;
  }
}

/* Offset der Zeitzone (in Minuten) zum gegebenen Zeitpunkt. */
function tzOffsetMinutes(ts, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(ts))) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return (asUtc - ts) / 60000;
}

/* Wanduhrzeit in einer Zeitzone -> echter UTC-Zeitpunkt.
   Zwei Durchgaenge, damit auch Termine direkt an der Sommerzeit-Umstellung
   auf der richtigen Seite landen. */
function zonedToUtc(part, hh, mm, timeZone) {
  const naive = Date.UTC(part.y, part.m - 1, part.d, hh, mm, 0);
  const first = naive - tzOffsetMinutes(naive, timeZone) * 60000;
  return new Date(naive - tzOffsetMinutes(first, timeZone) * 60000);
}

function utcStamp(date) {
  return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + "T" +
    pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + "Z";
}

function dateStamp(part) { return part.y + pad(part.m) + pad(part.d); }

/* Heutiges Datum in der Zeitzone des Nutzers (nicht der des Servers). */
function todayInZone(now, timeZone) {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  const parsed = parseDateKey(s);
  return parsed || { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
}

function mondayInZone(now, timeZone) {
  const today = todayInZone(now, timeZone);
  const dow = (new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay() + 6) % 7;
  return addDays(today, -dow);
}

/* Wochen-Keys des Feed-Fensters - identisch aufgebaut wie im Frontend ("week:JJJJ-MM-TT"). */
function weekWindowKeys(now, timeZone, back, ahead) {
  const monday = mondayInZone(now, timeZone);
  const keys = [];
  for (let i = -Math.abs(back); i <= Math.abs(ahead); i++) {
    keys.push(formatDateKey(addDays(monday, i * 7)));
  }
  return keys;
}

/* Stabile UID auch fuer Eintraege ohne brauchbare id: aus dem Inhalt abgeleitet,
   damit derselbe Termin beim naechsten Abruf nicht als neues Event auftaucht. */
function stableId(raw, date) {
  if (raw && typeof raw.id === "string" && ID_RX.test(raw.id)) return raw.id;
  const seed = dateStamp(date) + "|" + sanitize(raw && raw.title, 120) + "|" + sanitize(raw && raw.time, 5);
  return "x" + crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function taskEvent(raw, date, timezone, dtstamp, uidOverride) {
  if (!raw || typeof raw !== "object") return null;
  const title = sanitize(raw.title, 120) || "Aufgabe";
  const time = TIME_RX.test(String(raw.time || "")) ? String(raw.time) : "";
  const durationRaw = Number(raw.duration);
  const duration = durationRaw > 0 ? Math.min(480, Math.round(durationRaw)) : 30;
  const catRaw = raw.cat || raw.category;
  const cat = CATS.includes(catRaw) ? catRaw : "";
  const priority = PRIO_LABEL[raw.priority] ? raw.priority : "normal";
  const notes = sanitize(raw.notes, 140);

  const ev = {
    uid: (uidOverride || stableId(raw, date)) + "@flowweek",
    dtstamp,
    summary: title,
    category: cat,
    allDay: !time
  };
  if (time) {
    const [hh, mm] = time.split(":").map(Number);
    const start = zonedToUtc(date, hh, mm, timezone);
    ev.start = utcStamp(start);
    ev.end = utcStamp(new Date(start.getTime() + duration * 60000));
  } else {
    ev.start = dateStamp(date);
    ev.end = dateStamp(addDays(date, 1));
  }
  const desc = [];
  if (notes) desc.push(notes);
  if (cat) desc.push("Kategorie: " + cat);
  if (priority !== "normal") desc.push("Priorität: " + PRIO_LABEL[priority]);
  if (uidOverride) desc.push("Fester Termin (wiederholt sich jede Woche)");
  desc.push("Geplant mit FlowWeek");
  ev.description = desc.join("\n");
  return ev;
}

function pushEvent(lines, ev) {
  lines.push("BEGIN:VEVENT");
  lines.push("UID:" + ev.uid);
  lines.push("DTSTAMP:" + ev.dtstamp);
  if (ev.allDay) {
    lines.push("DTSTART;VALUE=DATE:" + ev.start);
    lines.push("DTEND;VALUE=DATE:" + ev.end);
    lines.push("TRANSP:TRANSPARENT"); // Termine ohne Uhrzeit blockieren den Tag nicht
  } else {
    lines.push("DTSTART:" + ev.start);
    lines.push("DTEND:" + ev.end);
    lines.push("TRANSP:OPAQUE");
  }
  lines.push("SUMMARY:" + icsEscape(ev.summary));
  if (ev.description) lines.push("DESCRIPTION:" + icsEscape(ev.description));
  if (ev.category) lines.push("CATEGORIES:" + icsEscape(ev.category));
  lines.push("STATUS:CONFIRMED");
  lines.push("SEQUENCE:0");
  lines.push("END:VEVENT");
}

/* Baut den kompletten Feed.
   Feste Termine werden bewusst als Einzeltermine je Woche ausgegeben statt als
   RRULE: So stimmt die Uhrzeit auch ueber die Sommerzeit-Umstellung hinweg,
   ohne dass eine VTIMEZONE-Komponente noetig ist. */
function buildCalendar(opts) {
  const o = opts || {};
  const timezone = safeTimeZone(o.timezone);
  const now = o.now instanceof Date ? o.now : new Date();
  const dtstamp = utcStamp(now);
  const routines = Array.isArray(o.routines) ? o.routines : [];
  const weeks = Array.isArray(o.weeks) ? o.weeks : [];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FlowWeek//Wochenplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsEscape(sanitize(o.name, 60) || "FlowWeek"),
    "X-WR-CALDESC:Dein FlowWeek-Wochenplan. Aktualisiert sich automatisch.",
    "X-WR-TIMEZONE:" + timezone,
    // Hinweis an die Kalender-App, wie oft sie neu laden soll
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M"
  ];

  const seen = new Set();
  for (const entry of weeks) {
    const monday = parseDateKey(entry && entry.monday);
    if (!monday) continue;
    const data = (entry.data && typeof entry.data === "object") ? entry.data : {};
    DAYS.forEach((day, idx) => {
      const date = addDays(monday, idx);
      const list = Array.isArray(data[day]) ? data[day] : [];
      for (const raw of list) {
        const ev = taskEvent(raw, date, timezone, dtstamp, null);
        if (ev && !seen.has(ev.uid)) { seen.add(ev.uid); pushEvent(lines, ev); }
      }
      for (const routine of routines) {
        if (!routine || routine.day !== day) continue;
        const ev = taskEvent(routine, date, timezone, dtstamp, "r-" + stableId(routine, date) + "-" + dateStamp(date));
        if (ev && !seen.has(ev.uid)) { seen.add(ev.uid); pushEvent(lines, ev); }
      }
    });
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/* ============================================================
   HTTP-Handler
   ============================================================ */

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "unknown";
}

function rateLimit(req) {
  const key = clientIp(req);
  const now = Date.now();
  if (requestBuckets.size > 1000) {
    for (const [k, b] of requestBuckets) { if (now > b.resetAt) requestBuckets.delete(k); }
  }
  const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + WINDOW_MS; }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return {
    ok: bucket.count <= MAX_REQUESTS_PER_WINDOW,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

function supabaseHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: "Bearer " + serviceKey,
    Accept: "application/json"
  };
}

async function supabaseGet(baseUrl, path, params, serviceKey, signal) {
  const url = baseUrl.replace(/\/+$/, "") + "/rest/v1/" + path + "?" + params.toString();
  const res = await fetch(url, { headers: supabaseHeaders(serviceKey), signal });
  if (!res.ok) throw new Error("Supabase " + path + " " + res.status);
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "private, max-age=300");

  if (req.method === "OPTIONS") { res.setHeader("Allow", "GET, HEAD"); res.status(204).end(); return; }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "Nur GET erlaubt" });
    return;
  }

  const limit = rateLimit(req);
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(429).json({ error: "Zu viele Anfragen." });
    return;
  }

  let token = "";
  try {
    token = new URL(req.url, "http://localhost").searchParams.get("token") || "";
  } catch (e) { token = ""; }
  // Gleiche Antwort fuer "fehlt" und "ungueltig": kein Hinweis fuers Durchprobieren
  if (!TOKEN_RX.test(token)) { res.status(404).json({ error: "Kalender nicht gefunden." }); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Kalender-Feed: SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt");
    res.status(500).json({ error: "Server-Konfigurationsfehler." });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const feedParams = new URLSearchParams();
    feedParams.set("select", "user_id,timezone,last_access_at");
    feedParams.set("token_hash", "eq." + tokenHash);
    feedParams.set("limit", "1");
    const feeds = await supabaseGet(supabaseUrl, "flowweek_calendar_feeds", feedParams, serviceKey, controller.signal);
    const feed = Array.isArray(feeds) ? feeds[0] : null;
    if (!feed) { res.status(404).json({ error: "Kalender nicht gefunden." }); return; }

    const timezone = safeTimeZone(feed.timezone);
    const now = new Date();
    const weekKeys = weekWindowKeys(now, timezone, WEEKS_BACK, WEEKS_AHEAD);
    const storeKeys = weekKeys.map((k) => "week:" + k).concat(["routines"]);

    const kvParams = new URLSearchParams();
    kvParams.set("select", "key,value");
    kvParams.set("user_id", "eq." + feed.user_id);
    kvParams.set("key", "in.(" + storeKeys.map((k) => '"' + k + '"').join(",") + ")");
    const rows = await supabaseGet(supabaseUrl, "flowweek_kv", kvParams, serviceKey, controller.signal);

    const byKey = new Map();
    for (const row of (Array.isArray(rows) ? rows : [])) byKey.set(row.key, row.value);
    const routines = Array.isArray(byKey.get("routines")) ? byKey.get("routines") : [];
    // Bewusst ALLE Wochen des Fensters: feste Termine müssen auch in Wochen
    // auftauchen, für die noch nichts geplant (und damit nichts gespeichert) ist.
    const weeks = weekKeys.map((k) => ({ monday: k, data: byKey.get("week:" + k) }));

    const ics = buildCalendar({ weeks, routines, timezone, now, name: "FlowWeek" });

    // Schwacher ETag: unveraenderte Feeds beantworten Kalender-Apps mit 304.
    // DTSTAMP wandert bei jedem Abruf, darf also nicht in den Hash einfliessen.
    const etag = 'W/"' + crypto.createHash("sha256")
      .update(ics.replace(/^DTSTAMP:.*$/gm, "")).digest("hex").slice(0, 32) + '"';
    res.setHeader("ETag", etag);
    if (String(req.headers["if-none-match"] || "").split(",").map((s) => s.trim()).includes(etag)) {
      res.status(304).end();
      touchAccess(supabaseUrl, serviceKey, tokenHash, feed.last_access_at);
      return;
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="flowweek.ics"');
    if (req.method === "HEAD") { res.status(200).end(); return; }
    res.status(200).send(ics);
    await touchAccess(supabaseUrl, serviceKey, tokenHash, feed.last_access_at);
  } catch (err) {
    console.error("Kalender-Feed fehlgeschlagen", err);
    res.status(502).json({ error: "Kalender aktuell nicht verfügbar." });
  } finally {
    clearTimeout(timeout);
  }
};

/* Zeitstempel des letzten Abrufs - die App zeigt daran, dass der Sync laeuft.
   Nur alle paar Minuten schreiben, damit haeufiges Pollen keine Last erzeugt. */
async function touchAccess(baseUrl, serviceKey, tokenHash, lastAccessAt) {
  const last = lastAccessAt ? Date.parse(lastAccessAt) : 0;
  if (Number.isFinite(last) && Date.now() - last < ACCESS_TOUCH_MS) return;
  try {
    const params = new URLSearchParams();
    params.set("token_hash", "eq." + tokenHash);
    await fetch(baseUrl.replace(/\/+$/, "") + "/rest/v1/flowweek_calendar_feeds?" + params.toString(), {
      method: "PATCH",
      headers: Object.assign(supabaseHeaders(serviceKey), {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      }),
      body: JSON.stringify({ last_access_at: new Date().toISOString() })
    });
  } catch (e) {
    // Nur Statistik - ein Fehler darf den Feed nicht kaputtmachen
  }
}

module.exports.buildCalendar = buildCalendar;
module.exports.weekWindowKeys = weekWindowKeys;
module.exports.icsEscape = icsEscape;
module.exports.foldLine = foldLine;
module.exports.safeTimeZone = safeTimeZone;
module.exports.zonedToUtc = zonedToUtc;
