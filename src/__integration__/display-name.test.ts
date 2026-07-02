// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: set_display_name RPC + Sichtbarkeit in get_library_formations

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers,
  assertNoError, assertRpcError, ts, admin,
} from "./helpers";

describe("H5: display_name — set_display_name + Attribution", () => {
  let userId: string;
  let userClient: Awaited<ReturnType<typeof loginAsUser>>;
  let libraryFormationId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    const t = ts();
    const user = await createTestUser(`int-dn-${t}@test.invalid`, "free");
    userId = user.id;
    userIds.push(userId);
    userClient = await loginAsUser(`int-dn-${t}@test.invalid`);

    // Library-Formation via Service Role für Sichtbarkeitstest
    const { data: fId, error: fErr } = await userClient.rpc("create_custom_formation", {
      p_name: "DN-Test Formation",
      p_description: null,
      p_category: "individuell",
      p_cones_json: [{ id: "c1", x: 0, y: 0, kind: "standing", angleDeg: 0 }],
      p_arrows_json: [],
      p_default_direction: null,
      p_lichte_breite: null,
      p_duration_seconds: null,
      p_source_formation_key: null,
      p_source_custom_formation_id: null,
    });
    assertNoError(fErr, "create formation");
    await admin.from("custom_formations").update({ is_library: true }).eq("id", fId as string);
    libraryFormationId = fId as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("set_display_name setzt Anzeigenamen erfolgreich", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "Ralf M." });
    assertNoError(error, "set_display_name");

    const { data } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    expect(data!.display_name).toBe("Ralf M.");
  });

  it("set_display_name trimmt Leerzeichen", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "  Trimmed  " });
    assertNoError(error, "set_display_name trim");

    const { data } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    expect(data!.display_name).toBe("Trimmed");
  });

  it("set_display_name mit leerem String setzt NULL (anonym)", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "" });
    assertNoError(error, "set_display_name clear");

    const { data } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    expect(data!.display_name).toBeNull();
  });

  it("set_display_name mit null setzt NULL", async () => {
    // Zuerst setzen
    await userClient.rpc("set_display_name", { p_display_name: "Gesetzt" });
    // Dann löschen
    const { error } = await userClient.rpc("set_display_name", { p_display_name: null });
    assertNoError(error, "set_display_name null");

    const { data } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    expect(data!.display_name).toBeNull();
  });

  it("set_display_name: 1 Zeichen wird abgelehnt (< 2)", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "X" });
    assertRpcError(error, "invalid_display_name", "set_display_name 1 char");
  });

  it("set_display_name: 41 Zeichen wird abgelehnt (> 40)", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "A".repeat(41) });
    assertRpcError(error, "invalid_display_name", "set_display_name 41 chars");
  });

  it("set_display_name: genau 2 Zeichen ist gültig", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "AB" });
    assertNoError(error, "set_display_name 2 chars");
  });

  it("set_display_name: genau 40 Zeichen ist gültig", async () => {
    const { error } = await userClient.rpc("set_display_name", { p_display_name: "A".repeat(40) });
    assertNoError(error, "set_display_name 40 chars");
  });

  it("display_name erscheint in get_library_formations", async () => {
    await userClient.rpc("set_display_name", { p_display_name: "Sichtbarer Name" });

    const { data, error } = await userClient.rpc("get_library_formations");
    assertNoError(error, "get_library_formations");
    const rows = data as Array<{ id: string; display_name: string | null }>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
    expect(found!.display_name).toBe("Sichtbarer Name");
  });

  it("display_name NULL ergibt null in get_library_formations (Community-Formation)", async () => {
    await userClient.rpc("set_display_name", { p_display_name: null });

    const { data, error } = await userClient.rpc("get_library_formations");
    assertNoError(error, "get_library_formations");
    const rows = data as Array<{ id: string; display_name: string | null }>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
    expect(found!.display_name).toBeNull();
  });
});
