// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Server-seitige Obergrenzen der Custom-Formation-RPCs (siehe Migration
// 20260921000001_raise_custom_formation_cone_limit.sql). Nur für die Fehlertexte —
// die Wahrheit liegt weiterhin im Server, der Client erzwingt nichts.
export const MAX_CONES_PER_FORMATION = 100;
export const MAX_ARROWS_PER_FORMATION = 100;
export const MAX_FORMATIONS_PER_USER = 100;

// Übersetzt die von mapError() (lib/api/customFormations.ts) erzeugten Fehlercodes
// in einen für Nutzer verständlichen Satz. Absichtlich immer ein Text — auch für
// unbekannte Fehler —, damit ein Speichern niemals stumm scheitert.
export function describeSaveError(err: unknown): string {
  const code = err instanceof Error ? err.message : String(err ?? "");

  switch (code) {
    case "TOO_MANY_CONES":
      return `Speichern fehlgeschlagen: Ein Hindernis darf höchstens ${MAX_CONES_PER_FORMATION} Pylonen enthalten.`;
    case "TOO_MANY_ARROWS":
      return `Speichern fehlgeschlagen: Ein Hindernis darf höchstens ${MAX_ARROWS_PER_FORMATION} Pfeile enthalten.`;
    case "FORMATION_LIMIT_REACHED":
      return `Speichern fehlgeschlagen: Du hast die maximale Anzahl eigener Hindernisse erreicht (${MAX_FORMATIONS_PER_USER}).`;
    case "PREMIUM_REQUIRED":
      return "Speichern fehlgeschlagen: Eigene Hindernisse erfordern einen Pro-Tarif. Schreib uns: jens(at)polifka.info";
    case "INVALID_NAME":
      return "Speichern fehlgeschlagen: Der Name muss 1–80 Zeichen lang sein.";
    case "INVALID_CATEGORY":
      return "Speichern fehlgeschlagen: Ungültige Kategorie.";
    case "INVALID_LICHTE_BREITE":
      return "Speichern fehlgeschlagen: Die lichte Breite muss größer als 0 und höchstens 20 m sein.";
    case "INVALID_DURATION_SECONDS":
      return "Speichern fehlgeschlagen: Die Dauer muss größer als 0 und höchstens 120 s sein.";
    case "INVALID_DEFAULT_DIRECTION":
      return "Speichern fehlgeschlagen: Ungültige Standard-Fahrtrichtung.";
    case "INVALID_CONE_COORDINATES":
      return "Speichern fehlgeschlagen: Mindestens eine Pylone liegt außerhalb des erlaubten Bereichs (±50 m).";
    case "NOT_AUTHORIZED":
      return "Speichern fehlgeschlagen: Dafür fehlt dir die Berechtigung.";
    case "ACCOUNT_DELETED":
      return "Speichern fehlgeschlagen: Dieses Benutzerkonto wurde gelöscht.";
    default:
      // Unbekannter/technischer Fehler (z. B. Netzwerk, abgelaufene Sitzung, not_authenticated):
      // Original-Text mitgeben, damit er sich melden/debuggen lässt.
      return code
        ? `Speichern fehlgeschlagen: ${code}`
        : "Speichern fehlgeschlagen (unbekannter Fehler). Bitte erneut versuchen.";
  }
}
