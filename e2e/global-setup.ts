/**
 * Playwright Global Setup
 *
 * Legt einen ephemeren Test-User mit Passwort an, meldet ihn über das Admin-API an
 * (Node.js → Kong direkt, kein Browser), und schreibt die Session in
 * /tmp/e2e-credentials.json. Die Smoke-Tests injizieren die Session per
 * localStorage-Injection (addInitScript) — ohne OTP-Fluss im Browser.
 *
 * Läuft genau einmal vor der gesamten Test-Suite statt pro Spec-Datei: Der
 * Login-Flow der App läuft über E-Mail-OTP (kein Passwort in der UI) — das
 * pro Test im Browser nachzustellen wäre langsam (Mail-Zustellung/Mailpit)
 * und potenziell flaky. Ein einmalig erzeugter Test-User + vorbereitete
 * Session lässt alle Specs direkt eingeloggt starten (siehe helpers/auth.ts).
 *
 * Pflicht-Env-Variablen:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import ws from "ws";

// Node.js < 22 hat kein natives WebSocket — ws als Realtime-Transport übergeben
const supabaseOpts = { realtime: { transport: ws } } as Parameters<typeof createClient>[2];

export type E2ECredentials = {
  email: string;
  userId: string;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
    token_type: string;
    user: Record<string, unknown>;
  };
};

export const CREDENTIALS_FILE = "/tmp/e2e-credentials.json";

export default async function globalSetup() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || !anonKey) {
    throw new Error(
      "SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.\n" +
      "Starte via: sh docker/run-playwright-local.sh"
    );
  }

  const admin = createClient(url, serviceKey, {
    ...supabaseOpts,
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `e2e-smoke-${Date.now()}@test.invalid`;
  const password = `E2E-${Date.now()}-test!`;

  // User anlegen (mit Passwort für password-basiertes Sign-In)
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !userData.user) {
    throw new Error(`Test-User anlegen fehlgeschlagen: ${userErr?.message}`);
  }

  // Pro-Tier setzen — mehrere Specs benötigen Pro (Versionshistorie, Speichern-
  // unter, Kartenanbieter-Wechsel, Sharing); ein gemeinsamer Test-User mit
  // Pro-Tier spart, für jede Spec einen eigenen Tier-Upgrade-Umweg zu bauen.
  await admin.from("profiles").update({ tier: "pro" }).eq("id", userData.user.id);

  // Session holen: password-basiertes Sign-In via Anon-Client (Node.js → Kong direkt)
  const anon = createClient(url, anonKey, {
    ...supabaseOpts,
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !authData.session) {
    throw new Error(`Sign-In fehlgeschlagen: ${signInErr?.message}`);
  }

  const credentials: E2ECredentials = {
    email,
    userId: userData.user.id,
    session: {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      expires_in: authData.session.expires_in ?? 3600,
      token_type: authData.session.token_type ?? "bearer",
      user: authData.session.user as unknown as Record<string, unknown>,
    },
  };

  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  console.log(`\n  E2E Test-User: ${email}`);
}
