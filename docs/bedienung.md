# Bedienung

## Responsives Layout

`useIsMobile()` ([`pages/editor/hooks/useIsMobile.ts`](../src/pages/editor/hooks/useIsMobile.ts))
beobachtet `window.matchMedia` mit der Schwelle `MOBILE_BREAKPOINT = 860`.
Unterhalb dieser Breite wechselt [`EditorPage.tsx`](../src/pages/EditorPage.tsx) von der
3-Spalten-Ansicht (`LeftSidebar` | Zeichenfläche | `RightPanel`) zu einer
einspaltigen Ansicht. Die beiden Seitenleisten werden dann zu einblendbaren
Schubladen (`mobilePanel`: `"formations" | "properties" | null`), die über die
Schaltflächen „Formationen“ und „Eigenschaften“ in der Werkzeugleiste geöffnet und
geschlossen werden (`mobileDrawerStyle` in
[`editorStyles.ts`](../src/pages/editor/editorStyles.ts), `DrawerHeader`).

## Tastaturkürzel im Streckeneditor

Implementiert in einem globalen `keydown`-Listener in
[`EditorPage.tsx`](../src/pages/EditorPage.tsx):

| Kürzel | Wirkung |
| --- | --- |
| `⌘Z` / `Strg+Z` | Rückgängig |
| `⌘⇧Z` / `Strg+Y` / `Strg+⇧+Z` | Wiederherstellen |
| `⌘A` / `Strg+A` | Alle Formationen auswählen (nicht in Eingabefeldern) |
| `⌘C` / `Strg+C` | Ausgewählte Formationen kopieren (nicht in Eingabefeldern) |
| `⌘V` / `Strg+V` | Einfügen mit 1 m Versatz (nicht in Eingabefeldern) |
| `Esc` | Zurück in den Auswahl-Modus |
| `Entf` / `Rücktaste` | Auswahl löschen (Formation(en) oder Pfeil) — wird ignoriert, wenn ein Eingabefeld fokussiert ist |
| `Shift+Klick` | Mehrfachauswahl von Formationen |

Der Formation-Editor hat einen eigenen Listener in
[`FormationEditorPage.tsx`](../src/pages/FormationEditorPage.tsx) mit denselben
Kürzeln (zusätzlich `Cmd/Strg+Klick` für die Mehrfachauswahl); siehe
[`docs/user/formation-editor/08-tastaturkuerzel.md`](user/formation-editor/08-tastaturkuerzel.md).

## Hilfe in der App

Der „Hilfe“-Button in der Navigation (`GlobalNav`) öffnet ein Modal (`HelpModal`).
Je nach Seite zeigt es `TrackHelpContent` (Streckeneditor) oder
`FormationHelpContent` (Formation-Editor). Beide rendern die Markdown-Dateien aus
[`docs/user/`](user/) bzw. `docs/user/formation-editor/`, die per Vite-`?raw`-Import
ins Bundle gebündelt werden (`MarkdownSections`). Änderungen an der Bedienung der
App müssen dort nachgepflegt werden — die Dateien sind Teil des Produkts.
