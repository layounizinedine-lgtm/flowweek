// Tests für die puren FlowParse-Hilfsfunktionen in flowweek.html.
// Ausführen mit: node --test test/
// Der Block zwischen den FlowParse-Markern ist DOM-frei und wird hier
// direkt aus der HTML-Datei extrahiert und in einem Sandbox-Kontext geladen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, "flowweek.html"), "utf-8");
const START = "/* ===== FlowParse";
const END = "/* ===== /FlowParse ===== */";
const start = html.indexOf(START);
const end = html.indexOf(END);
assert.ok(start !== -1 && end !== -1, "FlowParse-Marker nicht gefunden");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end), ctx);
const {
  cleanText, parseJsonLoose, applySelfCorrections, hasCorrectionMarker,
  getMonday, localDateKey, minutesOf, splitTimeChunks,
  parseWeekSpeechLocal, extractTime, inferCategory, inferPriority, inferDuration,
} = new Proxy(ctx, { get: (t, k) => vm.runInContext(String(k), t) });

// ---- Datum / Woche ----
test("getMonday liefert Montag 00:00 lokale Zeit", () => {
  assert.equal(localDateKey(getMonday(new Date("2026-07-10T15:00:00"))), "2026-07-06");
  assert.equal(localDateKey(getMonday(new Date("2026-07-06T00:00:00"))), "2026-07-06"); // Montag selbst
  assert.equal(localDateKey(getMonday(new Date("2026-07-12T23:59:00"))), "2026-07-06"); // Sonntag
});

test("getMonday über Jahreswechsel", () => {
  assert.equal(localDateKey(getMonday(new Date("2026-01-01T10:00:00"))), "2025-12-29");
});

test("getMonday am Sommerzeit-Wochenende (29.03.2026)", () => {
  assert.equal(localDateKey(getMonday(new Date("2026-03-29T12:00:00"))), "2026-03-23");
});

test("minutesOf", () => {
  assert.equal(minutesOf("09:30"), 570);
  assert.equal(minutesOf(""), null);
  assert.equal(minutesOf("9:30"), null); // nur HH:MM
});

// ---- Uhrzeiten ----
test("extractTime erkennt Uhrzeiten, aber keine Dauern", () => {
  assert.equal(extractTime("um 15 Uhr Training"), "15:00");
  assert.equal(extractTime("gegen 9 joggen"), "09:00");
  assert.equal(extractTime("12:30 Mittagessen"), "12:30");
  assert.equal(extractTime("abends lesen"), "19:00");
  assert.equal(extractTime("30 min lesen"), "");
});

// ---- Aufteilung mehrerer Einträge ----
test("mehrere Tage in einem Satz werden getrennt", () => {
  const t = parseWeekSpeechLocal("Montag um 9 Mathe lernen Dienstag 18 Uhr Fitness und Freitag die Rechnung bezahlen", 0);
  assert.deepEqual(t.map(x => [x.day, x.time]), [["mon", "09:00"], ["tue", "18:00"], ["fri", ""]]);
  assert.equal(t[0].category, "Lernen");
  assert.equal(t[1].category, "Sport");
});

test("mehrere Uhrzeiten am selben Tag ergeben getrennte Einträge", () => {
  const t = parseWeekSpeechLocal("Donnerstag um 12 lerne ich dann um 15 Uhr trainiere ich", 0);
  assert.equal(t.length, 2);
  assert.deepEqual(t.map(x => [x.day, x.time]), [["thu", "12:00"], ["thu", "15:00"]]);
});

// ---- Relative Datumsangaben ----
test("heute/morgen/übermorgen relativ zum Wochentag", () => {
  const t = parseWeekSpeechLocal("morgen um 9 Zahnarzt und übermorgen abends Training", 0); // heute = Montag
  assert.deepEqual(t.map(x => [x.day, x.time, x.title]), [["tue", "09:00", "Zahnarzt"], ["wed", "19:00", "Training"]]);
});

test("heute und Wochenende", () => {
  const t = parseWeekSpeechLocal("heute einkaufen und am Wochenende das Zimmer aufräumen", 2); // heute = Mittwoch
  assert.deepEqual(t.map(x => [x.day, x.title]), [["wed", "einkaufen"], ["sat", "das Zimmer aufräumen"]]);
});

test("'morgens' wird nicht als 'morgen' interpretiert", () => {
  const t = parseWeekSpeechLocal("Dienstag morgens joggen", 0);
  assert.deepEqual(t.map(x => [x.day, x.time]), [["tue", "08:00"]]);
});

// ---- Selbstkorrekturen ----
test("Selbstkorrektur behält die letzte Version", () => {
  assert.equal(
    applySelfCorrections("ich war mit meinem Vater eh nein meiner Mutter draußen"),
    "ich war mit meiner Mutter draußen"
  );
});

test("hasCorrectionMarker", () => {
  assert.ok(hasCorrectionMarker("um 15 Uhr nein warte um 16 Uhr"));
  assert.ok(hasCorrectionMarker("Treffen mit Ali äh nein mit Sara"));
  assert.ok(!hasCorrectionMarker("Montag um 9 Mathe lernen"));
});

// ---- Kategorien / Priorität / Dauer ----
test("inferCategory", () => {
  assert.equal(inferCategory("Mathe lernen"), "Lernen");
  assert.equal(inferCategory("Fitness Training"), "Sport");
  assert.equal(inferCategory("Meeting mit Kunde"), "Arbeit");
  assert.equal(inferCategory("Spaziergang zur Erholung"), "Erholung");
  assert.equal(inferCategory("Mutter anrufen"), "Privat");
});

test("inferPriority und inferDuration", () => {
  assert.equal(inferPriority("wichtige Klausur vorbereiten"), "high");
  assert.equal(inferPriority("vielleicht lesen"), "low");
  assert.equal(inferDuration("90 minuten lernen"), 90);
  assert.equal(inferDuration("2 stunden arbeiten"), 120);
  assert.equal(inferDuration("einkaufen"), 30);
});

// ---- Text / JSON ----
test("cleanText entfernt Steuerzeichen und begrenzt Länge", () => {
  assert.equal(cleanText("a\u0000b\u001Fc"), "abc");
  assert.equal(cleanText("x".repeat(50), 10).length, 10);
});

test("parseJsonLoose extrahiert JSON aus KI-Antworten", () => {
  assert.deepEqual(parseJsonLoose('```json\n[{"day":"mon"}]\n```'), [{ day: "mon" }]);
  assert.deepEqual(parseJsonLoose('Hier ist das Ergebnis: {"a":1} fertig'), { a: 1 });
  assert.throws(() => parseJsonLoose("kein json hier"));
});

test("splitTimeChunks schneidet an jeder Zeitangabe", () => {
  assert.equal(splitTimeChunks("um 12 lernen dann um 15 Uhr Training").length, 2);
  assert.equal(splitTimeChunks("einfach nur einkaufen").length, 1);
});

// ---- Absolute Daten & nachgestellte Uhrzeiten (v2.1) ----
test("absolutes Datum 'am 11.08.' mit Zeit ohne 'Uhr'", () => {
  const ref = new Date(2026, 6, 13); // Montag, 13.07.2026
  const t = parseWeekSpeechLocal("am 11.08. muss ich zum Zahnarzt um 12", 0, ref);
  assert.equal(t.length, 1);
  assert.equal(t[0].date, "2026-08-11");
  assert.equal(t[0].time, "12:00");
});

test("Monatsname 'am 3. August'", () => {
  const ref = new Date(2026, 6, 13);
  const t = parseWeekSpeechLocal("am 3. August um 14 Uhr Treffen mit Ali", 0, ref);
  assert.equal(t[0].date, "2026-08-03");
  assert.equal(t[0].time, "14:00");
});

test("vergangenes Datum rollt ins nächste Jahr", () => {
  const ref = new Date(2026, 6, 13);
  const t = parseWeekSpeechLocal("am 05.01. Prüfung", 0, ref);
  assert.equal(t[0].date, "2027-01-05");
});

test("nachgestellte Uhrzeit gehört zum letzten Eintrag", () => {
  const t = parseWeekSpeechLocal("übermorgen habe ich ein Termin um 16", 2, new Date(2026, 6, 13));
  assert.equal(t[0].day, "fri");
  assert.equal(t[0].time, "16:00");
  assert.equal(t[0].title, "Termin");
});

test("'um 12.30' ist eine Uhrzeit, kein Datum", () => {
  const t = parseWeekSpeechLocal("Montag um 12.30 lernen", 0, new Date(2026, 6, 13));
  assert.equal(t[0].day, "mon");
  assert.equal(t[0].time, "12:30");
  assert.equal(t[0].date, null);
});

test("ungültige Datumsangaben werden verworfen (31.02.)", () => {
  const t = parseWeekSpeechLocal("am 31.02. Treffen", 0, new Date(2026, 6, 13));
  assert.equal(t.length, 0);
});
