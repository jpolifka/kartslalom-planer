// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Betreiber-Konto (Migration 20260921000002_owner_account_privileges.sql).
// jens@polifka.info wird — nur mit BESTÄTIGTER E-Mail — automatisch role=admin/tier=team,
// beim Bestätigen und bei jedem Login. Ähnliche Adressen und unbestätigte Konten nicht.
//
// Die Adresse ist fest im Trigger verdrahtet und kann hier nicht variiert werden. Existiert
// das Konto in der lokalen DB schon (echter Entwickler-Account), wird es weder neu angelegt
// noch gelöscht — der Test setzt es nur zurück und prüft, dass der Login es wieder
// hochstuft (Endzustand = admin/team, also genau der gewünschte).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, loginAsUser, cleanupUsers, ts } from "./helpers";

const OWNER_EMAIL = "jens@polifka.info";

async function findUserId(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

async function profileOf(id: string) {
  const { data, error } = await admin.from("profiles").select("role, tier").eq("id", id).single();
  if (error) throw new Error(`profiles lesen: ${error.message}`);
  return data as { role: string; tier: string };
}

// Setzt das Profil per Service-Role zurück (umgeht Revoke auf profiles für authenticated)
async function downgrade(id: string) {
  const { error } = await admin.from("profiles").update({ role: "user", tier: "free" }).eq("id", id);
  if (error) throw new Error(`downgrade: ${error.message}`);
}

describe("Betreiber-Konto: automatisch Admin + Team-Tarif", () => {
  const createdIds: string[] = [];
  let ownerId: string | null = null;
  let ownerPreexisting = false;

  beforeAll(async () => {
    ownerId = await findUserId(OWNER_EMAIL);
    ownerPreexisting = ownerId !== null;
  });

  afterAll(async () => {
    await cleanupUsers(createdIds);
  });

  it("unbestätigte Registrierung mit der Betreiber-Adresse bekommt KEINE Rechte, Bestätigung schon", async () => {
    if (ownerPreexisting) return; // echter lokaler Account: unbestätigten Zustand nicht nachstellbar

    const { data, error } = await admin.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: false });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    ownerId = data.user.id;
    createdIds.push(ownerId);

    expect(await profileOf(ownerId)).toEqual({ role: "user", tier: "pro" }); // Tabellen-Defaults, unverändert

    const { error: confirmErr } = await admin.auth.admin.updateUserById(ownerId, { email_confirm: true });
    if (confirmErr) throw new Error(`confirm: ${confirmErr.message}`);
    expect(await profileOf(ownerId)).toEqual({ role: "admin", tier: "team" });
  });

  it("Login stellt ein zurückgesetztes Betreiber-Konto wieder her", async () => {
    if (!ownerId) throw new Error("Betreiber-Konto fehlt (Vorgänger-Test nicht gelaufen)");
    await downgrade(ownerId);
    expect(await profileOf(ownerId)).toEqual({ role: "user", tier: "free" });

    await loginAsUser(OWNER_EMAIL); // aktualisiert auth.users.last_sign_in_at
    expect(await profileOf(ownerId)).toEqual({ role: "admin", tier: "team" });
  });

  // Bestätigte Konten mit ähnlicher Adresse dürfen weder bei Registrierung noch beim Login
  // Rechte bekommen — der Vergleich ist exakt (case-insensitiv), kein LIKE/Präfix.
  it.each([
    ["Plus-Alias", () => `jens+${ts()}@polifka.info`],
    ["Präfix vor dem Namen", () => `x${ts()}jens@polifka.info`],
    ["andere Domain", () => `jens${ts()}@polifka.info.invalid`],
  ])("ähnliche Adresse (%s) wird nicht hochgestuft, auch nicht beim Login", async (_label, makeEmail) => {
    const email = makeEmail();
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    createdIds.push(data.user.id);
    await loginAsUser(email);
    expect(await profileOf(data.user.id)).toEqual({ role: "user", tier: "pro" });
  });
});
