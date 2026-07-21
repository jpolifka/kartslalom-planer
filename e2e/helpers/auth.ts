/**
 * E2E Auth Helper — injiziert eine vorbereitete Supabase-Session in localStorage,
 * damit Tests ohne OTP-Formular direkt eingeloggt starten.
 */

import type { Page } from "@playwright/test";
import { readFileSync } from "fs";
import { CREDENTIALS_FILE, type E2ECredentials } from "../global-setup";

export function loadCredentials(): E2ECredentials {
  return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
}

/**
 * Registriert eine page.route(), die alle localhost:8000-Anfragen (baked VITE_SUPABASE_URL)
 * auf host.docker.internal:8000 (erreichbarer Kong) umleitet.
 * Interception auf Playwright/Node.js-Ebene → kein CORS-Problem.
 * Nur aktiv wenn PLAYWRIGHT_BASE_URL gesetzt (Docker-Modus): Läuft der
 * Playwright-Browser selbst im Container (docker/run-playwright-local.sh),
 * liegt "localhost" aus Sicht des Browsers im eigenen Netzwerk-Namespace —
 * Kong ist dort nur über host.docker.internal erreichbar. Lokal ohne Docker
 * zeigt localhost:8000 bereits korrekt auf den Host, daher keine Umleitung nötig.
 */
export async function patchSupabaseUrl(page: Page) {
  if (!process.env.PLAYWRIGHT_BASE_URL) return;
  await page.route("http://localhost:8000/**", async (route) => {
    const url = route.request().url().replace("localhost:8000", "host.docker.internal:8000");
    await route.continue({ url });
  });
}

/**
 * Injiziert die aus global-setup gespeicherte Session direkt in localStorage,
 * BEVOR irgendein Seitenscript läuft (addInitScript). Supabase JS findet
 * die Session im Storage und setzt isLoading=false ohne Netzwerk-Roundtrip.
 *
 * Der localStorage-Schlüssel ist: sb-<hostname>-auth-token
 * Bei VITE_SUPABASE_URL=http://localhost:8000 → sb-localhost-auth-token
 */
export async function loginWithSession(page: Page) {
  const credentials = loadCredentials();

  await patchSupabaseUrl(page);

  // addInitScript statt page.evaluate() NACH goto(): Das Script muss laufen,
  // bevor der App-Code (und damit der Supabase-Client) initialisiert wird —
  // sonst sieht die App beim ersten Render keine Session und rendert kurz
  // den Login-Screen, was Folge-Assertions race-anfällig machen würde.
  await page.addInitScript(({ session }) => {
    // Supabase JS v2: Schlüssel = sb-<hostname>-auth-token
    // hostname aus VITE_SUPABASE_URL (http://localhost:8000) → "localhost"
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
  }, { session: credentials.session });

  // Dashboard direkt ansteuern — Supabase findet Session im Storage
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}
