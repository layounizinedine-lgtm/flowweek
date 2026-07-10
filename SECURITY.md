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

## Supabase (Nutzerdaten)

- `supabase/flowweek_kv_rls.sql` im Supabase-SQL-Editor ausführen, bevor der Cloud-Sync produktiv genutzt wird.
- Die Policies stellen sicher, dass jeder Nutzer ausschließlich seine eigenen Zeilen lesen/schreiben/löschen kann (`auth.uid() = user_id`).
- Der Anon-Key im Frontend ist kein Geheimnis; die Sicherheit kommt aus Supabase Auth + RLS. Verifiziert am 10.07.2026: Lesen ohne Login liefert keine Daten, Schreiben ohne Login wird mit 401 abgelehnt.
- Empfohlen in den Supabase-Auth-Einstellungen: Mindest-Passwortlänge ≥ 8 und Schutz vor geleakten Passwörtern aktivieren.

## Datenschutz

- Audio wird nicht aufgezeichnet oder gespeichert – die Spracherkennung läuft über die Web Speech API des Browsers; verarbeitet wird nur der erkannte Text.
- Auto-Politur ist standardmäßig aus; Text geht nur nach ausdrücklicher Aktion an den KI-Proxy.
- Der Proxy loggt keine Nachrichteninhalte, nur Fehlerstatus.
