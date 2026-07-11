# Testplan – Pilotphase Kartslalom Streckenplaner

Ergänzt `docs/roadmap.md` (Phase "Jetzt"). Der Pilot soll nicht primär
beweisen, dass die Software technisch funktioniert — das ist durch die
automatisierten Tests bereits weitgehend nachgewiesen.

## 1. Ziel

Der Pilot soll beantworten:

1. Verstehen neue Nutzer die Anwendung ohne persönliche Einweisung?
2. Können sie einen vollständigen Streckenplan erstellen?
3. Sind Begriffe, Bedienung und Arbeitsabläufe verständlich?
4. Welche Funktionen werden tatsächlich verwendet?
5. Welche Funktionen sind als Pro-Mehrwert überzeugend?
6. Welche Probleme verhindern eine reale Nutzung vor einem Rennen?

## 2. Teilnehmer

Empfohlene erste Gruppe: 6–8 Personen.

- 2 erfahrene Streckenplaner
- 2 Trainer aus anderen Vereinen
- 1 Veranstalter oder Sportleiter
- 1 technisch wenig versierter Nutzer
- optional 1–2 weitere Trainer oder Betrachter

Nicht alle Teilnehmer sollten aus demselben Verein stammen. Mindestens zwei
Teilnehmer sollten die Anwendung vorher noch nie gesehen haben.

## 3. Testumgebung

Für alle Teilnehmer möglichst dieselbe freigegebene Version verwenden. Vor
dem Test dokumentieren: App-Version, Browser, Betriebssystem,
Bildschirmgröße, Nutzer-Tier, Testdatum, Testart (begleitet/unbegleitet).

Empfohlene Browser: Chrome/Edge Desktop, Firefox Desktop, Safari macOS,
optional Tablet-Browser. Smartphone-Bearbeitung ist zunächst kein primäres
Erfolgskriterium — öffentliche Betrachtung und grundlegende Navigation
sollten dennoch geprüft werden.

## 4. Nutzergruppen

**Gruppe A – Pro:** voller Funktionsumfang (RLP-Luftbild, Versionshistorie,
PNG-Export, Share-Links, eigene Formationen).

**Gruppe B – Free:** eingeschränkte Nutzung (Streckenlimit, keine Premium-
Kartenprovider, keine Versionshistorie, eingeschränkte Premiumfunktionen).
Ziel ist nicht, zum Upgrade zu zwingen, sondern zu prüfen: Sind
Einschränkungen verständlich? Wird erklärt, warum eine Funktion gesperrt
ist? Bleibt Free trotzdem sinnvoll nutzbar? Welche gesperrte Funktion wird
tatsächlich vermisst?

## 5. Durchführung

**Begleitete Tests:** Beobachter schaut zu, hilft nicht ungefragt. Aufgaben
vorlesen/schriftlich geben, Bedienung nicht erklären, erst helfen wenn der
Nutzer ausdrücklich nicht weiterkommt, jede Hilfestellung notieren, Nutzer
bitten laut zu denken.

**Unbegleitete Tests:** Teilnehmer erhalten nur URL, Testaccount/Login-
Anweisung, Aufgabenliste, Feedbackformular — prüft, ob die App auch ohne
direkte Begleitung funktioniert.

## 6. Kernaufgaben

| # | Aufgabe | Erfolgskriterium |
|---|---------|-------------------|
| 1 | Anmeldung per E-Mail (Magic Link/OTP) | ohne Hilfe innerhalb von 3 Minuten |
| 2 | Neue Strecke erstellen und benennen | erstellt und benannt, ohne Hilfe |
| 3 | Veranstaltungsfläche auf der Karte auswählen | nutzbare Fläche erfolgreich festgelegt |
| 4 | Mindestens 5 Hindernisse platzieren | mindestens 5 Formationen sinnvoll platziert |
| 5 | Validierungsfehler erkennen und beheben | ein Problem ohne Hilfe behoben |
| 6 | Export als PDF und PNG | zwei Dateien erfolgreich heruntergeladen und geöffnet |
| 7 | Öffentlichen Share-Link erzeugen | Link in privatem Browserfenster erfolgreich geöffnet |
| 8 | Strecke ändern, vorherige Version wiederherstellen | ursprünglicher Zustand wiederhergestellt |
| 9 | Aus einer älteren Version neue eigenständige Strecke erstellen ("Speichern unter") | neue Strecke mit korrektem alten Zustand |
| 10 | Eigenes Hindernis erstellen und in einer Strecke verwenden | Formation gespeichert und eingesetzt |
| 11 | Hindernis aus der Bibliothek als eigene Kopie speichern | Kopie erstellt, Original unverändert |
| 12 | Gespeicherte Daten und Löschoption im Account finden | Datenexport und Löschfunktion gefunden (nicht tatsächlich löschen, außer dedizierter Testaccount) |

Jede Aufgabe hat spezifische Beobachtungspunkte (Begriffsverständnis,
Auffindbarkeit von Funktionen, Fehlerverständnis) — siehe Detailbeschreibung
im Pilot-Review vom 2026-07-11 als Hintergrund für Beobachter.

## 7. Messwerte

Für jede Aufgabe erfassen: erfolgreich (ja/nein), ohne Hilfe erfolgreich
(ja/nein), benötigte Zeit, Anzahl Fehlversuche, Hilfestellungen (Zahl +
Inhalt), unklarer Begriff (Freitext), erwartetes vs. tatsächliches Verhalten
(Freitext), Schweregrad (P0/P1/P2).

Zusätzlich je Teilnehmer: Gesamtzahl erfolgreicher Aufgaben, Gesamtzahl
Hilfen, schwierigste Aufgabe, wertvollste Funktion, vermisste Funktion,
Bereitschaft zur erneuten Nutzung.

## 8. Erfolgsziele der ersten Pilotphase

- mindestens 5 externe Nutzer nehmen teil
- mindestens 3 Nutzer erstellen eine vollständige Strecke ohne direkte Hilfe
- mindestens 80 % der Kernaufgaben 1–7 werden erfolgreich abgeschlossen
- kein ungelöstes P0-Problem
- die drei größten UX-Hürden sind eindeutig identifiziert
- mindestens 3 Nutzer wollen die App bei einem echten Training/Rennen erneut nutzen
- belastbare Einschätzung der Free-/Pro-Grenzen ist möglich

## 9. Fehlerpriorisierung

- **P0 – blockierend** (sofort beheben): Login nicht möglich, Strecke kann
  nicht erstellt/gespeichert werden, Datenverlust, Export unbrauchbar,
  Berechtigungs-/Datenschutzproblem, Kernaufgabe trotz Hilfe nicht lösbar.
- **P1 – starke Reibung** (vor öffentlichem Rollout beheben): Kernfunktion
  wird regelmäßig nicht gefunden, Begriff wird mehrfach falsch verstanden,
  wiederholte Hilfe nötig, unnötig komplizierter Schritt, Fehlermeldung
  führt nicht zur Lösung.
- **P2 – Komfort** (nur bei wiederholter Nachfrage): Einzelwunsch,
  optische Verbesserung, selten genutzte Zusatzfunktion.

## 10. Free-/Pro-Auswertung

Statt allgemein zu fragen "Würdest du bezahlen?":

1. Welche Funktion war für dich am wichtigsten?
2. Welche Funktion würdest du am stärksten vermissen?
3. Reicht die Free-Version für gelegentliche Nutzung?
4. Welche gesperrte Funktion wolltest du tatsächlich verwenden?
5. Würdest du eher persönlich oder über deinen Verein bezahlen?
6. Wie häufig würdest du die Anwendung verwenden?
7. Welcher Preis erscheint für den tatsächlichen Nutzen angemessen?
8. Würdest du jetzt einen Pro-Zugang anfordern?

Bewertet wird tatsächliches Verhalten, nicht nur geäußerte Zustimmung.

## 11. Technischer Release-Test vor jedem Pilotstand

```
npm ci
npm test
npm run build
npm audit --audit-level=high
```

Zusätzlich gegen einen frischen lokalen Supabase-Stack:

```
sh docker/run-integration-test-local.sh
sh docker/run-security-test-local.sh
sh docker/run-playwright-local.sh
```

Außerdem manuell prüfen: Compose-Konfiguration, Migrationen auf leerer DB
und auf Kopie eines bestehenden Datenbestands, Login-Mail und OTP real,
RLP-WMS erreichbar, OSM-Kacheln erreichbar, PDF/PNG/SVG-Dateien öffnen,
öffentlicher Share-Link im privaten Browserfenster.

## 12. Browser- und Gerätetest

Pflicht: Chrome Desktop, Firefox Desktop, Safari Desktop, Edge Desktop.
Zusätzlich: iPad/vergleichbares Tablet, Android/iPhone-Browser für
Share-Link und Dashboard. Schwerpunkt auf Mobilgeräten: Anmeldung,
öffentliche Ansicht, Dashboard, Einstellungen, grundlegende
Editorbedienung. Vollständige Smartphone-Bearbeitung ist kein Muss.

## 13. Abschlussbericht

Nach der ersten Pilotphase:

```
Teilnehmer:
Erfolgsquote:
Top-3-UX-Probleme:
Top-3-fehlende Arbeitsabläufe:
Meistgenutzte Pro-Funktionen:
Kaum genutzte Funktionen:
P0-Probleme:
Empfehlung für Free/Pro:
Empfehlung für öffentlichen Rollout:
```

Aus diesem Bericht werden maximal drei konkrete Entwicklungsprioritäten
abgeleitet.
