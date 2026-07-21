// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration test helpers — connect to a real local Supabase instance.
// Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in env.

import { createClient } from "@supabase/supabase-js";

type Client = ReturnType<typeof createClient>;
import ws from "ws";

// Node 20 hat kein natives WebSocket — ws als Transport für Supabase Realtime
const supabaseOptions = { realtime: { transport: ws } } as Parameters<typeof createClient>[2];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Integration tests benötigen SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Starte via: sh docker/run-integration-test-local.sh"
  );
}

// Service-Role-Client — umgeht RLS vollständig. Wird hier nur für Dinge
// gebraucht, die ein normaler Nutzer per Definition nicht darf: Testnutzer
// anlegen/löschen, Rollen/Tier direkt in profiles setzen (statt über eine
// RPC, die genau das prüfen soll), und als "Referenzblick" hinter RLS
// vorbei, um zu verifizieren, dass ein Row wirklich (nicht) existiert.
export const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  ...supabaseOptions,
  auth: { autoRefreshToken: false, persistSession: false },
});

// Unauthentifizierter Client — zum Testen von Anon-Zugriffsverboten
export const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  ...supabaseOptions,
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function createTestUser(email: string, tier: "free" | "pro" | "team" = "free") {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser fehlgeschlagen: ${error?.message}`);
  // Explizit setzen, damit Tests unabhängig vom Spalten-Default deterministisch sind
  await admin.from("profiles").update({ tier }).eq("id", data.user.id);
  return data.user;
}

// Loggt einen Testnutzer ein, ohne dass Mailpit/SMTP im Testlauf beteiligt
// sein muss: generateLink() erzeugt den Magic-Link-Token direkt per
// Service Role, verifyOtp() tauscht ihn gegen eine echte Session auf einem
// ANON-Client. Der zurückgegebene Client verhält sich danach exakt wie ein
// im Browser eingeloggter Nutzer inkl. RLS/JWT-Claims — genau das brauchen
// die Tests, um RLS-Policies (nicht nur Applikationslogik) zu prüfen.
export async function loginAsUser(email: string): Promise<Client> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token)
    throw new Error(`generateLink fehlgeschlagen: ${error?.message}`);

  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    ...supabaseOptions,
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: verifyErr } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verifyErr) throw new Error(`verifyOtp fehlgeschlagen: ${verifyErr.message}`);

  return client;
}

// Best-effort-Cleanup: Promise.all feuert alle deleteUser()-Aufrufe parallel,
// wartet aber nur bis zum ERSTEN Reject — schlägt einer fehl, wird der Fehler
// weitergeworfen und afterAll() bricht ab, obwohl die übrigen Deletes u. U.
// noch durchlaufen (sie werden nicht abgebrochen, ihr Ergebnis wird aber nicht
// mehr geprüft). Es gibt also KEINE Garantie, dass nach einem Fehlschlag
// wirklich alle Testnutzer weg sind — verwaiste "int-*@test.invalid"-Nutzer
// nach einem roten Testlauf sind ein bekannter, in Kauf genommener Nebeneffekt.
export async function cleanupUsers(ids: string[]) {
  await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)));
}

export function ts() {
  return Date.now();
}

/** Assertion helper — wirft wenn error gesetzt ist */
export function assertNoError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Wirft wenn kein Fehler, aber einer erwartet wurde */
export function assertRpcError(error: { message: string } | null, expectedCode: string, context: string) {
  if (!error) throw new Error(`${context}: Fehler erwartet (${expectedCode}), aber keiner aufgetreten`);
  if (!error.message.includes(expectedCode))
    throw new Error(`${context}: Falscher Fehlercode. Erwartet "${expectedCode}", bekam "${error.message}"`);
}
