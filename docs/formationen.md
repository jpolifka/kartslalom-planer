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
Standard-Durchfahrzeiten (`DEFAULT_DURATIONS`) und stellt zwei zentrale
Funktionen bereit:

- `getFormation(key)` — liefert die `FormationDefinition` zu einem `FormationKey`
- `getEffectiveDuration(durationSecondsOverride, key)` — liefert die wirksame
  Durchfahrzeit (Override der Instanz oder Formation-Standard)

In der Toolbox der App sind die Formationen zusätzlich in Gruppen
(„Start/Ziel“, „Basis“, „Kurven“, „Komplex“ — siehe `FORMATION_GROUPS` in
[App.tsx](../src/App.tsx)) organisiert; Formationen mit Drehrichtung können
dort über ein Submenü mit vordefinierter Rotation (0°/90°/180°/270°)
eingefügt werden.

## Neue Formation hinzufügen

1. Neues Modul in `lib/formations/` anlegen, das eine `FormationDefinition`
   exportiert (Cone-Layout über `meter()`/`standing()`/`lying()` aus
   `formations/common.ts` aufbauen, dann mit `normalizeCones(...)` abschließen).
2. Den neuen `FormationKey` in [`types.ts`](../src/types.ts) ergänzen.
3. Die Definition in `RAW_FORMATIONS` (`formationRegistry.ts`) registrieren
   und bei Bedarf einen Eintrag in `DEFAULT_DURATIONS` vornehmen.
4. Die Formation einer Gruppe in `FORMATION_GROUPS` (`App.tsx`) zuordnen,
   damit sie in der Palette erscheint.
