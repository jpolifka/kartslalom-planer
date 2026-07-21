// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: RLS-Isolation — User A kann Daten von User B nicht lesen oder schreiben.
//
// Wichtigster Sicherheitstest in diesem Verzeichnis: prüft, dass die
// Row-Level-Security-Policies auf `tracks` (und die Versions-RPCs) wirklich
// jeden Fremdzugriff verhindern — nicht nur "die App zeigt es nicht an",
// sondern auf DB-Ebene, sodass auch ein manipulierter Client (eigener
// API-Call statt UI) nicht durchkommt. Jeder Testfall unten kommentiert
// konkret, welches Datenleck bzw. welche unautorisierte Schreiboperation er
// ausschließt, wenn er grün ist.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers, anon,
  assertNoError, assertRpcError, ts,
} from "./helpers";

describe("RLS isolation (Tracks)", () => {
  let clientA: Awaited<ReturnType<typeof loginAsUser>>;
  let clientB: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackAId: string;

  beforeAll(async () => {
    const t = ts();
    const [userA, userB] = await Promise.all([
      createTestUser(`int-rls-a-${t}@test.invalid`),
      createTestUser(`int-rls-b-${t}@test.invalid`),
    ]);
    userIds.push(userA.id, userB.id);
    [clientA, clientB] = await Promise.all([
      loginAsUser(`int-rls-a-${t}@test.invalid`),
      loginAsUser(`int-rls-b-${t}@test.invalid`),
    ]);

    const { data, error } = await clientA.rpc("create_track", { track_name: "User-A Track" });
    assertNoError(error, "create_track A");
    trackAId = data as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("User A sieht eigenen Track", async () => {
    // Kontrollfall: stellt sicher, dass die Policy nicht versehentlich ALLE
    // Zugriffe blockiert (was die nachfolgenden "B sieht nichts"-Tests
    // trivial grün machen würde, ohne echte Isolation zu belegen).
    const { data, error } = await clientA.from("tracks").select("id").eq("id", trackAId);
    assertNoError(error, "A sieht eigenen Track");
    expect(data).toHaveLength(1);
  });

  it("User B sieht Track von User A nicht", async () => {
    // Verhindert horizontalen Datenzugriff über die Tabelle: ohne diese
    // Policy könnte jeder eingeloggte Nutzer per SELECT auf tracks fremde
    // Streckenpläne (inkl. state_json mit Pylonenlayout) mitlesen.
    const { data, error } = await clientB.from("tracks").select("id").eq("id", trackAId);
    assertNoError(error, "B liest Tracks");
    expect(data).toHaveLength(0);
  });

  it("User B kann nicht via save_track auf Track von A schreiben", async () => {
    // Verhindert, dass ein fremder Nutzer über die RPC (statt direktes
    // Tabellen-UPDATE) den Inhalt/State eines Tracks überschreibt, den er
    // nicht besitzt — die Ownership-Prüfung muss auch serverseitig in der
    // Funktion sitzen, nicht nur in RLS auf der Tabelle.
    const { error } = await clientB.rpc("save_track", {
      p_track_id:   trackAId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_map_provider_id: "osm",
      p_opacity:    0.5,
    });
    assertRpcError(error, "not_owner", "B save auf Track A");
  });

  it("User B kann Track von A nicht direkt löschen", async () => {
    // Verhindert destruktiven Fremdzugriff: ein DELETE auf eine fremde Zeile
    // darf nicht "leise" durchgehen. Die Policy filtert die Zeile für B
    // schlicht aus dem UPDATE/DELETE-Target heraus (0 rows affected, kein
    // Error) — deshalb wird hier zusätzlich verifiziert, dass der Track aus
    // Sicht von A tatsächlich noch existiert, statt nur auf "kein Fehler" zu
    // vertrauen.
    const { error } = await clientB.from("tracks").delete().eq("id", trackAId);
    assertNoError(error, "B delete Track A (RLS silent)");
    // Track muss noch existieren für User A
    const { data } = await clientA.from("tracks").select("id").eq("id", trackAId);
    expect(data).toHaveLength(1);
  });

  it("direktes INSERT auf tracks ist gesperrt", async () => {
    // Verhindert, dass ein Nutzer sich per direktem INSERT einen Track mit
    // beliebigem owner_id unterschiebt (z. B. sich selbst als Owner eines
    // Tracks einträgt, das eigentlich nur über create_track mit serverseitig
    // gesetztem owner_id = auth.uid() entstehen darf).
    const { error } = await clientA
      .from("tracks")
      .insert({ name: "Direct Insert", owner_id: userIds[0] });
    expect(error).not.toBeNull();
  });
});

// Verhindert, dass ein komplett unauthentifizierter Client (kein Login, nur
// der öffentliche anon-Key) irgendeine der Versionshistorie-RPCs überhaupt
// aufrufen kann — unabhängig davon, ob die übergebene ID real existiert.
// Das ist die äußerste Verteidigungslinie vor RLS: fehlt hier das GRANT für
// die Rolle "anon", würde jeder Aufruf schon an der Postgres-Berechtigung
// scheitern, bevor überhaupt eine Owner-Prüfung greifen könnte. Eine
// zufällige/geratene dummyId ist hier bewusst irrelevant für den Testzweck —
// es geht nicht um "Datensatz nicht gefunden", sondern um "Rolle darf
// Funktion gar nicht ausführen".
describe("Versions-RPCs — Anon-Zugriff verweigert (permission denied)", () => {
  const dummyId = "00000000-0000-0000-0000-000000000000";

  it("save_track ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("save_track", {
      p_track_id: dummyId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_map_provider_id: "osm",
      p_opacity: 0.5,
    });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });

  it("create_track_version ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("create_track_version", { p_track_id: dummyId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });

  it("get_track_versions ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("get_track_versions", { p_track_id: dummyId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });

  it("get_track_version_detail ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("get_track_version_detail", { p_version_id: dummyId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });

  it("restore_track_version ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("restore_track_version", { p_version_id: dummyId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });

  it("delete_track_version ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("delete_track_version", { p_version_id: dummyId });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });

  it("create_track_from_version ist für Anon nicht ausführbar", async () => {
    const { error } = await anon.rpc("create_track_from_version", { p_version_id: dummyId, p_name: "x" });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("permission denied");
  });
});
