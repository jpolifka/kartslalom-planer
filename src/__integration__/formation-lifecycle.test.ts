// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Custom-Formation-Lifecycle + Payload-Validierung.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers,
  assertNoError, assertRpcError, ts,
} from "./helpers";

const BASE_FORMATION = {
  p_name: "Test Formation",
  p_description: null,
  p_category: "individuell",
  p_cones_json: [{ id: "c1", x: 0, y: 0, kind: "standing", angleDeg: 0 }],
  p_arrows_json: [],
  p_default_direction: null,
  p_lichte_breite: null,
  p_duration_seconds: null,
  p_source_formation_key: null,
  p_source_custom_formation_id: null,
};

describe("Formation lifecycle", () => {
  let clientA: Awaited<ReturnType<typeof loginAsUser>>;
  let clientB: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let formationId: string;

  beforeAll(async () => {
    const t = ts();
    const [userA, userB] = await Promise.all([
      createTestUser(`int-form-a-${t}@test.invalid`),
      createTestUser(`int-form-b-${t}@test.invalid`),
    ]);
    userIds.push(userA.id, userB.id);
    [clientA, clientB] = await Promise.all([
      loginAsUser(`int-form-a-${t}@test.invalid`),
      loginAsUser(`int-form-b-${t}@test.invalid`),
    ]);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("create_custom_formation gibt UUID zurück", async () => {
    const { data, error } = await clientA.rpc("create_custom_formation", BASE_FORMATION);
    assertNoError(error, "create_custom_formation");
    expect(data).toMatch(/^[0-9a-f-]{36}$/);
    formationId = data as string;
  });

  it("Formation ist für Owner sichtbar", async () => {
    const { data, error } = await clientA
      .from("custom_formations")
      .select("id, name, category")
      .eq("id", formationId);
    assertNoError(error, "select eigene Formation");
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe("Test Formation");
  });

  it("User B sieht Formation von User A nicht (RLS)", async () => {
    const { data, error } = await clientB
      .from("custom_formations")
      .select("id")
      .eq("id", formationId);
    assertNoError(error, "B liest Formationen");
    expect(data).toHaveLength(0);
  });

  it("direktes INSERT auf custom_formations ist gesperrt", async () => {
    const { error } = await clientA
      .from("custom_formations")
      .insert({ name: "Direct", cones_json: [], arrows_json: [] });
    expect(error).not.toBeNull();
  });

  it("update_custom_formation ändert Name und Kategorie", async () => {
    const { error } = await clientA.rpc("update_custom_formation", {
      p_id: formationId,
      p_name: "Geänderte Formation",
      p_description: "Beschreibung",
      p_category: "kurven",
      p_cones_json: BASE_FORMATION.p_cones_json,
      p_arrows_json: [],
      p_default_direction: "cw",
      p_lichte_breite: 1.65,
      p_duration_seconds: 30,
    });
    assertNoError(error, "update_custom_formation");

    const { data } = await clientA
      .from("custom_formations")
      .select("name, category, lichte_breite, duration_seconds")
      .eq("id", formationId)
      .single();
    expect(data!.name).toBe("Geänderte Formation");
    expect(data!.category).toBe("kurven");
    expect(Number(data!.lichte_breite)).toBeCloseTo(1.65);
    expect(Number(data!.duration_seconds)).toBe(30);
  });

  it("User B kann update_custom_formation nicht aufrufen (nicht Owner)", async () => {
    const { error } = await clientB.rpc("update_custom_formation", {
      p_id: formationId,
      p_name: "Hack",
      p_description: null,
      p_category: "individuell",
      p_cones_json: [],
      p_arrows_json: [],
      p_default_direction: null,
      p_lichte_breite: null,
      p_duration_seconds: null,
    });
    assertRpcError(error, "not_authorized", "B update Formation A");
  });

  it("delete_custom_formation entfernt die Formation", async () => {
    const { error } = await clientA.rpc("delete_custom_formation", { p_id: formationId });
    assertNoError(error, "delete_custom_formation");

    const { data } = await clientA
      .from("custom_formations")
      .select("id")
      .eq("id", formationId);
    expect(data).toHaveLength(0);
  });
});

// Szenario: A erstellt Formation → teilt "view" mit B → B kann duplizieren aber nicht editieren
// → A upgraded auf "edit" → B kann editieren → A widerruft → B verliert Zugriff.
describe("H3 Formation Sharing", () => {
  let clientA: Awaited<ReturnType<typeof loginAsUser>>;
  let clientB: Awaited<ReturnType<typeof loginAsUser>>;
  let clientC: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let userAId: string;
  let userBId: string;
  let formationId: string;
  let duplicatedId: string;

  beforeAll(async () => {
    const t = ts();
    const [userA, userB, userC] = await Promise.all([
      createTestUser(`int-share-a-${t}@test.invalid`),
      createTestUser(`int-share-b-${t}@test.invalid`),
      createTestUser(`int-share-c-${t}@test.invalid`),
    ]);
    userIds.push(userA.id, userB.id, userC.id);
    userAId = userA.id;
    userBId = userB.id;
    [clientA, clientB, clientC] = await Promise.all([
      loginAsUser(`int-share-a-${t}@test.invalid`),
      loginAsUser(`int-share-b-${t}@test.invalid`),
      loginAsUser(`int-share-c-${t}@test.invalid`),
    ]);
    const { data } = await clientA.rpc("create_custom_formation", BASE_FORMATION);
    formationId = data as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  // --- Vorzustand ---

  it("get_my_formation_permission: A = 'owner', B = null vor Share", async () => {
    const [{ data: permA }, { data: permB }] = await Promise.all([
      clientA.rpc("get_my_formation_permission", { p_id: formationId }),
      clientB.rpc("get_my_formation_permission", { p_id: formationId }),
    ]);
    expect(permA).toBe("owner");
    expect(permB).toBeNull();
  });

  it("A kann nicht mit sich selbst teilen (cannot_share_with_self)", async () => {
    const { error } = await clientA.rpc("share_custom_formation", {
      p_formation_id: formationId,
      p_target_id:    userAId,
      p_permission:   "view",
    });
    assertRpcError(error, "cannot_share_with_self", "share mit sich selbst");
  });

  // --- View-Share ---

  it("A teilt Formation mit B als 'view'", async () => {
    const { error } = await clientA.rpc("share_custom_formation", {
      p_formation_id: formationId,
      p_target_id:    userBId,
      p_permission:   "view",
    });
    assertNoError(error, "share view mit B");
  });

  it("get_formation_shares zeigt B mit permission='view'", async () => {
    const { data, error } = await clientA.rpc("get_formation_shares", { p_formation_id: formationId });
    assertNoError(error, "get_formation_shares");
    const shares = data as Array<{ shared_with_id: string; permission: string }>;
    const entry = shares.find((s) => s.shared_with_id === userBId);
    expect(entry).toBeDefined();
    expect(entry!.permission).toBe("view");
  });

  it("B sieht Formation in get_shared_formations() mit permission='view'", async () => {
    const { data, error } = await clientB.rpc("get_shared_formations");
    assertNoError(error, "get_shared_formations");
    const found = (data as Array<{ id: string; permission: string }>).find((f) => f.id === formationId);
    expect(found).toBeDefined();
    expect(found!.permission).toBe("view");
  });

  it("get_my_formation_permission: B = 'view'", async () => {
    const { data } = await clientB.rpc("get_my_formation_permission", { p_id: formationId });
    expect(data).toBe("view");
  });

  it("C (kein Share) sieht Formation nicht in get_shared_formations()", async () => {
    const { data } = await clientC.rpc("get_shared_formations");
    const found = (data as Array<{ id: string }>).find((f) => f.id === formationId);
    expect(found).toBeUndefined();
  });

  it("B (view) kann duplizieren — eigene Kopie entsteht", async () => {
    const { data, error } = await clientB.rpc("duplicate_custom_formation", { p_source_id: formationId });
    assertNoError(error, "duplicate_custom_formation");
    expect(data).toMatch(/^[0-9a-f-]{36}$/);
    duplicatedId = data as string;
  });

  it("B (view) kann update_custom_formation NICHT aufrufen (not_authorized)", async () => {
    const { error } = await clientB.rpc("update_custom_formation", {
      p_id:               formationId,
      p_name:             "Hack",
      p_description:      null,
      p_category:         "individuell",
      p_cones_json:       BASE_FORMATION.p_cones_json,
      p_arrows_json:      [],
      p_default_direction: null,
      p_lichte_breite:    null,
      p_duration_seconds: null,
    });
    assertRpcError(error, "not_authorized", "B update mit view-Share");
  });

  // --- Upgrade auf Edit ---

  it("A wechselt B-Permission auf 'edit'", async () => {
    const { error } = await clientA.rpc("share_custom_formation", {
      p_formation_id: formationId,
      p_target_id:    userBId,
      p_permission:   "edit",
    });
    assertNoError(error, "Permission-Upgrade auf edit");
  });

  it("get_my_formation_permission: B = 'edit' nach Upgrade", async () => {
    const { data } = await clientB.rpc("get_my_formation_permission", { p_id: formationId });
    expect(data).toBe("edit");
  });

  it("B (edit) kann update_custom_formation erfolgreich aufrufen", async () => {
    const { error } = await clientB.rpc("update_custom_formation", {
      p_id:               formationId,
      p_name:             "Von B bearbeitet",
      p_description:      null,
      p_category:         "individuell",
      p_cones_json:       BASE_FORMATION.p_cones_json,
      p_arrows_json:      [],
      p_default_direction: null,
      p_lichte_breite:    null,
      p_duration_seconds: null,
    });
    assertNoError(error, "B update mit edit-Share");
  });

  // --- Unshare ---

  it("A widerruft Share für B (unshare_custom_formation)", async () => {
    const { error } = await clientA.rpc("unshare_custom_formation", {
      p_formation_id: formationId,
      p_target_id:    userBId,
    });
    assertNoError(error, "unshare_custom_formation");
  });

  it("get_my_formation_permission: B = null nach Unshare", async () => {
    const { data } = await clientB.rpc("get_my_formation_permission", { p_id: formationId });
    expect(data).toBeNull();
  });

  it("B sieht Formation nicht mehr in get_shared_formations() nach Unshare", async () => {
    const { data } = await clientB.rpc("get_shared_formations");
    const found = (data as Array<{ id: string }>).find((f) => f.id === formationId);
    expect(found).toBeUndefined();
  });

  it("B kann update_custom_formation nach Unshare nicht mehr aufrufen (not_authorized)", async () => {
    const { error } = await clientB.rpc("update_custom_formation", {
      p_id:               formationId,
      p_name:             "Versuch nach Unshare",
      p_description:      null,
      p_category:         "individuell",
      p_cones_json:       BASE_FORMATION.p_cones_json,
      p_arrows_json:      [],
      p_default_direction: null,
      p_lichte_breite:    null,
      p_duration_seconds: null,
    });
    assertRpcError(error, "not_authorized", "B update nach Unshare");
  });

  it("Bs Duplikat bleibt nach Unshare erhalten (eigene Formation)", async () => {
    const { data } = await clientB
      .from("custom_formations")
      .select("id, name")
      .eq("id", duplicatedId);
    expect(data).toHaveLength(1);
  });
});

describe("Formation payload validation", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];

  beforeAll(async () => {
    const email = `int-payload-${ts()}@test.invalid`;
    const user = await createTestUser(email);
    userIds.push(user.id);
    client = await loginAsUser(email);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("zu viele Cones (> 40) → too_many_cones", async () => {
    const cones = Array.from({ length: 41 }, (_, i) => ({
      id: `c${i}`, x: i * 0.5, y: 0, kind: "standing", angleDeg: 0,
    }));
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_cones_json: cones,
    });
    assertRpcError(error, "too_many_cones", "41 cones");
  });

  it("zu viele Pfeile (> 100) → too_many_arrows", async () => {
    const arrows = Array.from({ length: 101 }, (_, i) => ({
      id: `a${i}`, startX: 0, startY: 0, endX: 1, endY: 1, cpX: 0.5, cpY: 0.5,
    }));
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_arrows_json: arrows,
    });
    assertRpcError(error, "too_many_arrows", "101 arrows");
  });

  it("lichte_breite negativ → invalid_lichte_breite", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_lichte_breite: -1,
    });
    assertRpcError(error, "invalid_lichte_breite", "negative lichte_breite");
  });

  it("lichte_breite > 20 m → invalid_lichte_breite", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_lichte_breite: 25,
    });
    assertRpcError(error, "invalid_lichte_breite", "lichte_breite 25");
  });

  it("duration_seconds > 120 s → invalid_duration_seconds", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_duration_seconds: 121,
    });
    assertRpcError(error, "invalid_duration_seconds", "duration 121");
  });

  it("ungültige default_direction → invalid_default_direction", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_default_direction: "vorwärts",
    });
    assertRpcError(error, "invalid_default_direction", "invalid direction");
  });

  it("Cone-Koordinate außerhalb ±50 m → invalid_cone_coordinates", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_cones_json: [{ id: "c1", x: 99, y: 0, kind: "standing", angleDeg: 0 }],
    });
    assertRpcError(error, "invalid_cone_coordinates", "x=99");
  });

  it("ungültige Kategorie → invalid_category", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_category: "unbekannt",
    });
    assertRpcError(error, "invalid_category", "invalid category");
  });

  it("leerer Name → invalid_name", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: "   ",
    });
    assertRpcError(error, "invalid_name", "empty name");
  });

  it("Name > 80 Zeichen → invalid_name", async () => {
    const { error } = await client.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: "x".repeat(81),
    });
    assertRpcError(error, "invalid_name", "name 81 chars");
  });
});
