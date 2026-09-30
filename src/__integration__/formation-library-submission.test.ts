// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Bibliotheks-Einreichung (submit_custom_formation,
// admin_reject_custom_formation, Status-Reset in admin_promote_to_library).
//
// Ergänzt H4 (admin-lifecycle.test.ts): dort existierte admin_promote_to_library
// bereits, aber es gab keinen Weg, wie eine Formation den Status "submitted"
// überhaupt erreicht — dieser Test deckt genau die Lücke ab (siehe
// 20260930000001_formation_library_submission.sql). Wie bei H4 zwingend ein
// Integrationstest: die Zustandsübergänge und Owner-/Admin-Prüfungen stecken
// vollständig in SECURITY DEFINER-RPCs, nicht im Frontend.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers,
  assertNoError, assertRpcError, ts, admin, anon,
} from "./helpers";

const BASE_FORMATION = {
  p_name: "Submission Test Formation",
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

describe("Formation-Bibliothek: Einreichen/Ablehnen/Aufnehmen", () => {
  let ownerClient: Awaited<ReturnType<typeof loginAsUser>>;
  let otherClient: Awaited<ReturnType<typeof loginAsUser>>;
  let adminClient: Awaited<ReturnType<typeof loginAsUser>>;
  let otherUserId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    const t = ts();
    const [owner, other, adminUser] = await Promise.all([
      createTestUser(`int-sub-owner-${t}@test.invalid`, "free"),
      createTestUser(`int-sub-other-${t}@test.invalid`, "free"),
      createTestUser(`int-sub-admin-${t}@test.invalid`, "free"),
    ]);
    userIds.push(owner.id, other.id, adminUser.id);
    otherUserId = other.id;
    await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);

    [ownerClient, otherClient, adminClient] = await Promise.all([
      loginAsUser(`int-sub-owner-${t}@test.invalid`),
      loginAsUser(`int-sub-other-${t}@test.invalid`),
      loginAsUser(`int-sub-admin-${t}@test.invalid`),
    ]);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("Owner kann eine private Formation einreichen (status -> submitted)", async () => {
    const { data: id, error: createErr } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Submit Happy Path ${ts()}`,
    });
    assertNoError(createErr, "create_custom_formation");

    const { error } = await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });
    assertNoError(error, "submit_custom_formation");

    const { data: row } = await admin.from("custom_formations").select("status").eq("id", id as string).single();
    expect(row?.status).toBe("submitted");
  });

  it("Fremder Nutzer kann eine Formation nicht einreichen (not_owner)", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Submit Foreign ${ts()}`,
    });

    const { error } = await otherClient.rpc("submit_custom_formation", { p_formation_id: id });
    assertRpcError(error, "not_owner", "submit_custom_formation (fremder Nutzer)");

    const { data: row } = await admin.from("custom_formations").select("status").eq("id", id as string).single();
    expect(row?.status).toBe("private"); // unverändert
  });

  it("Bereits eingereichte Formation kann nicht erneut eingereicht werden (invalid_status_for_submit)", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Submit Twice ${ts()}`,
    });
    await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });

    const { error } = await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });
    assertRpcError(error, "invalid_status_for_submit", "submit_custom_formation (bereits eingereicht)");
  });

  it("Admin kann eine eingereichte Formation ablehnen (status -> rejected), Nicht-Admin nicht", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Reject Path ${ts()}`,
    });
    await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });

    const { error: forbiddenErr } = await otherClient.rpc("admin_reject_custom_formation", { p_formation_id: id });
    assertRpcError(forbiddenErr, "not_authorized", "admin_reject_custom_formation (Nicht-Admin)");

    const { error } = await adminClient.rpc("admin_reject_custom_formation", { p_formation_id: id });
    assertNoError(error, "admin_reject_custom_formation");

    const { data: row } = await admin.from("custom_formations").select("status").eq("id", id as string).single();
    expect(row?.status).toBe("rejected");
  });

  it("Abgelehnte Formation kann erneut eingereicht werden", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Resubmit After Reject ${ts()}`,
    });
    await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });
    await adminClient.rpc("admin_reject_custom_formation", { p_formation_id: id });

    const { error } = await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });
    assertNoError(error, "submit_custom_formation (erneut nach Ablehnung)");

    const { data: row } = await admin.from("custom_formations").select("status").eq("id", id as string).single();
    expect(row?.status).toBe("submitted");
  });

  it("admin_reject_custom_formation schlägt fehl, wenn die Formation nicht 'submitted' ist", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Reject Wrong Status ${ts()}`,
    });
    // status bleibt "private" — nie eingereicht

    const { error } = await adminClient.rpc("admin_reject_custom_formation", { p_formation_id: id });
    assertRpcError(error, "invalid_status_for_reject", "admin_reject_custom_formation (falscher Status)");
  });

  it("admin_promote_to_library setzt den Review-Status des Originals zurück (submitted -> private)", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Promote Resets Status ${ts()}`,
    });
    await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });

    const { data: newId, error } = await adminClient.rpc("admin_promote_to_library", {
      p_formation_id: id,
      p_category: "basis",
    });
    assertNoError(error, "admin_promote_to_library");

    const { data: original } = await admin.from("custom_formations")
      .select("status, is_library")
      .eq("id", id as string)
      .single();
    // Original ist wieder "private" (kein aktiver Share) statt für immer "submitted" —
    // is_library bleibt false, Inhalt/Owner unverändert (9.2: Kopie, kein Verschieben).
    expect(original?.status).toBe("private");
    expect(original?.is_library).toBe(false);

    const { data: copy } = await admin.from("custom_formations")
      .select("status, is_library, category")
      .eq("id", newId as string)
      .single();
    expect(copy?.status).toBe("library");
    expect(copy?.is_library).toBe(true);
    expect(copy?.category).toBe("basis");
  });

  it("admin_promote_to_library setzt den Original-Status auf 'shared' zurück, wenn noch eine Freigabe besteht", async () => {
    const { data: id } = await ownerClient.rpc("create_custom_formation", {
      ...BASE_FORMATION,
      p_name: `Promote Resets To Shared ${ts()}`,
    });
    const { error: shareErr } = await ownerClient.rpc("share_custom_formation", {
      p_formation_id: id,
      p_target_id: otherUserId,
    });
    expect(shareErr).toBeNull();
    await ownerClient.rpc("submit_custom_formation", { p_formation_id: id });

    await adminClient.rpc("admin_promote_to_library", { p_formation_id: id, p_category: "basis" });

    const { data: original } = await admin.from("custom_formations").select("status").eq("id", id as string).single();
    expect(original?.status).toBe("shared");
  });

  it("anon kann submit_custom_formation und admin_reject_custom_formation nicht aufrufen", async () => {
    const { error: submitErr } = await anon.rpc("submit_custom_formation", {
      p_formation_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(submitErr).not.toBeNull();

    const { error: rejectErr } = await anon.rpc("admin_reject_custom_formation", {
      p_formation_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(rejectErr).not.toBeNull();
  });
});
