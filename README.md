# FlowWeek

FlowWeek macht Wochenplanung stressfrei: Beim Öffnen zeigt ein Dashboard, was heute ansteht und was diese Woche wichtig ist. Die Woche lässt sich frei einsprechen (mit Vorschau und Bestätigung), feste Termine wiederholen sich automatisch jede Woche, und eine Analyse hilft, die Woche ausgewogen zu halten. Gastdaten bleiben lokal im Browser; optional gibt es Cloud-Sync über ein Supabase-Konto.

## Funktionen

- **Start-Dashboard**: Beim Öffnen siehst du sofort, was heute ansteht, welche Termine diese Woche wichtig sind und was du beachten solltest (offene Aufgaben, Zeitkonflikte, zu volle Tage).
- **Woche einsprechen**: Eine Aufnahme kann mehrere Tage, Uhrzeiten und Aufgaben enthalten. Vor dem Speichern zeigt FlowWeek eine Vorschau, in der jeder Eintrag einzeln bearbeitet, abgewählt oder bestätigt wird. Relative Angaben (heute, morgen, übermorgen, Wochenende) und Korrekturen im Satz werden berücksichtigt; ohne KI-Verbindung greift ein lokaler Fallback-Parser.
- **Feste Termine**: Beim Anlegen „jede Woche wiederholen“ anhaken – der Termin erscheint automatisch in jeder Woche (↻) und der Erledigt-Status gilt pro Woche.
- **Sicher beim Bearbeiten**: Gelöschte Aufgaben und feste Termine lassen sich direkt aus der Meldung heraus wiederherstellen.
- **Wochenplaner**: Übersichtsleiste, Tageskarten, Kategorien, Prioritäten, sofortiger Wochenwechsel (lokaler Cache, Cloud-Abgleich im Hintergrund), „Heute“-Knopf.
- **Kalender-Synchronisation**: Einmal im Menü verbinden – danach erscheinen alle Termine automatisch in Apple Kalender, Google Kalender (Android) oder Outlook und bleiben dort aktuell, ohne dass noch etwas exportiert oder importiert werden muss.
- **Menü**: Hell/Dunkel/System-Theme, Sprache der Spracheingabe, Mini-Kalender zum Planen Monate im Voraus, Kalender-Synchronisation, Konto.
- **Auf dem Handy wie eine App**: Über „Zum Startbildschirm hinzufügen“ startet FlowWeek mit eigenem Symbol und ohne Browser-Leiste.
- **Wochenanalyse**: Ehrliche Einschätzung von Balance und Zeitplanung; lokale Basisanalyse als Fallback.

## Aufbau

| Datei | Zweck |
|---|---|
| `flowweek.html` | Die komplette App (eine Datei, läuft auch lokal im Browser) |
| `index.html` | Weiterleitung auf `flowweek.html` (für GitHub Pages) |
| `manifest.webmanifest` | Web-App-Manifest: Name, Farben und Icons für „Zum Startbildschirm hinzufügen“ |
| `icons/` | App-Icon: SVG-Quellen und die daraus gerenderten PNGs |
| `api/chat.js` | Vercel-Serverless-Proxy zur Anthropic-API (hält den API-Key serverseitig) |
| `api/calendar.js` | Vercel-Serverless-Endpunkt, der den Wochenplan als abonnierbaren iCalendar-Feed ausliefert |
| `supabase/flowweek_kv_rls.sql` | Tabelle + Row-Level-Security für den Cloud-Sync |
| `supabase/flowweek_calendar_rls.sql` | Tabelle + Row-Level-Security für die Kalender-Feed-Tokens |
| `test/parse-core.test.mjs` | Tests für Datums- und Sprach-Parsing |
| `test/ics.test.mjs` | Tests für den Kalender-Feed (Zeitzonen, Sommerzeit, Escaping) |

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
4. **Kalender-Synchronisation**: `supabase/flowweek_calendar_rls.sql` im Supabase-SQL-Editor ausführen und im selben Vercel-Projekt zusätzlich setzen:
   - `SUPABASE_URL` – dieselbe Projekt-URL wie im Frontend
   - `SUPABASE_SERVICE_ROLE_KEY` – **geheim**, nur in Vercel; damit liest der Feed die Termine des Nutzers, der sich mit dem Token ausweist
   - `CALENDAR_WEEKS_BACK` / `CALENDAR_WEEKS_AHEAD` (optional, Standard: 8 zurück, 26 voraus)
   - `CALENDAR_RATE_LIMIT_PER_MINUTE` (optional, Standard: 60 pro IP)

   Der Feed setzt Cloud-Sync voraus: Nur mit Konto kann die Kalender-App die Termine abrufen.

Details zu Sicherheit und Datenschutz: [SECURITY.md](SECURITY.md).

## Kalender verbinden (aus Sicht der Nutzer)

Menü (☰) → **Kalender-Synchronisation** → *Mit Kalender verbinden*. Danach:

- **iPhone / iPad / Mac**: „In Apple Kalender öffnen“ antippen und das Abo bestätigen. Die Termine erscheinen als eigener FlowWeek-Kalender und aktualisieren sich selbst.
- **Android**: „In Google Kalender öffnen“ – der Link wird einmal im Browser bestätigt. Danach taucht der Kalender automatisch auch in der Kalender-App des Handys auf.
- **Outlook** und andere Programme: den angezeigten Link als Internetkalender abonnieren.

Verbunden wird einmal; jede spätere Änderung in FlowWeek landet ohne weiteres Zutun im Kalender. Wie schnell, entscheidet die Kalender-App: Apple aktualisiert meist im Minuten- bis Stundentakt, Google kann mehrere Stunden brauchen. Der Abgleich läuft in eine Richtung – bearbeitet wird in FlowWeek, der Kalender spiegelt den Plan. Über *Verbindung trennen* wird der Link sofort ungültig.

## App-Icon

Die Bildmarke ist dieselbe wie im Kopf der App: vier weiße Balken (Sprach-Wellenform und Wochenbalken zugleich) auf dem Akzentblau-Verlauf `#8CA2FF → #5B78E8 → #3A52B8`.

| Datei | Größe | Wofür |
|---|---|---|
| `icons/icon.svg` | skalierbar | Quelle; Favicon im Browser-Tab |
| `icons/icon-192.png` | 192×192 | Manifest, `purpose: any` |
| `icons/icon-512.png` | 512×512 | Manifest, `purpose: any` |
| `icons/icon-maskable-512.png` | 512×512 | Manifest, `purpose: maskable` – Motiv kleiner, damit Androids Kreis-/Squircle-Zuschnitt nichts abschneidet |
| `icons/apple-touch-icon.png` | 180×180 | iOS-Startbildschirm; randlos und undurchsichtig, weil iOS selbst rundet |

Zusätzlich steckt dasselbe Icon als `data:`-URL direkt in `flowweek.html` und `index.html` – so hat auch die einzeln kopierte HTML-Datei ein Symbol.

Die PNGs sind aus den SVG-Quellen gerendert (`icon-fullbleed.svg` ist die Vorlage ohne runde Ecken für iOS). Nach einer Änderung an den SVGs die PNGs in genau diesen Größen neu erzeugen.

Nutzer fügen die App über „Zum Startbildschirm hinzufügen“ (iOS: Teilen-Menü in Safari, Android: Chrome-Menü) hinzu; sie startet dann ohne Browser-Leiste. Ein automatischer Installations-Hinweis erscheint erst mit einem Service Worker – der ist bewusst nicht enthalten, weil er zwischengespeicherte alte Versionen nach sich zieht.

## Tests

```sh
node --test test/
```

Getestet werden Datumsberechnung (inkl. Jahreswechsel und Sommerzeit), relative Datumsangaben, das Aufteilen mehrerer Einträge und Uhrzeiten, Selbstkorrekturen und die JSON-Extraktion aus KI-Antworten. Für den Kalender-Feed zusätzlich: Umrechnung in UTC über Zeitzonen und Sommerzeit-Umstellungen hinweg, ganztägige Termine, Wiederholung fester Termine, stabile UIDs (keine Dubletten im Kalender) sowie Escaping und Zeilenfaltung nach RFC 5545.

## Datenschutz

- Audio wird nicht aufgezeichnet oder gespeichert – die Spracherkennung läuft über die Web Speech API des Browsers; FlowWeek verarbeitet nur den erkannten Text.
- KI-Funktionen senden nur den jeweils relevanten Text an den FlowWeek-Proxy – und nur, wenn du sie aktiv nutzt.
- Gastdaten liegen ausschließlich im lokalen Browser-Speicher.
- Der Kalender-Feed ist nur über einen geheimen, jederzeit widerrufbaren Link erreichbar und wird erst angelegt, wenn die Synchronisation aktiv verbunden wird.

## Changelog

### 2.5.0 (2026-08-13)
- **Neues App-Icon**: Das Favicon war noch orange (`#FFB454 → #FF9A3D`) – ein Überbleibsel aus Version 1.x, bevor 2.0.0 auf ein einzelnes Akzentblau umgestellt hat. Es passt jetzt zur Bildmarke im Kopf der App.
- **Startbildschirm-Symbol für Handys**: `apple-touch-icon` für iOS und Manifest-Icons für Android, inklusive einer eigenen *maskable*-Variante, die Androids Kreis- und Squircle-Zuschnitt aushält.
- **Web-App-Manifest**: Über „Zum Startbildschirm hinzufügen“ startet FlowWeek ohne Browser-Leiste, mit eigenem Namen und Symbol.
- Auch die Weiterleitungsseite `index.html` zeigt jetzt das Symbol.

### 2.4.0 (2026-08-07)
- **Löschen lässt sich rückgängig machen**: Ein versehentlicher Tipp auf ✕ kostet keine Daten mehr – die Meldung bietet „Rückgängig“ an. Das gilt auch für feste Termine (inklusive der Erledigt-Häkchen) und funktioniert selbst dann noch, wenn inzwischen eine andere Woche angezeigt wird.
- **Kategorie wird beim Tippen erkannt**: Getippte Aufgaben landeten bisher alle in „Fokus“, weil das die erste Auswahl war – das verzerrte die Wochenanalyse. Jetzt steht die Kategorie standardmäßig auf „automatisch“ und wird aus dem Titel abgeleitet; eine bewusste Auswahl gilt weiterhin.
- **Arzttermine sind nicht mehr „Arbeit“**: „Termin“ allein galt als Arbeits-Signal, wodurch Zahnarzt-, Friseur- oder Amtstermine falsch einsortiert wurden. Dafür erkennt FlowWeek jetzt „Chef“ und „Kollege/Kollegin“ als Arbeit.
- **Escape schließt Dialoge**: Bearbeiten-Fenster, Sprach-Vorschau und Menü lassen sich mit der Escape-Taste schließen.
- **Bugfix Favicon**: Das Symbol wurde von der eigenen Content-Security-Policy blockiert (`img-src` fehlte) und war deshalb in keinem Browser sichtbar.
- **Bugfix Erledigt-Marker**: Wurde ein fester Termin auf einen anderen Wochentag verschoben, blieb der alte Erledigt-Marker liegen und der Termin galt nach dem Zurückschieben fälschlich als erledigt.
- **Bugfix Tests**: Die Testdatei lud den Parser in einer `node:vm`-Sandbox. Deren Arrays haben einen anderen Prototyp, weshalb `assert.deepEqual` bei inhaltlich korrekten Ergebnissen fehlschlug – sechs Tests waren rot, obwohl der Parser richtig arbeitete. Der Block wird jetzt im selben Realm ausgewertet.

### 2.3.0 (2026-08-06)
- **Kalender-Synchronisation**: FlowWeek lässt sich einmal mit Apple Kalender, Google Kalender (Android) oder Outlook verbinden – danach erscheinen alle Termine dort automatisch und bleiben aktuell, ohne manuellen Export.
- Neuer Endpunkt `api/calendar.js` liefert den Wochenplan als iCalendar-Feed: Termine mit Uhrzeit als echte Kalendereinträge, Aufgaben ohne Uhrzeit als ganztägige Einträge (blockieren den Tag nicht), feste Termine in jeder Woche.
- Uhrzeiten werden in der Zeitzone des Nutzers berechnet und bleiben über die Sommerzeit-Umstellung hinweg korrekt.
- Zugriff über einen geheimen Feed-Token; der Server speichert nur dessen Hash. Im Menü zeigt FlowWeek an, wann der Kalender zuletzt abgerufen hat, und die Verbindung lässt sich jederzeit trennen.

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
