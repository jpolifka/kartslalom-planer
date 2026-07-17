// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: RPC-Berechtigungen — anon darf ausschließlich die bewusst
// öffentlichen RPCs ausführen (Red-Team-Review 2026-07-13, 2. Runde).
//
// Einzelne Stichproben (wie im Security-Smoke-Test) reichen nicht aus, um
// sicherzustellen, dass keine der ~37 Funktionen in `public` versehentlich
// für `anon` erreichbar ist — insbesondere nicht für künftig neue Funktionen.
// Dieser Test enumeriert deshalb ALLE Funktionen dynamisch über
// debug_list_function_grants() (service_role-only, siehe
// 20260713000005_debug_function_grants_introspection.sql) statt eine feste
// Liste zu pflegen.

import { describe, it, expect } from "vitest";
import { admin, anon, assertNoError } from "./helpers";

// Einzige RPCs, die bewusst öffentlich (anon + authenticated) sind — siehe
// docs/track-share-links.md bzw. get_library_formations()-Kommentar.
const INTENTIONALLY_PUBLIC = new Set(["get_library_formations", "get_track_by_share_token"]);

// debug_list_function_grants() selbst ist reine Test-Introspektion, bewusst
// nur für service_role (nicht mal authenticated) -- siehe
// 20260713000005_debug_function_grants_introspection.sql.
const TEST_ONLY_FUNCTIONS = new Set(["debug_list_function_grants"]);

describe("RPC-Grants: anon darf nur bewusst öffentliche RPCs ausführen", () => {
  it("debug_list_function_grants() zeigt anon_can_execute=true nur für die zwei bewusst öffentlichen RPCs", async () => {
    const { data, error } = await admin.rpc("debug_list_function_grants");
    assertNoError(error, "debug_list_function_grants");
    const rows = data as { function_name: string; anon_can_execute: boolean; authenticated_can_execute: boolean }[];

    expect(rows.length).toBeGreaterThan(30); // Sanity: Katalog-Abfrage lief wirklich über alle Funktionen

    const anonAllowed = rows.filter((r) => r.anon_can_execute).map((r) => r.function_name).sort();
    expect(anonAllowed).toEqual([...INTENTIONALLY_PUBLIC].sort());

    // Jede App-RPC muss weiterhin für eingeloggte Nutzer funktionieren — die
    // Härtung darf nicht versehentlich authenticated mit-entzogen haben.
    // (debug_list_function_grants selbst ausgenommen, siehe TEST_ONLY_FUNCTIONS.)
    const authenticatedBlocked = rows
      .filter((r) => !TEST_ONLY_FUNCTIONS.has(r.function_name))
      .filter((r) => !r.authenticated_can_execute);
    expect(authenticatedBlocked).toEqual([]);
  });

  it("anon kann eine bewusst öffentliche RPC tatsächlich aufrufen (get_library_formations)", async () => {
    const { error } = await anon.rpc("get_library_formations");
    assertNoError(error, "anon get_library_formations");
  });

  // Blockiert wird auf zwei möglichen Ebenen, je nachdem wie PostgREST die
  // Funktion für die Rolle "anon" in seinem Schema-Cache sieht: entweder
  // Postgres selbst verweigert die Ausführung (42501 = insufficient_privilege),
  // oder PostgREST listet die Funktion für anon erst gar nicht als aufrufbar
  // (PGRST202 = "function not found" aus Sicht der Rolle). Beides ist ein
  // korrektes "anon kommt nicht durch" -- welcher der beiden Fälle greift,
  // ist ein PostgREST-Implementierungsdetail, kein Sicherheitsunterschied.
  const ACCESS_DENIED_CODES = new Set(["42501", "PGRST202"]);

  it("anon bekommt einen Berechtigungsfehler bei einer nicht-öffentlichen RPC (create_track)", async () => {
    const { error } = await anon.rpc("create_track", { track_name: "sollte nie erstellt werden" });
    expect(error).not.toBeNull();
    expect(ACCESS_DENIED_CODES.has(error!.code)).toBe(true);
  });

  it("anon bekommt einen Berechtigungsfehler bei einer Admin-RPC (admin_delete_track)", async () => {
    const { error } = await anon.rpc("admin_delete_track", { p_track_id: "00000000-0000-0000-0000-000000000000" });
    expect(error).not.toBeNull();
    expect(ACCESS_DENIED_CODES.has(error!.code)).toBe(true);
  });
});
