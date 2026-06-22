/**
 * Security Smoke Test — läuft gegen lokalen oder Remote-Supabase.
 *
 * Login ohne Passwort: Admin generiert Magic-Link-Token via generateLink(),
 * wir tauschen hashed_token direkt via verifyOtp() gegen eine Session.
 * Keine E-Mail-Zustellung nötig, kein Passwort-Auth erforderlich.
 *
 * Pflicht-Env-Variablen:
 *   SUPABASE_URL             z. B. https://xxx.supabase.co oder http://kong:8000
 *   SUPABASE_ANON_KEY        anon/public key
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key (nur im Test-Container, nie im Browser!)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Fehlende Env-Variablen: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function ok(msg: string) {
  console.log(`  ✓  ${msg}`);
  passed++;
}

function fail(msg: string): never {
  console.error(`  ✗  FAIL: ${msg}`);
  failed++;
  throw new Error(msg);
}

function assertOk(condition: unknown, msg: string) {
  if (!condition) fail(msg);
  else ok(msg);
}

function assertErr(error: unknown, msg: string) {
  if (!error) fail(`Erwartet Fehler, aber kein Fehler aufgetreten: ${msg}`);
  else ok(msg);
}

async function createTestUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `Test-User anlegen fehlgeschlagen für ${email}: ${error?.message}`
    );
  }
  return data.user;
}

/**
 * Loggt einen User ohne Passwort ein: Admin generiert hashed_token,
 * wir verifizieren ihn direkt — kein Versand einer echten E-Mail nötig.
 */
async function loginAsUser(email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(
      `Magic-Link generieren fehlgeschlagen für ${email}: ${error?.message}`
    );
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: verifyErr } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verifyErr) {
    throw new Error(
      `OTP-Verify fehlgeschlagen für ${email}: ${verifyErr.message}`
    );
  }

  return client;
}

async function main() {
  const ts = Date.now();
  const emailA = `sec-test-a-${ts}@test.invalid`;
  const emailB = `sec-test-b-${ts}@test.invalid`;
  const userIds: string[] = [];
  const formationIds: string[] = [];

  console.log("\n=== Kartslalom Security Smoke Test ===\n");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log("  Setup: ephemere Test-User anlegen …");

  const userA = await createTestUser(emailA);
  userIds.push(userA.id);
  const userB = await createTestUser(emailB);
  userIds.push(userB.id);

  try {
    console.log("  Setup: Sessionen holen …\n");
    const clientA = await loginAsUser(emailA);
    const clientB = await loginAsUser(emailB);

    // 1 — Track anlegen
    console.log("--- 1: Track anlegen ---");
    const { data: trackId, error: createErr } = await clientA.rpc(
      "create_track",
      { track_name: `Security Test ${ts}` }
    );
    assertOk(!createErr && trackId, "User A kann eigenen Track anlegen");

    // 2 — RLS: Fremder Lesezugriff
    console.log("\n--- 2: RLS – Lesezugriff Fremduser ---");
    const { data: bRead, error: bReadErr } = await clientB
      .from("tracks")
      .select("id")
      .eq("id", trackId);
    assertOk(
      !bReadErr && Array.isArray(bRead) && bRead.length === 0,
      "User B sieht Track von User A nicht (RLS)"
    );

    // 3 — RLS: Fremder Schreibzugriff über save_track
    console.log("\n--- 3: RLS – save_track durch Fremduser ---");
    const { error: bSaveErr } = await clientB.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: {},
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_satellite: false,
      p_opacity: 0.5,
    });
    assertErr(
      bSaveErr,
      "User B kann Track von User A nicht über save_track ändern"
    );

    // 4 — Direktes INSERT auf tracks gesperrt
    console.log("\n--- 4: Direktes INSERT gesperrt ---");
    const { error: insertErr } = await clientA.from("tracks").insert({
      name: "Direct Insert",
      owner_id: "00000000-0000-0000-0000-000000000000",
    });
    assertErr(insertErr, "Direktes INSERT auf tracks ist gesperrt (REVOKE)");

    // 5 — Direktes UPDATE auf tracks gesperrt
    console.log("\n--- 5: Direktes UPDATE gesperrt ---");
    const { error: updateErr } = await clientA
      .from("tracks")
      .update({ name: "Hacked" })
      .eq("id", trackId);
    assertErr(updateErr, "Direktes UPDATE auf tracks ist gesperrt (REVOKE)");

    // 6 — Tier-Manipulation auf profiles gesperrt
    console.log("\n--- 6: Tier-Update auf profiles gesperrt ---");
    const { error: tierErr } = await clientA
      .from("profiles")
      .update({ tier: "pro" })
      .eq("id", userA.id);
    assertErr(
      tierErr,
      "Direktes tier-Update auf profiles ist gesperrt (kein UPDATE-Policy)"
    );

    // 7 — Feature-Bypass: Satellite für Free-User gesperrt
    console.log("\n--- 7: Feature-Bypass Satellite (Free-Tier) ---");
    const { error: satErr } = await clientA.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: {},
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_satellite: true,
      p_opacity: 0.5,
    });
    assertErr(
      satErr,
      "Free-User kann map_satellite=true nicht setzen (satellite_requires_pro)"
    );

    console.log(
      `\n=== ${passed} von ${passed + failed} Tests bestanden${failed > 0 ? ` — ${failed} FEHLGESCHLAGEN` : ""} ===\n`
    );
    if (failed > 0) process.exit(1);
  } finally {
    console.log("  Cleanup: Test-User löschen …");
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
    console.log("  Fertig.\n");
  }
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
