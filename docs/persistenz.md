# Persistenz

Die App hat keinen Server-Anteil — sämtliche Persistenz läuft über
[`lib/storage.ts`](../src/lib/storage.ts) im Browser bzw. über Dateien.

## Autosave (localStorage)

`App.tsx` speichert den kompletten Zustand (platzierte Formationen, Pfeile,
Feldmaße, Kartenausschnitt, Kartenoptionen) **debounced** — 1 Sekunde nach
der letzten Änderung — über `saveState(...)` in `localStorage` unter dem
Schlüssel `kartslalom_autosave`.

Beim Start der App wird `loadState()` einmalig aufgerufen und das Ergebnis in
der Modul-Variable `_initialSaved` abgelegt, damit alle `useState`-Lazy-
Initializer denselben geladenen Stand verwenden.

Über den „Neu“-Button (`clearSavedState()`) lässt sich der gespeicherte Stand
verwerfen und die App in den Ausgangszustand zurücksetzen (mit
Sicherheitsabfrage).

## Versionierung

`SavedState.version` (aktuell `CURRENT_VERSION = 1`) markiert das
Datenformat. Stimmt die Version beim Laden aus `localStorage` oder beim
Datei-Import nicht überein, wird der gespeicherte Stand verworfen
beziehungsweise der Import mit einer Fehlermeldung abgelehnt.

> **Hinweis für Änderungen am gespeicherten Format:** Wird die Struktur von
> `SavedState` geändert (neue Pflichtfelder, umbenannte/entfernte Felder),
> muss `CURRENT_VERSION` erhöht werden. Soll der bisherige Autosave-Stand
> dabei nicht verloren gehen, ist zusätzlich eine Migrationslogik in
> `loadState`/`parseImportFile` zu ergänzen — aktuell gibt es keine, ältere
> Versionen werden schlicht verworfen.

## Datei-Export/-Import (JSON)

- `exportAsFile(state)` schreibt den aktuellen `SavedState` als
  JSON-Datei (`kartslalom_<datum>.json`) zum Download.
- `parseImportFile(json)` liest eine solche Datei wieder ein, validiert
  Grundstruktur und Version und löst bei Fehlern eine verständliche
  Fehlermeldung aus (ungültiges JSON, falsches Format, inkompatible Version,
  fehlende Streckendaten).

Damit lässt sich eine Strecke als Datei sichern, auf einem anderen Gerät
weiterbearbeiten oder mit anderen teilen — unabhängig vom `localStorage`
des jeweiligen Browsers.
