// Tests für den Kalender-Feed (api/calendar.js).
// Ausführen mit: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import calendar from "../api/calendar.js";

const { buildCalendar, weekWindowKeys, icsEscape, foldLine, safeTimeZone, zonedToUtc } = calendar;

const NOW = new Date("2026-08-06T10:00:00Z");
const TZ = "Europe/Berlin";

function build(weeks, routines) {
  return buildCalendar({ weeks, routines: routines || [], timezone: TZ, now: NOW });
}
/* Entfaltet die 75-Oktett-Umbrüche wieder, damit Tests ganze Werte prüfen können. */
function unfold(ics) { return ics.replace(/\r\n /g, ""); }

// ---- Grundgerüst ----
test("Feed ist ein gültiger VCALENDAR mit CRLF-Zeilenenden", () => {
  const ics = build([]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.match(ics, /\r\nVERSION:2\.0\r\n/);
  assert.ok(!/[^\r]\n/.test(ics), "jede Zeile muss mit CRLF enden");
});

test("Feed sagt der Kalender-App, wie oft sie neu laden soll", () => {
  const ics = build([]);
  assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT15M/);
  assert.match(ics, /X-PUBLISHED-TTL:PT15M/);
});

// ---- Termine mit Uhrzeit ----
test("Termin mit Uhrzeit wird korrekt nach UTC umgerechnet (Sommerzeit, +2)", () => {
  const ics = build([{
    monday: "2026-08-03",
    data: { mon: [{ id: "t1", title: "Arzt", time: "09:00", duration: 45, cat: "Privat" }] }
  }]);
  assert.match(ics, /DTSTART:20260803T070000Z/);
  assert.match(ics, /DTEND:20260803T074500Z/);
  assert.match(ics, /SUMMARY:Arzt/);
  assert.match(ics, /UID:t1@flowweek/);
});

test("Termin mit Uhrzeit im Winter (+1)", () => {
  const ics = build([{
    monday: "2026-01-05",
    data: { tue: [{ id: "t2", title: "Training", time: "18:30", duration: 60 }] }
  }]);
  assert.match(ics, /DTSTART:20260106T173000Z/);
  assert.match(ics, /DTEND:20260106T183000Z/);
});

test("Ohne Dauer gilt eine halbe Stunde", () => {
  const ics = build([{ monday: "2026-08-03", data: { wed: [{ id: "t3", title: "Call", time: "12:00" }] } }]);
  assert.match(ics, /DTSTART:20260805T100000Z/);
  assert.match(ics, /DTEND:20260805T103000Z/);
});

// ---- Termine ohne Uhrzeit ----
test("Aufgabe ohne Uhrzeit wird ganztägig und blockiert den Tag nicht", () => {
  const ics = build([{ monday: "2026-08-03", data: { fri: [{ id: "t4", title: "Steuer" }] } }]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260807/);
  assert.match(ics, /DTEND;VALUE=DATE:20260808/);
  assert.match(ics, /TRANSP:TRANSPARENT/);
});

// ---- Feste Termine ----
test("Feste Termine erscheinen in jeder Woche mit eigener UID", () => {
  const routines = [{ id: "r1", day: "mon", title: "Yoga", time: "07:00", duration: 60 }];
  const ics = build([{ monday: "2026-08-03", data: {} }, { monday: "2026-08-10", data: {} }], routines);
  assert.match(ics, /UID:r-r1-20260803@flowweek/);
  assert.match(ics, /UID:r-r1-20260810@flowweek/);
  assert.match(ics, /Fester Termin/);
});

test("Feste Termine behalten die Uhrzeit über die Sommerzeit-Umstellung", () => {
  const routines = [{ id: "r2", day: "mon", title: "Standup", time: "09:00", duration: 15 }];
  // 23.03. ist Winterzeit (+1), 30.03. bereits Sommerzeit (+2)
  const ics = build([{ monday: "2026-03-23", data: {} }, { monday: "2026-03-30", data: {} }], routines);
  assert.match(ics, /DTSTART:20260323T080000Z/);
  assert.match(ics, /DTSTART:20260330T070000Z/);
});

test("Feste Termine landen am richtigen Wochentag", () => {
  const routines = [{ id: "r3", day: "thu", title: "Einkauf", time: "17:00" }];
  const ics = build([{ monday: "2026-08-03", data: {} }], routines);
  assert.match(ics, /DTSTART:20260806T150000Z/); // Donnerstag = Montag + 3
});

// ---- Stabilität der UIDs ----
test("Gleicher Plan ergibt identische UIDs (Kalender legt keine Dubletten an)", () => {
  const weeks = [{ monday: "2026-08-03", data: { mon: [{ title: "Ohne ID", time: "10:00" }] } }];
  const uids = (ics) => ics.match(/UID:.*/g);
  assert.deepEqual(uids(build(weeks)), uids(build(weeks)));
});

test("Doppelte IDs erzeugen nur ein Event", () => {
  const ics = build([{
    monday: "2026-08-03",
    data: { mon: [{ id: "dup", title: "A", time: "10:00" }], tue: [{ id: "dup", title: "B", time: "11:00" }] }
  }]);
  assert.equal((ics.match(/UID:dup@flowweek/g) || []).length, 1);
});

// ---- Escaping & Zeilenumbruch ----
test("Sonderzeichen werden nach RFC 5545 maskiert", () => {
  assert.equal(icsEscape("a,b;c\\d"), "a\\,b\\;c\\\\d");
  assert.equal(icsEscape("Zeile1\nZeile2"), "Zeile1\\nZeile2");
  const ics = unfold(build([{ monday: "2026-08-03", data: { mon: [{ id: "t5", title: "Essen, trinken; feiern", time: "19:00" }] } }]));
  assert.match(ics, /SUMMARY:Essen\\, trinken\\; feiern/);
});

test("Lange Zeilen werden auf 75 Oktette gefaltet", () => {
  const folded = foldLine("SUMMARY:" + "x".repeat(200));
  folded.split("\r\n").forEach((line, i) => {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, "Zeile zu lang: " + line.length);
    if (i > 0) assert.match(line, /^ /, "Folgezeile muss mit Leerzeichen beginnen");
  });
  assert.equal(folded.replace(/\r\n /g, ""), "SUMMARY:" + "x".repeat(200));
});

test("Faltung zerschneidet keine Umlaute", () => {
  const text = "SUMMARY:" + "ä".repeat(120);
  const folded = foldLine(text);
  assert.ok(!folded.includes("�"), "kein kaputtes Zeichen");
  assert.equal(folded.replace(/\r\n /g, ""), text);
  folded.split("\r\n").forEach((line) => assert.ok(Buffer.byteLength(line, "utf8") <= 75));
});

test("Titel im Feed bleibt lesbar (Umlaute überstehen die Faltung)", () => {
  const ics = unfold(build([{ monday: "2026-08-03", data: { mon: [{ id: "t6", title: "Zahnärztin für Prophylaxe und Kontrolle im Ärztehaus München", time: "08:00" }] } }]));
  assert.match(ics, /SUMMARY:Zahnärztin für Prophylaxe und Kontrolle im Ärztehaus München/);
});

// ---- Robustheit gegen kaputte Daten ----
test("Unbrauchbare Einträge kippen den Feed nicht", () => {
  const ics = build([
    { monday: "kein-datum", data: { mon: [{ id: "x", title: "Ignoriert" }] } },
    { monday: "2026-08-03", data: { mon: [null, "text", { id: "ok", title: "Gültig", time: "25:99" }] } }
  ]);
  assert.ok(!ics.includes("Ignoriert"));
  assert.match(ics, /SUMMARY:Gültig/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260803/); // ungültige Uhrzeit -> ganztägig
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
});

test("Ohne Titel bleibt ein sinnvoller Standard", () => {
  const ics = build([{ monday: "2026-08-03", data: { mon: [{ id: "leer", time: "10:00" }] } }]);
  assert.match(ics, /SUMMARY:Aufgabe/);
});

// ---- Zeitzonen ----
test("Unbekannte oder manipulierte Zeitzonen fallen auf Europe/Berlin zurück", () => {
  assert.equal(safeTimeZone("Europe/Berlin"), "Europe/Berlin");
  assert.equal(safeTimeZone("America/New_York"), "America/New_York");
  assert.equal(safeTimeZone("Quatsch/Nirgendwo"), "Europe/Berlin");
  assert.equal(safeTimeZone("Europe/Berlin\r\nX-EVIL:1"), "Europe/Berlin");
  assert.equal(safeTimeZone(""), "Europe/Berlin");
  assert.equal(safeTimeZone(null), "Europe/Berlin");
});

test("zonedToUtc rechnet in anderen Zeitzonen richtig", () => {
  assert.equal(zonedToUtc({ y: 2026, m: 8, d: 3 }, 9, 0, "America/New_York").toISOString(), "2026-08-03T13:00:00.000Z");
  assert.equal(zonedToUtc({ y: 2026, m: 8, d: 3 }, 9, 0, "UTC").toISOString(), "2026-08-03T09:00:00.000Z");
});

// ---- Feed-Fenster ----
test("weekWindowKeys liefert lückenlose Montage rund um heute", () => {
  const keys = weekWindowKeys(NOW, TZ, 2, 3);
  assert.equal(keys.length, 6);
  assert.deepEqual(keys, ["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
});

test("weekWindowKeys richtet sich nach der Zeitzone des Nutzers", () => {
  // 06.08.2026 10:00 UTC ist in Auckland bereits der 06.08. (Donnerstag) -> gleiche Woche
  const keys = weekWindowKeys(NOW, "Pacific/Auckland", 0, 0);
  assert.deepEqual(keys, ["2026-08-03"]);
});
