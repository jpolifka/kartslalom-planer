# Formationen

Formationen sind die wiederverwendbaren Pylonen-Layouts (z. B. „Tor“, „Gasse“,
„Deutsches Eck“, „Schnecke“), aus denen eine Strecke zusammengesetzt wird.

## Aufbau

Jede Formation ist als eigenes Modul in [`lib/formations/`](../src/lib/formations/)
definiert und liefert eine `FormationDefinition` mit normalisierten
Cone-Koordinaten (`normalizeCones`, siehe [geometry.ts](../src/lib/geometry.ts)).
Die Cone-Layouts werden über die Hilfsfunktionen `meter()` / `standing()` /
`lying()` aus [`formations/common.ts`](../src/lib/formations/common.ts)
aufgebaut.

[`formationRegistry.ts`](../src/lib/formationRegistry.ts) sammelt alle
Definitionen in `RAW_FORMATIONS`, ergänzt formation-spezifische
Standard-Durchfahrzeiten (`DEFAULT_DURATIONS`) und exportiert das Ergebnis als
`FORMATIONS`. Zentrale Funktionen:

- `getFormation(key)` — liefert die `FormationDefinition` einer eingebauten Formation
- `getEffectiveDuration(durationSecondsOverride, key)` — liefert die wirksame
  Durchfahrzeit (Override der Instanz oder Formation-Standard; eigene Formationen
  ohne Override: 0)
- `resolveFormation(placedFormation)` — liefert die zu rendernde Geometrie einer
  platzierten Formation: für eingebaute Formationen die gemeinsame Definition, für
  eigene (`key: "custom"`) den eingefrorenen `customSnapshot`

In der Palette des Streckeneditors sind die Formationen in Gruppen organisiert
(„Start / Ziel“, „Basis“, „Kurven“, „Komplex“ sowie „Individuell“ für eigene
Formationen — siehe `FORMATION_GROUPS` in
[`pages/editor/editorConstants.ts`](../src/pages/editor/editorConstants.ts));
Formationen mit Drehrichtung (Gruppe „Kurven“) können dort über ein Submenü mit
vordefinierter Rotation (0°/90°/180°/270°) eingefügt werden.

Zusätzlich zu den eingebauten Formationen gibt es **eigene Formationen**, die
Nutzer:innen im Formation-Editor anlegen und in der Datenbank speichern — Lebenszyklus,
Freigaben und Berechtigungen siehe [architektur.md](architektur.md#formationen).

## Neue Formation hinzufügen

1. Neues Modul in `lib/formations/` anlegen, das eine `FormationDefinition`
   exportiert (Cone-Layout über `meter()`/`standing()`/`lying()` aus
   `formations/common.ts` aufbauen, dann mit `normalizeCones(...)` abschließen).
2. Den neuen `FormationKey` in [`types.ts`](../src/types.ts) ergänzen.
3. Die Definition in `RAW_FORMATIONS` (`formationRegistry.ts`) registrieren
   und bei Bedarf einen Eintrag in `DEFAULT_DURATIONS` vornehmen.
4. Die Formation einer Gruppe in `FORMATION_GROUPS`
   (`pages/editor/editorConstants.ts`) zuordnen, damit sie in der Palette erscheint.
