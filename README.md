# FlowWeek

FlowWeek macht Wochenplanung stressfrei: Beim Öffnen zeigt ein Dashboard, was heute ansteht und was diese Woche wichtig ist. Die Woche lässt sich frei einsprechen (mit Vorschau und Bestätigung), feste Termine wiederholen sich automatisch jede Woche, und eine Analyse hilft, die Woche ausgewogen zu halten. Gastdaten bleiben lokal im Browser; optional gibt es Cloud-Sync über ein Supabase-Konto.

## Funktionen

- **Start-Dashboard**: Beim Öffnen siehst du sofort, was heute ansteht, welche Termine diese Woche wichtig sind und was du beachten solltest (offene Aufgaben, Zeitkonflikte, zu volle Tage).
- **Woche einsprechen**: Eine Aufnahme kann mehrere Tage, Uhrzeiten und Aufgaben enthalten. Vor dem Speichern zeigt FlowWeek eine Vorschau, in der jeder Eintrag einzeln bearbeitet, abgewählt oder bestätigt wird. Relative Angaben (heute, morgen, übermorgen, Wochenende) und Korrekturen im Satz werden berücksichtigt; ohne KI-Verbindung greift ein lokaler Fallback-Parser.
- **Feste Termine**: Beim Anlegen „jede Woche wiederholen“ anhaken – der Termin erscheint automatisch in jeder Woche (↻) und der Erledigt-Status gilt pro Woche.
- **Wochenplaner**: Übersichtsleiste, Tageskarten, Kategorien, Prioritäten, sofortiger Wochenwechsel (lokaler Cache, Cloud-Abgleich im Hintergrund), „Heute“-Knopf.
- **Menü**: Hell/Dunkel/System-Theme, Sprache der Spracheingabe, Mini-Kalender zum Planen Monate im Voraus, Konto.
- **Wochenanalyse**: Ehrliche Einschätzung von Balance und Zeitplanung; lokale Basisanalyse als Fallback.

## Aufbau

| Datei | Zweck |
|---|---|
| `flowweek.html` | Die komplette App (eine Datei, läuft auch lokal im Browser) |
| `index.html` | Weiterleitung auf `flowweek.html` (für GitHub Pages) |
| `api/chat.js` | Vercel-Serverless-Proxy zur Anthropic-API (hält den API-Key serverseitig) |
| `supabase/flowweek_kv_rls.sql` | Tabelle + Row-Level-Security für den Cloud-Sync |
| `test/parse-core.test.mjs` | Tests für Datums- und Sprach-Parsing |

## Setup & Deployment

1. **Frontend**: `flowweek.html` statisch hosten (z. B. GitHub Pages) oder lokal in Chrome/Edge öffnen. Spracherkennung braucht Chrome, Edge oder Safari.
2. **KI-Proxy (Vercel)**: Projekt mit `api/chat.js` deployen und Umgebungsvariablen setzen:
   - `ANTHROPIC_API_KEY` (erforderlich)
   - `ALLOWED_ORIGINS` – kommagetrennte Origin-Allowlist, z. B. `https://layounizinedine-lgtm.github.io`
   - `ANTHROPIC_MODEL` (optional, Standard: `claude-opus-4-8`)
   - `RATE_LIMIT_PER_MINUTE` (optional, Standard: 10 pro IP)
   - `GLOBAL_LIMIT_PER_MINUTE` / `GLOBAL_LIMIT_PER_DAY` (optional, Standard: 30/Minute und 300/Tag über alle Nutzer – Kostendeckel)

   Zusätzlich empfohlen: ein monatliches Spend-Limit in der Anthropic Console (Settings → Limits) als hartes Budget.
3. **Cloud-Sync (optional)**: `supabase/flowweek_kv_rls.sql` im Supabase-SQL-Editor ausführen, dann `SUPABASE_URL` und `SUPABASE_ANON_KEY` in `flowweek.html` (CONFIG) eintragen.

Details zu Sicherheit und Datenschutz: [SECURITY.md](SECURITY.md).

## Tests

```sh
node --test test/
```

Getestet werden Datumsberechnung (inkl. Jahreswechsel und Sommerzeit), relative Datumsangaben, das Aufteilen mehrerer Einträge und Uhrzeiten, Selbstkorrekturen und die JSON-Extraktion aus KI-Antworten.

## Datenschutz

- Audio wird nicht aufgezeichnet oder gespeichert – die Spracherkennung läuft über die Web Speech API des Browsers; FlowWeek verarbeitet nur den erkannten Text.
- KI-Funktionen senden nur den jeweils relevanten Text an den FlowWeek-Proxy – und nur, wenn du sie aktiv nutzt.
- Gastdaten liegen ausschließlich im lokalen Browser-Speicher.

## Changelog

### 2.2.0 (2026-07-13)
- Spracheingabe verliert nicht mehr den zuletzt gesagten Termin: Das letzte, noch nicht finalisierte Sprachstück wird beim Stoppen mit übernommen.
- Vorschau ist voll bearbeitbar: Einträge lassen sich per ✕ entfernen und über ein Formular per Tippen **oder** per Sprache ergänzen; Änderungen an Titel/Uhrzeit/Kategorie bleiben beim Umbauen erhalten.
- Selbstkorrekturen werden zuverlässiger erkannt (Tag, Uhrzeit, Ort und Inhalt; Signalwörter „nein/doch/eher/besser/ich meine/quatsch/warte/sorry“); der Prompt weist die KI ausdrücklich an, den letzten Termin nicht zu vergessen.

### 2.1.0 (2026-07-13)
- Einträge bearbeiten: Antippen öffnet einen Dialog (Titel, Uhrzeit, Tag, Kategorie, Priorität, Dauer) – damit lassen sich Aufgaben auch auf andere Tage verschieben; bei festen Terminen gilt die Änderung für jede Woche.
- Spracheingabe versteht absolute Daten („am 11.08. …“, „am 3. August“) und speichert sie automatisch in der richtigen Woche – auch über Monats-/Jahresgrenzen.
- Uhrzeiten ohne „Uhr“ („ein Termin um 16“) werden erkannt, auch am Satzende.
- Die KI ignoriert Denkpausen, Füllwörter und kurze Nebengespräche und übernimmt bei Selbstkorrekturen nur die letzte Version.
- „Woche einsprechen“ bezieht sich jetzt immer auf die aktuelle Woche, egal welche Woche zuletzt angezeigt wurde; die Vorschau zeigt pro Eintrag das konkrete Datum.
- Theme wird vor dem ersten Rendern angewendet (kein Dunkel-Blitz mehr im Light-Mode).
- Aufräumen: Erledigt-Marker gelöschter fester Termine werden mit entfernt.


### 2.0.0 (2026-07-13)
- Neues Start-Dashboard: Heute, wichtige Termine der Woche und Hinweise auf einen Blick.
- Feste wöchentliche Termine („jede Woche wiederholen“), inkl. Erledigt-Status pro Woche.
- Burger-Menü mit Theme-Wahl (Hell/Dunkel/System), Sprache der Spracheingabe, Mini-Kalender (Monate voraus planen) und Konto.
- Light-Mode mit eleganter, ruhiger Farbwelt (ein Akzentblau statt Amber+Blau); Logo angepasst.
- Wochenwechsel rendert sofort aus dem Cache, Cloud-Sync läuft im Hintergrund.
- Diktat-Tab (Transkript, KI-Politur, Command Mode, Snippets, Verlauf) entfernt – Fokus auf Planung.
- Gast-Modus wird gemerkt: Die Login-Maske erscheint nicht mehr bei jedem Start.

### 1.2.0 (2026-07-10)
- Neues Logo: Bildmarke mit Verlauf und Audio-Wellenform, passendes Favicon, verfeinerte Wortmarke.
- Passwort-Reset: „Passwort vergessen?“ schickt einen Link per E-Mail; über den Link wird ein neues Passwort gesetzt.
- Sicherheit: Supabase-Script auf Version 2.110.2 gepinnt mit Subresource-Integrity-Hash (Schutz vor manipuliertem CDN).
- Barrierefreiheit: sichtbarer Tastatur-Fokus für alle Bedienelemente.

### 1.1.0 (2026-07-10)
- Vorschau mit Bestätigung für „Woche einsprechen“: Einträge werden pro Tag gruppiert angezeigt und erst nach Bestätigung gespeichert; Duplikate werden markiert.
- KI erhält Datumskontext (heutiges Datum, Wochentage der angezeigten Woche) und Regeln für Korrekturen im Satz; lokaler Parser versteht heute/morgen/übermorgen/Wochenende.
- Bugfixes: „2 Stunden“ wurde als 300 min gedeutet; `übermorgen` wurde nie erkannt (Umlaut-Wortgrenze); nackte Uhrzeiten wie „12:30“ werden erkannt.
- Backend: veraltetes Standardmodell `claude-3-5-sonnet-latest` (abgeschaltet) durch `claude-opus-4-8` ersetzt – KI-Funktionen waren dadurch komplett ausgefallen.
- Verständlichere Fehlermeldungen bei Mikrofon-/Aufnahmefehlern und leerer Aufnahme.
- Launch: Favicon, Meta-/Open-Graph-Daten, `index.html`-Weiterleitung, automatisierte Tests, README.
- Sicherheit: KI-Proxy verlangt jetzt eine erlaubte Origin (403 für Skript-Zugriffe), globales Minuten- und Tageslimit als Kostendeckel zusätzlich zum Pro-IP-Limit; Supabase-RLS live verifiziert.

### 1.0.0
- Erste Version: Diktat, Wochenplaner, KI-Analyse, Supabase-Sync, Vercel-Proxy.
