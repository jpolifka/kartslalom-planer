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

async function createTestUser(email: string, tier: "free" | "pro" | "team") {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `Test-User anlegen fehlgeschlagen für ${email}: ${error?.message}`
    );
  }
  // Schema-Default ist vorübergehend 'pro' (Übergangspolitik) → immer explizit setzen
  const { error: tierError } = await admin
    .from("profiles")
    .update({ tier })
    .eq("id", data.user.id);
  if (tierError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(
      `Tier für ${email} konnte nicht auf ${tier} gesetzt werden: ${tierError.message}`
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

  const userA = await createTestUser(emailA, "free");
  userIds.push(userA.id);
  const userB = await createTestUser(emailB, "pro");
  userIds.push(userB.id);

  try {
    console.log("  Setup: Sessionen holen …\n");
    const clientA = await loginAsUser(emailA);
    const clientB = await loginAsUser(emailB);
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
      p_map_provider_id: "osm",
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

    // 7 — Feature-Bypass: Map-Provider-Gate — beide Tier-Seiten
    console.log("\n--- 7: Feature-Bypass Map-Provider (Free abgelehnt, Pro erlaubt) ---");
    const { error: freeSatErr } = await clientA.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_map_provider_id: "rlp_dop20",
      p_opacity: 0.5,
    });
    assertErr(
      freeSatErr,
      "Expliziter Free-User kann map_provider_id='rlp_dop20' nicht setzen (map_provider_requires_pro)"
    );

    const { data: proTrackId, error: proCreateErr } = await clientB.rpc(
      "create_track",
      { track_name: `Pro Map-Provider Test ${ts}` }
    );
    assertOk(!proCreateErr && proTrackId, "Pro-User kann eigenen Track anlegen");

    const { error: proSatErr } = await clientB.rpc("save_track", {
      p_track_id: proTrackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_map_provider_id: "rlp_dop20",
      p_opacity: 0.5,
    });
    assertOk(
      !proSatErr,
      "Expliziter Pro-User kann map_provider_id='rlp_dop20' speichern"
    );

    // 7b — map_provider_id wird von save_track() korrekt persistiert
    console.log("\n--- 7b: map_provider_id wird von save_track() persistiert ---");
    const { data: proTrackRow } = await admin
      .from("tracks")
      .select("map_provider_id")
      .eq("id", proTrackId)
      .single();
    assertOk(
      proTrackRow?.map_provider_id === "rlp_dop20",
      "map_provider_id='rlp_dop20' nach save_track() korrekt gespeichert"
    );

    const { error: proSatOffErr } = await clientB.rpc("save_track", {
      p_track_id: proTrackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_map_provider_id: "osm",
      p_opacity: 0.5,
    });
    const { data: proTrackRowOff } = await admin
      .from("tracks")
      .select("map_provider_id")
      .eq("id", proTrackId)
      .single();
    assertOk(
      !proSatOffErr && proTrackRowOff?.map_provider_id === "osm",
      "map_provider_id='osm' nach save_track() korrekt gespeichert"
    );

    // 7c — save_track() darf nicht für PUBLIC/anon ausführbar sein
    // (Least-Privilege — DROP+CREATE in der map_provider_id-Migration
    // vergibt EXECUTE sonst implizit wieder an PUBLIC, siehe REVOKE dort)
    console.log("\n--- 7c: save_track() ist für anon gesperrt (Least-Privilege) ---");
    const { error: anonSaveErr } = await anonClient.rpc("save_track", {
      p_track_id: proTrackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_map_provider_id: "osm",
      p_opacity: 0.5,
    });
    assertErr(
      anonSaveErr,
      "Anon-User kann save_track() nicht aufrufen (kein EXECUTE-Recht)"
    );

    // 8 — H0: Custom-Formation anlegen, RLS Fremdzugriff
    console.log("\n--- 8: H0 – Custom-Formation RLS (Fremdzugriff) ---");
    const { data: formationId, error: formationErr } = await clientA.rpc(
      "create_custom_formation",
      {
        p_name: `Test-Formation ${ts}`,
        p_description: null,
        p_category: "individuell",
        p_cones_json: [],
        p_arrows_json: [],
        p_default_direction: null,
        p_lichte_breite: null,
        p_duration_seconds: null,
        p_source_formation_key: null,
        p_source_custom_formation_id: null,
      }
    );
    assertOk(!formationErr && formationId, "User A kann Custom-Formation anlegen (RPC)");
    if (formationId) formationIds.push(formationId);

    const { data: bFormRead } = await clientB
      .from("custom_formations")
      .select("id")
      .eq("id", formationId);
    assertOk(
      Array.isArray(bFormRead) && bFormRead.length === 0,
      "User B sieht Custom-Formation von User A nicht (RLS)"
    );

    // 9 — H0: Direktes INSERT auf custom_formations gesperrt
    console.log("\n--- 9: H0 – Direktes INSERT auf custom_formations gesperrt ---");
    const { error: cfInsertErr } = await clientA
      .from("custom_formations")
      .insert({ name: "Direct", cones_json: [], arrows_json: [] });
    assertErr(cfInsertErr, "Direktes INSERT auf custom_formations ist gesperrt (REVOKE)");

    // 10 — H0: Library-Formation für anon lesbar
    console.log("\n--- 10: H0 – Library-Formation für anon lesbar ---");
    const { data: libRow, error: libInsertErr } = await admin
      .from("custom_formations")
      .insert({
        name: `Library-Test ${ts}`,
        cones_json: [],
        arrows_json: [],
        is_library: true,
        status: "library",
      })
      .select("id")
      .single();
    assertOk(!libInsertErr && libRow?.id, "Admin kann Library-Formation direkt anlegen");
    if (libRow?.id) formationIds.push(libRow.id);

    const { data: anonRead } = await anonClient
      .from("custom_formations")
      .select("id")
      .eq("id", libRow?.id);
    assertOk(
      Array.isArray(anonRead) && anonRead.length === 1,
      "Anon-User kann Library-Formation lesen (is_library=true)"
    );

    // 11 — Phase 2: create_track_from_version ("Speichern unter") — Fremdzugriff gesperrt
    console.log("\n--- 11: Phase 2 – create_track_from_version Fremdzugriff gesperrt ---");
    const { error: bVersionErr } = await clientB.rpc("save_track", {
      p_track_id: proTrackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_map_provider_id: "osm",
      p_opacity: 0.5,
    });
    assertOk(!bVersionErr, "Setup: Pro-User speichert Track vor Snapshot");
    const { data: versionId, error: versionErr } = await clientB.rpc("create_track_version", {
      p_track_id: proTrackId,
    });
    assertOk(!versionErr && versionId, "Setup: Pro-User erstellt Snapshot für Fremdzugriffs-Test");

    const { error: saveAsForeignErr } = await clientA.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: "Fremdzugriff-Versuch",
    });
    assertErr(
      saveAsForeignErr,
      "User A kann aus Snapshot von User B keinen neuen Track anlegen (not_owner)"
    );

    // 11b — Commit 2 Kartenanbieter-Abstraktion: map_provider_id im Snapshot-Pfad
    console.log("\n--- 11b: map_provider_id in Versionshistorie/Speichern-unter ---");
    const { data: versionDetail, error: versionDetailErr } = await clientB.rpc(
      "get_track_version_detail",
      { p_version_id: versionId }
    );
    const versionDetailRow = Array.isArray(versionDetail) ? versionDetail[0] : null;
    assertOk(
      !versionDetailErr && versionDetailRow?.map_provider_id === "osm",
      "get_track_version_detail liefert map_provider_id ('osm', Snapshot war map_provider_id='osm')"
    );

    const { data: newTrackId, error: saveAsOwnErr } = await clientB.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: `map_provider_id Kopie ${ts}`,
    });
    const { data: newTrackRow } = await admin
      .from("tracks")
      .select("map_provider_id")
      .eq("id", newTrackId)
      .single();
    assertOk(
      !saveAsOwnErr && newTrackRow?.map_provider_id === "osm",
      "create_track_from_version übernimmt map_provider_id aus dem Snapshot"
    );

    // 12 — Phase 2: Track-Share-Links
    // Hinweis: Der einfache Rate-Limit-Zähler in get_track_by_share_token()
    // (max. 3000 Aufrufe/Stunde/Token, siehe Red-Team-Review 2026-07-13)
    // wird hier bewusst NICHT durch echte wiederholte Aufrufe getestet —
    // das würde die Smoke-Suite unnötig verlangsamen.
    console.log("\n--- 12: Phase 2 – Track-Share-Links ---");

    const { error: freeShareErr } = await clientA.rpc("create_track_share_link", { p_track_id: trackId });
    assertErr(freeShareErr, "Free-User kann keinen Share-Link erzeugen (share_requires_pro)");

    const { error: foreignShareErr } = await clientB.rpc("create_track_share_link", { p_track_id: trackId });
    assertErr(foreignShareErr, "Pro-User kann keinen Share-Link auf fremdem Track erzeugen (not_owner)");

    const { data: shareToken, error: shareErr } = await clientB.rpc("create_track_share_link", { p_track_id: proTrackId });
    assertOk(
      !shareErr && typeof shareToken === "string" && shareToken.length > 0,
      "Pro-User kann eigenen Share-Link erzeugen"
    );

    const { data: sharedRows, error: sharedReadErr } = await anonClient.rpc("get_track_by_share_token", {
      p_token: shareToken,
    });
    const sharedRow = Array.isArray(sharedRows) ? sharedRows[0] : null;
    assertOk(!sharedReadErr && sharedRow?.id === proTrackId, "Anon kann Strecke mit gültigem Token ohne Login lesen");
    assertOk(
      !!sharedRow &&
        !("owner_id" in sharedRow) &&
        !("public_token_hash" in sharedRow) &&
        !("area_sel_json" in sharedRow),
      "Antwort enthält keine owner_id, keinen Token-Hash und keine Geokoordinaten (area_sel_json)"
    );

    const { error: garbageTokenErr } = await anonClient.rpc("get_track_by_share_token", {
      p_token: "garbage-token-does-not-exist",
    });
    assertErr(garbageTokenErr, "Ungültiger Token liefert einen Fehler (token_invalid)");

    const { error: revokeErr } = await clientB.rpc("revoke_track_share_link", { p_track_id: proTrackId });
    assertOk(!revokeErr, "Pro-User kann eigenen Share-Link widerrufen");
    const { error: revokedReadErr } = await anonClient.rpc("get_track_by_share_token", { p_token: shareToken });
    assertErr(revokedReadErr, "Widerrufener Token ist sofort ungültig (derselbe Fehler wie bei ungültigem Token)");

    const { data: throwawayTrackId } = await clientB.rpc("create_track", { track_name: `Share Delete Test ${ts}` });
    const { data: throwawayToken } = await clientB.rpc("create_track_share_link", { p_track_id: throwawayTrackId });
    await clientB.from("tracks").delete().eq("id", throwawayTrackId);
    const { error: deletedTrackErr } = await anonClient.rpc("get_track_by_share_token", { p_token: throwawayToken });
    assertErr(deletedTrackErr, "Gelöschter Track macht seinen Share-Link ungültig");

    const { data: proTrackId2 } = await clientB.rpc("create_track", { track_name: `Share Account-Delete Test ${ts}` });
    const { data: accountDeleteToken } = await clientB.rpc("create_track_share_link", { p_track_id: proTrackId2 });
    await admin.from("profiles").update({ is_deleted: true }).eq("id", userB.id);
    const { error: deletedAccountErr } = await anonClient.rpc("get_track_by_share_token", {
      p_token: accountDeleteToken,
    });
    assertErr(deletedAccountErr, "Soft-gelöschter Account (Owner) macht dessen Share-Link ungültig");
    await admin.from("profiles").update({ is_deleted: false }).eq("id", userB.id);

    console.log(
      `\n=== ${passed} von ${passed + failed} Tests bestanden${failed > 0 ? ` — ${failed} FEHLGESCHLAGEN` : ""} ===\n`
    );
    if (failed > 0) process.exit(1);
  } finally {
    console.log("  Cleanup: Test-Daten löschen …");
    if (formationIds.length > 0) {
      await admin.from("custom_formations").delete().in("id", formationIds);
    }
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
    console.log("  Fertig.\n");
  }
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
