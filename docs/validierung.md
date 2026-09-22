# Validierung

`runValidation(fieldWidth, fieldLength, items)`
([`lib/validation/index.ts`](../src/lib/validation/index.ts)) kombiniert zwei
unabhängige Prüfungen zu einer gemeinsamen Liste von `ValidationIssue`
(`severity: "error" | "warning" | "info"`, optional mit `formationId` für Klick-Fokus
in der UI). Rot dargestellt werden `error`, gelb `warning` und `info`.

## Geometrie ([geometry.ts](../src/lib/validation/geometry.ts))

Prüft rein anhand der Cone-Positionen:

- ob Markierungen oder ganze Formationen über den Rand der Fläche
  hinausragen (Formationen mit Pylonen: `error`; reine Pfeil-/Richtungs-
  markierungen: nur `warning`),
- ob Pylonen unterschiedlicher Formationen nahezu aufeinanderstehen.

## Strecken-Logik ([track.ts](../src/lib/validation/track.ts))

Rekonstruiert anhand der Cone-Positionen einen groben Fahrfluss
(`orderTrackGreedy`, `buildConnectedComponents`) und prüft u. a.:

- ob überhaupt Formationen platziert sind,
- ob der nächste Pylonenabstand zwischen zwei unterschiedlichen Formationen
  zu klein (< 0,5 m) oder zu groß (> 10 m) ist,
- ob im geschätzten Fahrfluss (`orderTrackGreedy`) zwischen zwei
  aufeinanderfolgenden Aufgaben ein besonders großer Sprung liegt (> 14 m —
  bewusst toleranter als der 10-m-Schwellwert oben, da die Fahrreihenfolge
  nur eine grobe Schätzung ist),
- ob die Strecke dadurch in mehrere voneinander getrennte Bereiche zerfällt
  (`buildConnectedComponents`, derselbe 10-m-Schwellwert, aber auf
  Formations-Mittelpunkte statt einzelner Pylonen angewendet),
- ob ein Start-/Zielbereich am Rand der Fläche erkennbar ist (nur `info`),
- ob ein **Vorstartbereich** (3×3 m) bzw. eine **Wechselzone** (3×3 m)
  vorhanden sind — beide sind laut Regelwerk Pflicht.

## Darstellung in der UI

`EditorPage.tsx` berechnet die Liste per `useMemo(runValidation(...))`; die Sektion
„Prüfung“ im [`RightPanel`](../src/pages/editor/components/RightPanel.tsx) zeigt Fehler
(rot) und Hinweise (gelb) an, `TrackCanvas` hebt die betroffenen Formationen farbig
hervor. Ein Klick auf eine Meldung mit gesetzter `formationId`
selektiert die betroffene Formation auf der Zeichenfläche.

## Neue Prüfregel ergänzen

Neue Regeln werden als zusätzliche Prüfschritte in `validateGeometry` bzw.
`validateTrack` ergänzt und liefern `ValidationIssue`-Objekte mit
`severity`, `message`, optionalem `details`-Text und optionaler
`formationId` zurück. Der `ValidationContext`
([types.ts](../src/lib/validation/types.ts)) stellt dafür Feldmaße,
platzierte Items und vorberechnete `worldCones` (absolute Cone-Positionen)
bereit.
