/**
 * Playwright E2E — Kartenanbieter-Abstraktion (RLP-DOP20 als Esri-Ersatz)
 *
 * MapSelector.tsx hat kein Adress-/Koordinaten-Eingabefeld (nur Pan/Zoom/
 * Draw per Maus) — der Streckenbereich wird hier daher direkt über
 * save_track() (Node-seitig, siehe helpers/api.ts) gesetzt statt über die
 * UI nachgezogen. Getestet wird ausschliesslich das Rendering-/Coverage-
 * Verhalten danach (Seiten-Reload lädt den gesetzten Bereich aus der Cloud).
 *
 * Voraussetzung: Dev-Stack läuft, Test-User hat Pro-Tier (global-setup).
 */

import { test, expect } from "@playwright/test";
import { loginWithSession, loadCredentials } from "./helpers/auth";
import { saveTrackArea } from "./helpers/api";

// Mainz — liegt innerhalb der RLP-DOP20-Abdeckung (siehe mapProviders.ts coverage).
const MAINZ = { centerLat: 49.9929, centerLng: 8.2473, widthM: 100, heightM: 100, rotationDeg: 0 };
// Berlin — liegt eindeutig ausserhalb.
const BERLIN = { centerLat: 52.52, centerLng: 13.405, widthM: 100, heightM: 100, rotationDeg: 0 };

function trackIdFromEditorUrl(url: string): string {
  const match = url.match(/\/editor\/([0-9a-f-]{36})/);
  if (!match) throw new Error(`Konnte Track-ID nicht aus URL extrahieren: ${url}`);
  return match[1];
}

async function createTrackAndGetIds(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const editorUrl = page.url();
  return { editorUrl, trackId: trackIdFromEditorUrl(editorUrl) };
}

test("RLP-DOP20: Standort innerhalb Rheinland-Pfalz zeigt Luftbild aktiv und WMS-Bild", async ({ page }) => {
  await loginWithSession(page);
  const { editorUrl, trackId } = await createTrackAndGetIds(page);

  await saveTrackArea(loadCredentials(), trackId, MAINZ, "rlp_dop20");
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });

  // Radio "Luftbild Rheinland-Pfalz" ist ausgewählt und nicht Pro-gesperrt
  const rlpRadio = page.getByRole("radio", { name: /luftbild rheinland-pfalz/i });
  await expect(rlpRadio).toBeChecked({ timeout: 10_000 });
  await expect(rlpRadio).toBeEnabled();

  // Kein Coverage-Hinweis
  await expect(page.getByText(/luftbild derzeit nur in rheinland-pfalz verfügbar/i)).toHaveCount(0);

  // MapBackground rendert das WMS-Einzelbild (RLP-Domain), keine OSM-Kacheln
  await expect(page.locator('img[src*="geo4.service24.rlp.de"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('img[src*="tile.openstreetmap.org"]')).toHaveCount(0);
});

test("Ausserhalb der RLP-Abdeckung (Berlin) faellt die Anzeige auf Strassenkarte zurueck", async ({ page }) => {
  await loginWithSession(page);
  const { editorUrl, trackId } = await createTrackAndGetIds(page);

  await saveTrackArea(loadCredentials(), trackId, BERLIN, "rlp_dop20");
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });

  // Gespeicherte Auswahl bleibt "rlp_dop20" (Radio weiterhin markiert) —
  // nur das tatsächliche Rendering faellt zurueck, siehe EditorPage.tsx
  // effectiveMapProviderId. Coverage-Hinweis wird angezeigt.
  await expect(page.getByRole("radio", { name: /luftbild rheinland-pfalz/i })).toBeChecked({ timeout: 10_000 });
  await expect(page.getByText(/luftbild derzeit nur in rheinland-pfalz verfügbar/i)).toBeVisible();

  // MapBackground rendert OSM-Kacheln statt des WMS-Bilds
  await expect(page.locator('img[src*="tile.openstreetmap.org"]').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('img[src*="geo4.service24.rlp.de"]')).toHaveCount(0);
});

test("Export: SVG-Export bettet das RLP-Luftbild als data-URI ein (kein Live-WMS-Link im Export)", async ({ page }) => {
  await loginWithSession(page);
  const { editorUrl, trackId } = await createTrackAndGetIds(page);

  await saveTrackArea(loadCredentials(), trackId, MAINZ, "rlp_dop20");
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });
  await expect(page.locator('img[src*="geo4.service24.rlp.de"]')).toBeVisible({ timeout: 10_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    (async () => {
      await page.getByRole("button", { name: /download/i }).click();
      await page.getByRole("button", { name: /als svg/i }).click();
    })(),
  ]);

  const path = await download.path();
  if (!path) throw new Error("Download hat keinen lokalen Pfad geliefert.");
  const { readFileSync } = await import("fs");
  const svgContent = readFileSync(path, "utf-8");

  expect(svgContent).toContain("data:image/jpeg;base64,");
  expect(svgContent).not.toContain("geo4.service24.rlp.de");
});
