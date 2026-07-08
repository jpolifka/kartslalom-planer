# Persistenz

Seit Phase 1 gibt es zwei Persistenz-Modi, je nachdem ob ein Nutzer
angemeldet ist (`useAuthStore().session`):

- **Gast-Modus** (keine Session): wie bisher reines Browser-`localStorage`
  über [`lib/storage.ts`](../src/lib/storage.ts).
- **Cloud-Modus** (Session vorhanden): Speichern/Laden über Supabase-RPCs
  (`create_track`, `save_track`, siehe [`lib/api/tracks.ts`](../src/lib/api/tracks.ts)),
  serverseitige Tier-Limits und Ownership-Prüfung via RLS.

`SavedState` aus `storage.ts` bleibt in beiden Fällen die gemeinsame
Datenform — im Cloud-Modus wird sie 1:1 in die RPC-Parameter
(`p_state_json`, `p_area_sel`, `p_width`, `p_length`, `p_map_provider_id`,
`p_opacity`) abgebildet.

## Autosave (localStorage, Gast-Modus)

`EditorPage.tsx` speichert den kompletten Zustand (platzierte Formationen, Pfeile,
Feldmaße, Kartenausschnitt, Kartenoptionen) **debounced** — 1 Sekunde nach
der letzten Änderung — über `saveState(...)` in `localStorage` unter dem
Schlüssel `kartslalom_autosave`.

Beim Start der App wird `loadState()` einmalig aufgerufen und das Ergebnis in
der Modul-Variable `_initialSaved` abgelegt, damit alle `useState`-Lazy-
Initializer denselben geladenen Stand verwenden.

Über den „Neu“-Button (`clearSavedState()`) lässt sich der gespeicherte Stand
verwerfen und die App in den Ausgangszustand zurücksetzen (mit
Sicherheitsabfrage).

## Autosave (Cloud, eingeloggte Nutzer)

Bei vorhandener Session ruft `EditorPage.tsx` denselben debounced
1-Sekunden-Timer auf, speichert aber statt `saveState(...)` per
`useSaveTrack()`-Mutation den Zustand über die `save_track()`-RPC.

- **Neue Strecke** (`/editor/new`): Beim Mount wird sofort `create_track()`
  aufgerufen und zu `/editor/:id` weitergeleitet. Schlägt das wegen
  `TRACK_LIMIT_REACHED` fehl, geht es zurück zum Dashboard mit Hinweis.
- **Bestehende Strecke** (`/editor/:trackId`): `useTrack(trackId)` lädt den
  Datensatz einmalig in den lokalen State (`cloudAppliedRef`), danach greift
  der normale Autosave.
- **Fehlerbehandlung**: Liefert `save_track()` `MAP_PROVIDER_REQUIRES_PRO`
  (Free-Tarif + Premium-Kartenanbieter wie `rlp_dop20`), setzt das Frontend
  `mapProviderId` automatisch auf `"osm"` zurück und zeigt einen Hinweis.
  `NOT_OWNER` (fremder Track) wird als generischer Fehler behandelt.

## localStorage-Migration beim ersten Login

`AuthCallbackPage.tsx` prüft nach erfolgreichem Magic-Link-Login, ob im
Browser noch ein Gast-Stand (`loadState()`) existiert und der Nutzer noch
keine Cloud-Tracks hat (`count` auf `tracks`). Falls ja, wird per
`create_track("Meine Strecke (migriert)")` + `saveTrack(...)` ein neuer
Cloud-Track angelegt und anschließend `clearSavedState()` aufgerufen.

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
