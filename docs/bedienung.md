# Bedienung

## Responsives Layout

`useIsMobile()` (in [App.tsx](../src/App.tsx)) beobachtet
`window.matchMedia` mit der Schwelle `MOBILE_BREAKPOINT = 860`. Unterhalb
dieser Breite wechselt das Layout von der 3-Spalten-Ansicht
(Formationen | Fläche | Eigenschaften) zu einer einspaltigen Ansicht mit zwei
einblendbaren Drawern (`mobilePanel`: `"formations" | "properties" | null`),
die über Buttons in der Werkzeugleiste geöffnet und geschlossen werden
(`mobileDrawerStyle`, `DrawerHeader`).

## Tastaturkürzel

Implementiert in einem globalen `keydown`-Listener in `App.tsx`:

| Kürzel | Wirkung |
| --- | --- |
| `⌘Z` / `Strg+Z` | Rückgängig |
| `⌘⇧Z` / `Strg+Y` / `Strg+⇧+Z` | Wiederherstellen |
| `Esc` | Zurück in den Auswahl-Modus |
| `Entf` / `Rücktaste` | Auswahl löschen (Formation(en) oder Pfeil) — wird ignoriert, wenn ein Eingabefeld fokussiert ist |
| `Shift+Klick` | Mehrfachauswahl von Formationen |

## Hilfe in der App

Über den „Hilfe“-Button in der Kopfleiste öffnet sich ein Modal
(`HelpContent` in `App.tsx`) mit einer Anleitung für Endnutzer:innen
(Streckenbereich festlegen, Formationen platzieren/bearbeiten, Pfeile
zeichnen, Prüfung verstehen, Speichern/Export/Import, Tastaturkürzel, mobile
Bedienung). Änderungen an der Bedienung der App sollten dort entsprechend
nachgepflegt werden.
