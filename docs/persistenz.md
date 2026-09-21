# Persistenz

Je nachdem, ob eine Session besteht (`useAuthStore().session`), speichert der
Streckeneditor an unterschiedlichen Orten:

- **Gast-Modus** (keine Session): reines Browser-`localStorage` über
  [`lib/storage.ts`](../src/lib/storage.ts). Es gibt keinen Tarif, alle
  Editor-Funktionen sind frei.
- **Cloud-Modus** (Session): Speichern/Laden über Supabase-RPCs (`create_track`,
  `save_track`, siehe [`lib/api/tracks.ts`](../src/lib/api/tracks.ts)),
  serverseitige Tarif-Limits und Ownership-Prüfung. Im Cloud-Modus liegt der
  Stand **nur** in der Cloud, nicht zusätzlich im `localStorage`.

`SavedState` aus `storage.ts` ist in beiden Fällen die gemeinsame Datenform
(`version`, optionaler `name`, `items`, `arrows`, `manualWidth`, `manualLength`,
`mapProviderId`, `mapOpacity`, `areaSel`). Im Cloud-Modus wird sie auf die
RPC-Parameter von `save_track` abgebildet: `p_track_id`,
`p_state_json` (`{ items, arrows }`), `p_area_sel`, `p_width`, `p_length`,
`p_map_provider_id`, `p_opacity`.

## Autosave im Streckeneditor

`EditorPage.tsx` speichert **debounced**: jede Änderung an Formationen, Pfeilen,
Feldmaßen, Kartenausschnitt oder Kartenoptionen setzt einen 1-Sekunden-Timer
zurück, erst danach wird gespeichert. Der Status (`pending` → `saved`) wird in der
Werkzeugleiste angezeigt.

**Gast-Modus:** `saveState(...)` schreibt in `localStorage` unter dem Schlüssel
`kartslalom_autosave`. `loadState()` wird einmalig beim Laden des Moduls
aufgerufen und in `_initialSaved` abgelegt, damit alle `useState`-Lazy-Initializer
denselben Stand verwenden. „Neu beginnen“ (`clearSavedState()`) verwirft den Stand
nach Sicherheitsabfrage.

**Cloud-Modus:** derselbe Timer ruft `useSaveTrack()` (RPC `save_track`) auf.

- **Neue Strecke** (`/editor/new`): beim Mount wird sofort `create_track()`
  aufgerufen und auf `/editor/:id` weitergeleitet. Schlägt das mit
  `TRACK_LIMIT_REACHED` fehl, geht es zurück zum Dashboard mit Hinweis.
- **Bestehende Strecke** (`/editor/:trackId`): `useTrack(trackId)` lädt den
  Datensatz einmalig in den lokalen State (`cloudAppliedRef`), danach greift der
  Autosave.
- **Fehlerbehandlung:** Liefert `save_track()` `MAP_PROVIDER_REQUIRES_PRO`
  (Free-Tarif mit Premium-Kartenanbieter `rlp_dop20`), setzt der Editor
  `mapProviderId` auf `"osm"` zurück und zeigt einen Hinweis. `NOT_OWNER`
  (fremde Strecke) wird als generischer Fehler behandelt.
- **Kein Autosave** gibt es im Versionsvorschau-Modus (`?previewVersion=…`) und
  wenn ein Admin eine fremde Strecke ansieht.

## Entwurf im Formation-Editor

Der Formation-Editor (`FormationEditorPage.tsx`) sichert einen neuen Entwurf
fortlaufend im `localStorage` unter `kartslalom-formation-draft` (Name,
Beschreibung, Kategorie, Dauer, lichte Breite, Cones, Pfeile, Herkunft). Das gilt
auch im Cloud-Modus, solange die Formation noch nicht gespeichert ist; beim
Speichern wird der Entwurf entfernt. Eigene Formationen liegen ansonsten in der
Tabelle `custom_formations` (siehe [architektur.md](architektur.md#formationen)).

## localStorage-Migration beim ersten Login

`AuthCallbackPage.tsx` prüft nach dem Magic-Link-Login, ob im Browser noch ein
Gast-Stand mit mindestens einer Formation existiert und der Nutzer noch **keine**
Cloud-Strecke hat (`count` auf `tracks`). Falls ja, wird per
`create_track("Meine Strecke (migriert)")` und `saveTrack(...)` eine Cloud-Strecke
angelegt — mit `mapProviderId: "osm"`, da ein Free-Nutzer keinen Premium-Anbieter
speichern darf — und anschließend `clearSavedState()` aufgerufen.

## Versionierung des Datenformats

`SavedState.version` (aktuell `CURRENT_VERSION = 1`) markiert das Format.
`loadState()` und `parseImportFile()` vergleichen **strikt**: bei abweichender
Version wird der Autosave-Stand verworfen bzw. der Import mit
„Inkompatible Version“ abgelehnt.

Abwärtskompatibel ohne Versionssprung gelöst sind zwei Fälle:

- `normalizeSavedState()` übersetzt das frühere Boolean-Feld `mapSatellite` beim
  Lesen in `mapProviderId` (alte Autosaves und Exportdateien bleiben nutzbar).
- `sanitizeItems()` ergänzt bei eigenen Formationen (`key: "custom"`) ohne
  `customSnapshot` einen Platzhalter („⚠ Fehlendes Hindernis“), statt zu crashen.

> **Hinweis für Änderungen am gespeicherten Format:** Ein echter Formatbruch
> (neue Pflichtfelder, umbenannte oder entfernte Felder) erfordert eine neue
> `CURRENT_VERSION` **und** eine Normalisierungsfunktion für die vorherige Version
> in `loadState`/`parseImportFile` — sonst gehen ältere Stände verloren. Die
> ausführliche Checkliste steht als Kommentar in `storage.ts`
> (u. a. müssen die Tests in `storage.test.ts` mitgezogen werden).

## Versionshistorie (Snapshots)

Im Cloud-Modus (Pro/Team) lassen sich pro Strecke manuell Snapshots anlegen
(Tabelle `track_versions`; RPCs `create_track_version`, `get_track_versions`,
`get_track_version_detail`, `restore_track_version`, `delete_track_version`,
`create_track_from_version`; Hooks in `hooks/useTracks.ts`). Eine Version wird per
`?previewVersion=<id>` im Editor als Vorschau mit Schreibschutz-Banner geöffnet,
kann wiederhergestellt oder als neue, eigenständige Strecke gespeichert werden.

## Datei-Export/-Import (JSON)

- `exportAsFile(state)` schreibt den aktuellen `SavedState` als JSON-Datei zum
  Download. Der Dateiname lautet `kartslalom_<name>_<datum>.json`; ohne Streckenname
  entfällt `<name>_`. Der Name wird auf erlaubte Zeichen reduziert und auf 50 Zeichen
  gekürzt.
- `parseImportFile(json)` liest eine solche Datei wieder ein, validiert Grundstruktur
  und Version und wirft verständliche Fehlermeldungen (ungültiges JSON, falsches
  Format, inkompatible Version, fehlende Streckendaten).

Damit lässt sich eine Strecke sichern, auf einem anderen Gerät weiterbearbeiten
oder teilen — unabhängig vom `localStorage` des jeweiligen Browsers. Öffentliche
Ansichts-Links sind ein eigenes Feature, siehe [track-share-links.md](track-share-links.md).
