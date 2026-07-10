# FlowWeek Launch-Analyse und Umsetzungsplan

Dieses Dokument fasst die aktuelle Bestandsaufnahme, die wichtigsten Risiken und die nächsten Schritte für einen echten Launch von FlowWeek zusammen.

## 1. Zusammenfassung der App

FlowWeek ist eine voice-first Wochenplanungs-App. Nutzer können Diktate erfassen, Texte mit KI polieren, Wochenaufgaben manuell anlegen und ihre Woche analysieren lassen. Gastdaten werden lokal gespeichert; angemeldete Nutzer können optional über Supabase synchronisieren. KI-Anfragen laufen über einen Vercel-Backend-Proxy, damit der eigentliche API-Key nicht im Frontend liegt.

## 2. Was bereits gut funktioniert

- Ruhige, fokussierte Ein-Seiten-Oberfläche mit klarer Bottom-Navigation.
- Lokaler Gastmodus mit `localStorage`-Fallback.
- Optionale Supabase-Authentifizierung und Cloud-Synchronisation.
- Backend-Proxy für KI-Aufrufe mit Origin-Prüfung, Request-Limit und Timeout.
- Wochenübersicht, Tageskarten, manuelles Hinzufügen, Löschen und Abhaken von Aufgaben.
- Web-Speech-Diktat mit Transkript, Snippets, Verlauf und KI-Politur.
- Lokale Wochenanalyse als Fallback, wenn die KI nicht erreichbar ist.
- Sicherheitsdokumentation und Supabase-RLS-SQL sind vorhanden.

## 3. Gefundene Risiken und Probleme

### Kritisch vor einem öffentlichen Launch

- Spracheingaben dürfen niemals ungeprüft direkt gespeichert werden.
- Mehrere erkannte Aufgaben, Termine und Erinnerungen müssen getrennt bleiben.
- Unklare oder unsichere KI-Ergebnisse müssen vor dem Speichern sichtbar überprüfbar sein.
- Supabase-RLS muss in der echten Produktionsdatenbank angewendet sein.
- Datenschutztexte müssen klar erklären, wann Text an den KI-Proxy gesendet wird.

### Wichtig vor Launch

- Echte Browser-Tests auf Mobilgerät, Tablet und Desktop fehlen noch.
- Mikrofonberechtigungen, abgebrochene Aufnahme und schlechte Verbindung müssen manuell geprüft werden.
- Wiederkehrende Aufgaben und echte Erinnerungen sind noch nicht vollständig produktionsreif.
- Es fehlen Ende-zu-Ende-Tests für Registrierung, Login, Wochenplanung und Audio-Vorschau.
- Impressum/Datenschutz müssen je nach Zielmarkt rechtlich geprüft werden.

### Sinnvoll nach Launch

- Undo nach Löschen.
- Einfache Suche.
- Bessere Synchronisationsanzeige.
- Optionales Drag-and-drop oder schnelles Verschieben per Datum.
- Monitoring und Crash-Reporting.

### Optional

- Erweiterte Kategorien.
- Changelog-Seite.
- Mehr Analysemetriken.
- Export-Funktion.

## 4. Bereits umgesetzte Verbesserungen

- Spracheingaben für die Wochenplanung werden nicht mehr sofort gespeichert.
- Es gibt eine bearbeitbare Vorschau mit der Überschrift „Ich habe Folgendes verstanden“.
- Nutzer können erkannte Einträge einzeln bearbeiten, entfernen, verwerfen oder bestätigen.
- Speichern erfolgt erst nach ausdrücklicher Bestätigung.
- Die KI-Anweisung verlangt strukturierte, validierbare JSON-Daten.
- Selbstkorrekturen wie „nein, mach daraus …“ werden vor der Planung berücksichtigt.
- Der lokale Parser erkennt relative Angaben wie „heute“, „morgen“, „übermorgen“ und „Wochenende“ besser.
- Einfache Duplikat-Vermeidung wurde ergänzt.
- Node-Testskripte und erste Tests für den Audio-Planungsflow wurden hinzugefügt.

## 5. Audio- und Spracheingabe: Zielverhalten

Eine einzelne Aufnahme soll mehrere getrennte Einträge erzeugen können, zum Beispiel:

> „Am Montag um 10 Uhr habe ich einen Arzttermin. Danach muss ich einkaufen. Dienstag möchte ich um 18 Uhr trainieren und am Donnerstag meine Mutter anrufen.“

Die App soll daraus eine Vorschau erzeugen:

- Montag
  - 10:00 Uhr – Arzttermin
  - Einkauf
- Dienstag
  - 18:00 Uhr – Training
- Donnerstag
  - Mutter anrufen

Erst nach Bestätigung werden diese Einträge in den Wochenplan übernommen.

## 6. Testplan vor Launch

### Automatisierte Tests

- JavaScript-Syntaxcheck für Backend und Frontend-Script.
- Unit-/Smoke-Tests für den Audio-Vorschau-Flow.
- Parser-Tests für relative Angaben, Korrekturen und Duplikat-Schutz.

### Manuelle Tests

- Registrierung und Login.
- Gastmodus.
- Session-Verhalten nach Reload.
- Manuelles Erstellen, Löschen und Abhaken von Aufgaben.
- Spracheingabe mit mehreren Tagen und Uhrzeiten.
- Vorschau bearbeiten, Eintrag entfernen, verwerfen und bestätigen.
- KI offline / Backend nicht erreichbar.
- Mikrofon verweigert.
- Mobile Ansicht auf kleinem Bildschirm.
- Wochenwechsel, Monatswechsel und Jahreswechsel.

## 7. Launch-Checkliste

- [ ] Supabase-RLS in Produktion angewendet.
- [ ] Produktions-Backend-URL geprüft.
- [ ] Erlaubte Origins im Backend final gesetzt.
- [ ] Datenschutztext final geprüft.
- [ ] Impressum ergänzt, falls erforderlich.
- [ ] Echte Audioaufnahme im Browser getestet.
- [ ] Mobile Darstellung auf echten Geräten geprüft.
- [ ] Fehlertexte für Mikrofon/API/Netzwerk geprüft.
- [ ] Kein API-Key oder Secret im Frontend außer Supabase-Anon-Key.
- [ ] Production-Deployment getestet.
- [ ] README mit Installations- und Deployment-Hinweisen finalisiert.

## 8. Aktueller Launch-Status

**Launchbereit als Beta nach manueller Browser- und Produktionsprüfung.**

Für einen uneingeschränkten öffentlichen Launch sollten vorher noch echte End-to-End-Tests, rechtliche Texte, Produktionskonfiguration und reale Audio-Aufnahmen auf mehreren Geräten geprüft werden.
