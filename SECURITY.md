# FlowWeek – Sicherheit

FlowWeek speichert Gastdaten nur lokal im Browser. Der Cloud-Sync läuft über Supabase mit aktivierter Row Level Security. Der Anthropic-API-Key liegt ausschließlich serverseitig in Vercel.

## Schutz des API-Keys (Vercel-Proxy `api/chat.js`)

Der Proxy ist mehrfach abgesichert:

- **Origin-Pflicht**: Anfragen ohne `Origin`-Header oder von nicht erlaubten Origins werden mit 403 abgelehnt. Direkte Aufrufe per curl/Skript scheitern damit.
- **Limit pro IP**: `RATE_LIMIT_PER_MINUTE` (Standard: 10 Anfragen/Minute).
- **Globales Limit über alle Nutzer**: `GLOBAL_LIMIT_PER_MINUTE` (Standard: 30) und `GLOBAL_LIMIT_PER_DAY` (Standard: 300). Damit kann auch ein Angreifer mit vielen IP-Adressen keine unbegrenzten Kosten erzeugen.
- **Request-Validierung**: nur POST + JSON, max. 64 KB, Nachrichten werden gefiltert und gekürzt, `max_tokens` ist auf 1600 gedeckelt.
- **Kein Info-Leak**: Fehlerdetails der Anthropic-API werden nicht an den Client weitergereicht.

Hinweis: Die Zähler liegen im Speicher der jeweiligen Serverless-Instanz und sind daher ein weiches Limit. Das **harte** Limit gehört zusätzlich in die Anthropic Console.

## Pflicht-Einstellungen für den Betrieb

1. `ANTHROPIC_API_KEY` nur als Vercel-Umgebungsvariable setzen – nie im Code oder Repo.
2. `ALLOWED_ORIGINS` in Vercel auf die eigene Domain setzen, z. B. `https://layounizinedine-lgtm.github.io` (die localhost-Einträge der Default-Liste sind nur für lokale Entwicklung gedacht).
3. **Spend-Limit in der Anthropic Console setzen** (console.anthropic.com → Settings → Limits): ein monatliches Budget, z. B. 5–10 USD. Das ist die letzte Verteidigungslinie – selbst wenn alles andere versagt, kann niemand mehr ausgeben als dieses Budget.
4. Optional die Limits anpassen: `RATE_LIMIT_PER_MINUTE`, `GLOBAL_LIMIT_PER_MINUTE`, `GLOBAL_LIMIT_PER_DAY`, `ANTHROPIC_MODEL`.

## Kalender-Feed (`api/calendar.js`)

Kalender-Apps können sich nicht per Supabase-Auth anmelden – sie rufen eine URL ab. Deshalb weist sich der Feed über einen geheimen Token in der URL aus:

- **Token**: 32 zufällige Bytes aus `crypto.getRandomValues` (256 Bit), base64url-kodiert. Nicht erratbar.
- **Nur der Hash liegt auf dem Server**: In `flowweek_calendar_feeds` steht ausschließlich der SHA-256-Hash. Die Tabelle enthält damit kein verwendbares Geheimnis; den Klartext kennt nur das Gerät des Nutzers (und seine eigene, RLS-geschützte Zeile in `flowweek_kv`).
- **Kein Enumerieren**: Fehlender, ungültiger und unbekannter Token liefern dieselbe Antwort (404). Zusätzlich greift ein Limit pro IP (`CALENDAR_RATE_LIMIT_PER_MINUTE`, Standard 60/Minute).
- **Nur Lesen**: Der Endpunkt akzeptiert ausschließlich GET/HEAD und gibt nur Kalenderdaten aus – über den Feed lässt sich nichts verändern.
- **Service-Role-Key**: Der Feed umgeht RLS bewusst (die Kalender-App hat keine Nutzersitzung) und liest deshalb mit `SUPABASE_SERVICE_ROLE_KEY`. Dieser Key gehört **ausschließlich** in die Vercel-Umgebungsvariablen – nie ins Frontend, nie ins Repo. Gelesen werden nur die Zeilen genau des Nutzers, zu dem der Token gehört, und nur die Wochen im Feed-Fenster.
- **Widerrufbar**: „Verbindung trennen“ löscht die Zeile; der alte Link liefert sofort 404. Erneutes Verbinden erzeugt einen neuen Token.
- **Eingaben werden bereinigt**: Titel und Notizen werden von Steuerzeichen befreit, gekürzt und nach RFC 5545 maskiert; die Zeitzone wird gegen `Intl` validiert. Damit lässt sich über einen manipulierten Termin nichts in den Feed einschleusen.

Restrisiko, das der Nutzer kennen muss und das die App auch so benennt: **Wer den Link hat, kann die Termine lesen.** Das ist bei abonnierten Kalendern systembedingt so (Google und Apple arbeiten genauso). Deshalb wird der Link wie ein Passwort behandelt und ist jederzeit widerrufbar.

## Supabase (Nutzerdaten)

- `supabase/flowweek_kv_rls.sql` und `supabase/flowweek_calendar_rls.sql` im Supabase-SQL-Editor ausführen, bevor Cloud-Sync bzw. Kalender-Synchronisation produktiv genutzt werden.
- Die Policies stellen sicher, dass jeder Nutzer ausschließlich seine eigenen Zeilen lesen/schreiben/löschen kann (`auth.uid() = user_id`).
- Der Anon-Key im Frontend ist kein Geheimnis; die Sicherheit kommt aus Supabase Auth + RLS. Verifiziert am 10.07.2026: Lesen ohne Login liefert keine Daten, Schreiben ohne Login wird mit 401 abgelehnt.
- Empfohlen in den Supabase-Auth-Einstellungen: Mindest-Passwortlänge ≥ 8 und Schutz vor geleakten Passwörtern aktivieren.

## Datenschutz

- Audio wird nicht aufgezeichnet oder gespeichert – die Spracherkennung läuft über die Web Speech API des Browsers; verarbeitet wird nur der erkannte Text.
- Auto-Politur ist standardmäßig aus; Text geht nur nach ausdrücklicher Aktion an den KI-Proxy.
- Der Proxy loggt keine Nachrichteninhalte, nur Fehlerstatus.
