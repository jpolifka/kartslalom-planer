// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { describeSaveError, MAX_CONES_PER_FORMATION } from "./saveErrorMessage";

// Stellt sicher, dass jeder Fehlercode aus mapError() einen konkreten Text bekommt
// und unbekannte Fehler nie zu einem leeren String werden (kein stilles Scheitern).
describe("describeSaveError", () => {
  it("TOO_MANY_CONES nennt das Limit", () => {
    expect(describeSaveError(new Error("TOO_MANY_CONES"))).toContain(String(MAX_CONES_PER_FORMATION));
  });

  it.each([
    "TOO_MANY_ARROWS", "FORMATION_LIMIT_REACHED", "PREMIUM_REQUIRED", "INVALID_NAME",
    "INVALID_CATEGORY", "INVALID_LICHTE_BREITE", "INVALID_DURATION_SECONDS",
    "INVALID_DEFAULT_DIRECTION", "INVALID_CONE_COORDINATES", "NOT_AUTHORIZED", "ACCOUNT_DELETED",
  ])("%s → eigener Text", (code) => {
    const msg = describeSaveError(new Error(code));
    expect(msg).toMatch(/^Speichern fehlgeschlagen: /);
    expect(msg).not.toContain(code);
  });

  it("unbekannter Fehler: Original-Text bleibt sichtbar", () => {
    expect(describeSaveError(new Error("not_authenticated"))).toContain("not_authenticated");
  });

  it("Nicht-Error-Werte und leere Meldung ergeben trotzdem einen Text", () => {
    expect(describeSaveError(undefined)).toMatch(/unbekannter Fehler/);
    expect(describeSaveError(new Error(""))).toMatch(/unbekannter Fehler/);
    expect(describeSaveError("boom")).toContain("boom");
  });
});
