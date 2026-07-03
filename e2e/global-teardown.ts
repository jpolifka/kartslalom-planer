/**
 * Playwright Global Teardown — löscht den ephemeren Test-User.
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
    console.warn("Teardown: Test-User konnte nicht gelöscht werden.", e);
  }
}
