# Validierung

`runValidation(fieldWidth, fieldLength, items)`
([`lib/validation/index.ts`](../src/lib/validation/index.ts)) kombiniert zwei
unabhängige Prüfungen zu einer gemeinsamen Liste von `ValidationIssue`
(`severity: "error" | "warning"`, optional mit `formationId` für Klick-Fokus
in der UI).

## Geometrie ([geometry.ts](../src/lib/validation/geometry.ts))

Prüft rein anhand der Cone-Positionen:

- ob Markierungen oder ganze Formationen über den Rand der Fläche
  hinausragen,
- ob Pylonen unterschiedlicher Formationen nahezu aufeinanderstehen.

## Strecken-Logik ([track.ts](../src/lib/validation/track.ts))

Rekonstruiert anhand der Cone-Positionen einen groben Fahrfluss
(`orderTrackGreedy`, `buildConnectedComponents`) und prüft u. a.:

- ob überhaupt Formationen platziert sind,
- ob zwei aufeinanderfolgende Aufgaben zu weit auseinanderliegen
  (Sprung > 10 m) oder zu nah beieinanderstehen,
- ob die Strecke in mehrere voneinander getrennte Bereiche zerfällt,
- ob ein Start-/Zielbereich am Rand der Fläche erkennbar ist,
- ob ein **Vorstartbereich** (3×3 m) bzw. eine **Wechselzone** (3×3 m)
  vorhanden sind — beide sind laut Regelwerk Pflicht.

## Darstellung in der UI

Die Sektion „Prüfung“ in [App.tsx](../src/App.tsx) zeigt Fehler (rot) und
Hinweise (gelb) an. Ein Klick auf eine Meldung mit gesetzter `formationId`
selektiert die betroffene Formation auf der Zeichenfläche.

## Neue Prüfregel ergänzen

Neue Regeln werden als zusätzliche Prüfschritte in `validateGeometry` bzw.
`validateTrack` ergänzt und liefern `ValidationIssue`-Objekte mit
`severity`, `message`, optionalem `details`-Text und optionaler
`formationId` zurück. Der `ValidationContext`
([types.ts](../src/lib/validation/types.ts)) stellt dafür Feldmaße,
platzierte Items und vorberechnete `worldCones` (absolute Cone-Positionen)
bereit.
