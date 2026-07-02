// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Library-Formationen (anon + auth) + Account-Löschung

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createTestUser, loginAsUser, cleanupUsers,
  assertNoError, ts, admin,
} from "./helpers";
import ws from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const supabaseOptions = { realtime: { transport: ws } } as Parameters<typeof createClient>[2];

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...supabaseOptions,
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const BASE_FORMATION = {
  p_name: "Library Test Formation",
  p_description: "Für Library-Tests",
  p_category: "individuell",
  p_cones_json: [{ id: "c1", x: 0, y: 0, kind: "standing", angleDeg: 0 }],
  p_arrows_json: [],
  p_default_direction: null,
  p_lichte_breite: null,
  p_duration_seconds: null,
  p_source_formation_key: null,
  p_source_custom_formation_id: null,
};

// ────────────────────────────────────────────────────────────────
// H5: Anonyme Library-Formationen
// ────────────────────────────────────────────────────────────────
describe("H5: Library-Formationen (anon)", () => {
  let ownerUserId: string;
  let libraryFormationId: string;
  let privateFormationId: string;
  let ownerClient: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];

  beforeAll(async () => {
    const t = ts();
    const owner = await createTestUser(`int-lib-owner-${t}@test.invalid`, "pro");
    userIds.push(owner.id);
    ownerUserId = owner.id;
    ownerClient = await loginAsUser(`int-lib-owner-${t}@test.invalid`);

    // Private Formation erstellen
    const { data: privId, error: privErr } = await ownerClient.rpc("create_custom_formation", BASE_FORMATION);
    assertNoError(privErr, "create private formation");
    privateFormationId = privId as string;

    // Library Formation (via Admin-RPC)
    const { data: libId, error: libErr } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: "Public Library Formation",
    });
    assertNoError(libErr, "create source for library");
    const { data: promotedId, error: promErr } = await ownerClient.rpc("admin_promote_to_library", {
      p_formation_id: libId,
      p_category: "individuell",
    });
    // Admin-RPC könnte Permission-Fehler geben wenn nicht Admin — dann direkt via Service Role
    if (promErr) {
      // Direkte DB-Manipulation via Service Role für Test-Setup
      await admin.from("custom_formations")
        .update({ is_library: true })
        .eq("id", libId as string);
      libraryFormationId = libId as string;
    } else {
      libraryFormationId = promotedId as string;
    }
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("Anon kann get_library_formations aufrufen", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("get_library_formations");
    assertNoError(error, "anon get_library_formations");
    expect(Array.isArray(data)).toBe(true);
  });

  it("Library Formation ist für Anon sichtbar", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("get_library_formations");
    assertNoError(error, "anon get_library_formations");
    const rows = data as Array<{ id: string }>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
  });

  it("Library-Ergebnis enthält kein owner_id (kein Admin-Feld)", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("get_library_formations");
    assertNoError(error, "anon get_library_formations");
    const rows = data as Array<Record<string, unknown>>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
    expect(found!.owner_id).toBeUndefined();
  });

  it("Library-Ergebnis enthält owner_username", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("get_library_formations");
    assertNoError(error, "anon get_library_formations");
    const rows = data as Array<{ id: string; owner_username: string | null }>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
    // username kann null sein, aber das Feld muss vorhanden sein
    expect("owner_username" in found!).toBe(true);
  });

  it("Private Formation ist für Anon NICHT sichtbar (RLS)", async () => {
    const anon = anonClient();
    // Direkter Tabellenlesezugriff — RLS muss blockieren
    const { data, error } = await anon
      .from("custom_formations")
      .select("id")
      .eq("id", privateFormationId);
    // Entweder kein Fehler + leeres Array, oder Permission-Fehler
    if (!error) {
      expect((data ?? []).length).toBe(0);
    }
  });

  it("Authentifizierter Nutzer kann Library Formationen lesen", async () => {
    const { data, error } = await ownerClient.rpc("get_library_formations");
    assertNoError(error, "auth get_library_formations");
    const rows = data as Array<{ id: string }>;
    expect(rows.find((r) => r.id === libraryFormationId)).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────
// H5: Account-Löschung — Library bleibt, Private wird gelöscht
// ────────────────────────────────────────────────────────────────
describe("H5: Account-Löschung", () => {
  let deletedUserId: string;
  let otherUserId: string;
  let libraryFormationId: string;
  let privateFormationId: string;
  let otherClient: Awaited<ReturnType<typeof loginAsUser>>;

  beforeAll(async () => {
    const t = ts();
    const [deletedUser, otherUser] = await Promise.all([
      createTestUser(`int-del-owner-${t}@test.invalid`, "pro"),
      createTestUser(`int-del-other-${t}@test.invalid`, "free"),
    ]);
    deletedUserId = deletedUser.id;
    otherUserId = otherUser.id;

    const ownerClient = await loginAsUser(`int-del-owner-${t}@test.invalid`);
    otherClient = await loginAsUser(`int-del-other-${t}@test.invalid`);

    // Private Formation
    const { data: privId, error: privErr } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: "Private — muss weg nach Löschung",
    });
    assertNoError(privErr, "create private");
    privateFormationId = privId as string;

    // Library Formation via Service Role (setzt is_library=true direkt)
    const { data: libId, error: libErr } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: "Library — muss überleben",
    });
    assertNoError(libErr, "create lib source");
    await admin.from("custom_formations")
      .update({ is_library: true })
      .eq("id", libId as string);
    libraryFormationId = libId as string;

    // Account via Service Role löschen (simuliert delete-account Edge Function)
    // 1. Non-library formations löschen
    await admin.from("custom_formations")
      .delete()
      .eq("owner_id", deletedUserId)
      .eq("is_library", false);

    // 2. User löschen (ON DELETE SET NULL für library, CASCADE für rest)
    await admin.auth.admin.deleteUser(deletedUserId);
  });

  afterAll(async () => {
    // deletedUserId bereits gelöscht
    await cleanupUsers([otherUserId]);
  });

  it("Library Formation überlebt die Account-Löschung", async () => {
    const { data, error } = await admin
      .from("custom_formations")
      .select("id, is_library, owner_id")
      .eq("id", libraryFormationId)
      .maybeSingle();
    assertNoError(error, "check library after deletion");
    expect(data).not.toBeNull();
    expect(data!.is_library).toBe(true);
  });

  it("Library Formation hat nach Löschung owner_id = null", async () => {
    const { data, error } = await admin
      .from("custom_formations")
      .select("owner_id")
      .eq("id", libraryFormationId)
      .maybeSingle();
    assertNoError(error, "check library owner_id");
    expect(data!.owner_id).toBeNull();
  });

  it("Library Formation zeigt [gelöschter Nutzer] via get_library_formations", async () => {
    const { data, error } = await otherClient.rpc("get_library_formations");
    assertNoError(error, "get_library_formations after deletion");
    const rows = data as Array<{ id: string; owner_username: string | null }>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
    expect(found!.owner_username).toBeNull();
  });

  it("Private Formation ist nach Account-Löschung weg", async () => {
    const { data, error } = await admin
      .from("custom_formations")
      .select("id")
      .eq("id", privateFormationId)
      .maybeSingle();
    assertNoError(error, "check private after deletion");
    expect(data).toBeNull();
  });

  it("Dritter Nutzer kann Library Formation aus Palette laden", async () => {
    const { data, error } = await otherClient.rpc("get_library_formations");
    assertNoError(error, "other client library");
    const rows = data as Array<{ id: string; cones_json: unknown }>;
    const found = rows.find((r) => r.id === libraryFormationId);
    expect(found).toBeDefined();
    expect(Array.isArray(found!.cones_json)).toBe(true);
  });
});
