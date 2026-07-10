# FlowWeek

FlowWeek ist ein sprachgesteuerter Wochenplaner: Woche frei einsprechen, erkannte Einträge in einer Vorschau prüfen und bestätigen, Aufgaben abhaken – dazu Diktat mit KI-Politur, Command Mode und eine KI-Wochenanalyse. Gastdaten bleiben lokal im Browser; optional gibt es Cloud-Sync über ein Supabase-Konto.

## Funktionen

- **Woche einsprechen**: Eine Aufnahme kann mehrere Tage, Uhrzeiten und Aufgaben enthalten („Montag um 9 Mathe, morgen 18 Uhr Training …“). Vor dem Speichern zeigt FlowWeek eine Vorschau, in der jeder Eintrag einzeln bearbeitet, abgewählt oder bestätigt wird. Relative Angaben (heute, morgen, übermorgen, Wochenende) und Korrekturen im Satz („… nein, mach daraus Mittwoch“) werden berücksichtigt. Ohne KI-Verbindung greift ein lokaler Fallback-Parser.
- **Diktat**: Spracherkennung im Browser (Web Speech API), KI-Politur (Füllwörter, Interpunktion, Selbstkorrekturen), Command Mode, Text-Snippets, Verlauf.
- **Wochenplaner**: Wochenübersicht, Tageskarten, Kategorien, Prioritäten, Dauer, Zeitkonflikt-Erkennung, Vorlagen.
- **KI-Wochenanalyse**: Bewertung von Balance, Zeitplanung und Lern-Effizienz; lokale Basisanalyse als Fallback.

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
   - `RATE_LIMIT_PER_MINUTE` (optional, Standard: 20)
3. **Cloud-Sync (optional)**: `supabase/flowweek_kv_rls.sql` im Supabase-SQL-Editor ausführen, dann `SUPABASE_URL` und `SUPABASE_ANON_KEY` in `flowweek.html` (CONFIG) eintragen.

Details zu Sicherheit und Datenschutz: [SECURITY.md](SECURITY.md).

## Tests

```sh
node --test test/
```

Getestet werden Datumsberechnung (inkl. Jahreswechsel und Sommerzeit), relative Datumsangaben, das Aufteilen mehrerer Einträge und Uhrzeiten, Selbstkorrekturen und die JSON-Extraktion aus KI-Antworten.

## Datenschutz

- Audio wird nicht aufgezeichnet oder gespeichert – die Spracherkennung läuft über die Web Speech API des Browsers; FlowWeek verarbeitet nur den erkannten Text.
- KI-Funktionen senden nur den jeweils relevanten Text an den FlowWeek-Proxy; Auto-Politur ist standardmäßig aus.
- Gastdaten liegen ausschließlich im lokalen Browser-Speicher.

## Changelog

### 1.1.0 (2026-07-10)
- Vorschau mit Bestätigung für „Woche einsprechen“: Einträge werden pro Tag gruppiert angezeigt und erst nach Bestätigung gespeichert; Duplikate werden markiert.
- KI erhält Datumskontext (heutiges Datum, Wochentage der angezeigten Woche) und Regeln für Korrekturen im Satz; lokaler Parser versteht heute/morgen/übermorgen/Wochenende.
- Bugfixes: „2 Stunden“ wurde als 300 min gedeutet; `übermorgen` wurde nie erkannt (Umlaut-Wortgrenze); nackte Uhrzeiten wie „12:30“ werden erkannt.
- Backend: veraltetes Standardmodell `claude-3-5-sonnet-latest` (abgeschaltet) durch `claude-opus-4-8` ersetzt – KI-Funktionen waren dadurch komplett ausgefallen.
- Verständlichere Fehlermeldungen bei Mikrofon-/Aufnahmefehlern und leerer Aufnahme.
- Launch: Favicon, Meta-/Open-Graph-Daten, `index.html`-Weiterleitung, automatisierte Tests, README.

### 1.0.0
- Erste Version: Diktat, Wochenplaner, KI-Analyse, Supabase-Sync, Vercel-Proxy.
