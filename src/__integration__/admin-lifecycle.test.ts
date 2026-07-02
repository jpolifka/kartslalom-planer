// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: H4 Admin-Lifecycle — Rollenprüfung, CRUD, Paginierung

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers,
  assertNoError, assertRpcError, ts, admin,
} from "./helpers";

const BASE_FORMATION = {
  p_name: "Admin Test Formation",
  p_description: "Für Admin-Tests",
  p_category: "individuell",
  p_cones_json: [{ id: "c1", x: 0, y: 0, kind: "standing", angleDeg: 0 }],
  p_arrows_json: [],
  p_default_direction: null,
  p_lichte_breite: null,
  p_duration_seconds: null,
  p_source_formation_key: null,
  p_source_custom_formation_id: null,
};

describe("H4: Admin-Lifecycle", () => {
  let adminUserId: string;
  let normalUserId: string;
  let adminClient: Awaited<ReturnType<typeof loginAsUser>>;
  let normalClient: Awaited<ReturnType<typeof loginAsUser>>;
  let formationId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    const t = ts();
    const [adminUser, normalUser] = await Promise.all([
      createTestUser(`int-admin-a-${t}@test.invalid`, "free"),
      createTestUser(`int-admin-normal-${t}@test.invalid`, "free"),
    ]);
    adminUserId = adminUser.id;
    normalUserId = normalUser.id;
    userIds.push(adminUserId, normalUserId);

    // Admin-Rolle direkt per Service Role setzen
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUserId);

    [adminClient, normalClient] = await Promise.all([
      loginAsUser(`int-admin-a-${t}@test.invalid`),
      loginAsUser(`int-admin-normal-${t}@test.invalid`),
    ]);

    // Formation als normaler Nutzer erstellen (Testdaten für Admin-Operationen)
    const { data: fId, error } = await normalClient.rpc("create_custom_formation", BASE_FORMATION);
    assertNoError(error, "create test formation");
    formationId = fId as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  // ─── is_current_user_admin ───

  it("is_current_user_admin gibt true für Admin zurück", async () => {
    const { data, error } = await adminClient.rpc("is_current_user_admin");
    assertNoError(error, "is_current_user_admin admin");
    expect(data).toBe(true);
  });

  it("is_current_user_admin gibt false für normalen Nutzer zurück", async () => {
    const { data, error } = await normalClient.rpc("is_current_user_admin");
    assertNoError(error, "is_current_user_admin normal");
    expect(data).toBe(false);
  });

  // ─── admin_list_custom_formations ───

  it("Nicht-Admin erhält keine Daten von admin_list_custom_formations", async () => {
    const { data, error } = await normalClient.rpc("admin_list_custom_formations", {
      p_status: null, p_category: null, p_limit: 10, p_offset: 0,
    });
    // Entweder Fehler oder leeres Array (EXISTS-Subquery gibt false → WHERE false → 0 Zeilen)
    if (error) {
      // ältere Versionen warfen 'not_authorized'
      expect(error.message).toContain("not_authorized");
    } else {
      // language sql gibt einfach 0 Zeilen zurück
      expect((data as unknown[]).length).toBe(0);
    }
  });

  it("Admin kann admin_list_custom_formations aufrufen", async () => {
    const { data, error } = await adminClient.rpc("admin_list_custom_formations", {
      p_status: null, p_category: null, p_limit: 100, p_offset: 0,
    });
    assertNoError(error, "admin_list_custom_formations");
    expect(Array.isArray(data)).toBe(true);
    const rows = data as Array<{ id: string }>;
    expect(rows.some((r) => r.id === formationId)).toBe(true);
  });

  it("Statusfilter liefert nur Formationen mit passendem Status", async () => {
    const { data, error } = await adminClient.rpc("admin_list_custom_formations", {
      p_status: "submitted", p_category: null, p_limit: 100, p_offset: 0,
    });
    assertNoError(error, "admin_list_custom_formations status filter");
    const rows = data as Array<{ status: string }>;
    expect(rows.every((r) => r.status === "submitted")).toBe(true);
  });

  it("Kategoriefilter liefert nur Formationen der gewählten Kategorie", async () => {
    const { data, error } = await adminClient.rpc("admin_list_custom_formations", {
      p_status: null, p_category: "individuell", p_limit: 100, p_offset: 0,
    });
    assertNoError(error, "admin_list_custom_formations category filter");
    const rows = data as Array<{ category: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.category === "individuell")).toBe(true);
  });

  it("p_offset liefert eine andere Teilmenge (Paginierung)", async () => {
    const { data: page1 } = await adminClient.rpc("admin_list_custom_formations", {
      p_status: null, p_category: null, p_limit: 1, p_offset: 0,
    });
    const { data: page2 } = await adminClient.rpc("admin_list_custom_formations", {
      p_status: null, p_category: null, p_limit: 1, p_offset: 1,
    });
    const p1 = (page1 as Array<{ id: string }>);
    const p2 = (page2 as Array<{ id: string }>);
    // Seite 2 darf nicht identisch mit Seite 1 sein
    if (p1.length > 0 && p2.length > 0) {
      expect(p1[0].id).not.toBe(p2[0].id);
    }
  });

  it("admin_list_custom_formations liefert owner_email", async () => {
    const { data, error } = await adminClient.rpc("admin_list_custom_formations", {
      p_status: null, p_category: null, p_limit: 100, p_offset: 0,
    });
    assertNoError(error, "admin list owner_email");
    const rows = data as Array<{ id: string; owner_email: string | null }>;
    const found = rows.find((r) => r.id === formationId);
    expect(found).toBeDefined();
    expect(found!.owner_email).toBeTruthy();
  });

  // ─── admin_promote_to_library ───

  it("admin_promote_to_library erstellt Library-Kopie, Original bleibt unverändert", async () => {
    const { data: newId, error } = await adminClient.rpc("admin_promote_to_library", {
      p_formation_id: formationId,
      p_category: "basis",
    });
    assertNoError(error, "admin_promote_to_library");
    expect(typeof newId).toBe("string");
    expect(newId).not.toBe(formationId);

    // Original noch vorhanden
    const { data: orig } = await admin.from("custom_formations")
      .select("id, is_library")
      .eq("id", formationId)
      .maybeSingle();
    expect(orig).not.toBeNull();
    expect(orig!.is_library).toBe(false);

    // Kopie ist Library-Formation
    const { data: copy } = await admin.from("custom_formations")
      .select("id, is_library, category")
      .eq("id", newId as string)
      .maybeSingle();
    expect(copy).not.toBeNull();
    expect(copy!.is_library).toBe(true);
    expect(copy!.category).toBe("basis");
  });

  // ─── admin_delete_custom_formation ───

  it("admin_delete_custom_formation entfernt die richtige Formation", async () => {
    // Eigene Formation für den Löschtest erstellen
    const { data: delId } = await normalClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: "Zu löschen",
    });
    expect(delId).toBeTruthy();

    const { error } = await adminClient.rpc("admin_delete_custom_formation", { p_id: delId });
    assertNoError(error, "admin_delete_custom_formation");

    const { data: check } = await admin.from("custom_formations")
      .select("id")
      .eq("id", delId as string)
      .maybeSingle();
    expect(check).toBeNull();
  });

  // ─── admin_update_custom_formation: Audit-Felder ───

  it("admin_update_custom_formation setzt edited_by_admin_id und _at", async () => {
    const { error } = await adminClient.rpc("admin_update_custom_formation", {
      p_id: formationId,
      p_name: "Admin-bearbeitet",
      p_description: null,
      p_category: "individuell",
      p_cones_json: [{ id: "c1", x: 0, y: 0, kind: "standing", angleDeg: 0 }],
      p_arrows_json: [],
      p_default_direction: null,
      p_lichte_breite: null,
      p_duration_seconds: null,
    });
    assertNoError(error, "admin_update_custom_formation");

    const { data } = await admin.from("custom_formations")
      .select("name, edited_by_admin_id, edited_by_admin_at")
      .eq("id", formationId)
      .maybeSingle();
    expect(data!.name).toBe("Admin-bearbeitet");
    expect(data!.edited_by_admin_id).toBe(adminUserId);
    expect(data!.edited_by_admin_at).not.toBeNull();
  });

  // ─── Nicht-Admin-Blockaden ───

  it("Nicht-Admin: admin_delete_custom_formation schlägt fehl", async () => {
    const { error } = await normalClient.rpc("admin_delete_custom_formation", { p_id: formationId });
    assertRpcError(error, "not_authorized", "non-admin delete");
  });

  it("Nicht-Admin: admin_promote_to_library schlägt fehl", async () => {
    const { error } = await normalClient.rpc("admin_promote_to_library", {
      p_formation_id: formationId,
      p_category: "basis",
    });
    assertRpcError(error, "not_authorized", "non-admin promote");
  });
});
