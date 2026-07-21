/**
 * Playwright Global Teardown — löscht den ephemeren Test-User.
 *
 * Ohne dieses Teardown würde jeder Testlauf einen neuen auth.users-Eintrag
 * (samt zugehöriger tracks/profiles-Zeilen via Cascade) hinterlassen und die
 * Datenbank des Dev-/CI-Stacks über die Zeit mit Test-Leichen zumüllen.
 * Der User (und per FK-Cascade seine Tracks/Snapshots) wird über die
 * Admin-API gelöscht — genau der User, dessen ID global-setup geschrieben hat.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import ws from "ws";
import { CREDENTIALS_FILE } from "./global-setup";

const supabaseOpts = { realtime: { transport: ws } } as Parameters<typeof createClient>[2];

export default async function globalTeardown() {
  if (!existsSync(CREDENTIALS_FILE)) return;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const admin = createClient(url, serviceKey, {
    ...supabaseOpts,
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
    await admin.auth.admin.deleteUser(credentials.userId);
    console.log(`\n  E2E Test-User gelöscht: ${credentials.email}`);
  } catch (e) {
    // Bewusst nur eine Warnung statt eines harten Fehlers: Ein fehlgeschlagenes
    // Aufräumen soll nicht einen ansonsten grünen Testlauf als Ganzes rot
    // färben — der verwaiste Test-User ist unschön, aber ungefährlich (klar
    // erkennbar an der "e2e-smoke-"-Mailadresse) und kann manuell entfernt werden.
    console.warn("Teardown: Test-User konnte nicht gelöscht werden.", e);
  }
}
