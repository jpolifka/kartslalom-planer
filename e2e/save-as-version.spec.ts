/**
 * Playwright E2E — "Speichern unter" (Save As) aus der Versionshistorie (Phase 2)
 *
 * Getestetes Szenario: Aus einem alten Versions-Snapshot einer Strecke soll
 * ein komplett neuer, unabhängiger Track entstehen, OHNE den Ursprungstrack
 * zu verändern. Das ist als eigener E2E-Test sinnvoll, weil hier drei
 * Systeme zusammenspielen, die jeweils für sich getestet sind, deren
 * Zusammenspiel aber die eigentliche Fehlerquelle ist: das Dashboard (Snap-
 * shot-Liste, Namensvorbelegung im Dialog), die Versionshistorie-RPCs
 * (create_track_version/create_track_from_version, siehe security-smoke-
 * test.ts für die Rechteprüfung) und der Editor (Laden des neuen Tracks vs.
 * Fortbestehen des alten Zustands). Ein reiner Unit-/RPC-Test würde die
 * Navigation zwischen Dashboard, Vorschau-Banner und Editor nicht abdecken.
 *
 * Flow 1 (Dashboard-Einstieg):
 *   Snapshot bei Breite=18 erstellen → Breite auf 24 ändern + Autosave
 *   → Dashboard: "Als neue Strecke speichern" auf Version 1
 *   → Dialog prüft Namensvorbelegung, Name anpassen, bestätigen
 *   → neuer Track im Editor mit Breite=18
 *   → Ursprungstrack weiterhin Breite=24 (unverändert)
 *
 * Flow 2 (Vorschau-Banner-Einstieg):
 *   Vorschau-URL direkt ansteuern → "Speichern unter…" im Banner
 *   → neuer Track mit dem Snapshot-Zustand
 *
 * Alle Dashboard-Zugriffe sind über data-testid="track-card-{id}" auf die
 * eigene Track-ID gescopet (nicht .first()) — der globale E2E-Test-User teilt
 * sich die Dashboard-Liste mit parallel laufenden Spec-Dateien (z. B.
 * version-history.spec.ts), .first() wäre daher race-anfällig.
 *
 * Voraussetzung: Dev-Stack läuft, Test-User hat Pro-Tier (global-setup).
 */

import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

function trackIdFromEditorUrl(url: string): string {
  const match = url.match(/\/editor\/([0-9a-f-]{36})/);
  if (!match) throw new Error(`Konnte Track-ID nicht aus URL extrahieren: ${url}`);
  return match[1];
}

test("Speichern unter (Dashboard): neuer Track aus Snapshot, Ursprung unverändert", async ({ page }) => {
  await loginWithSession(page);

  // ── 1. Track anlegen (Standardbreite 18 m) ─────────────────────────────
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });
  const editorUrl = page.url();
  const trackId = trackIdFromEditorUrl(editorUrl);

  // ── 2. Dashboard: Snapshot 1 bei Breite=18 erstellen ───────────────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  const card = page.getByTestId(`track-card-${trackId}`);
  await card.getByTitle("Snapshots anzeigen").click();
  await expect(card.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
  await card.getByRole("button", { name: /\+ snapshot/i }).click();
  await expect(card.getByText("Version 1")).toBeVisible({ timeout: 8_000 });

  // ── 3. Editor: Breite auf 24 ändern + Autosave ─────────────────────────
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });
  await expect(page.getByLabel(/breite/i)).toHaveValue("18", { timeout: 10_000 });
  await page.getByLabel(/breite/i).fill("24");
  await page.getByLabel(/breite/i).press("Tab");
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });

  // ── 4. Dashboard: "Als neue Strecke speichern" auf Version 1 ───────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  const cardAfterUpdate = page.getByTestId(`track-card-${trackId}`);
  await cardAfterUpdate.getByTitle("Snapshots anzeigen").click();
  await expect(cardAfterUpdate.getByText("Version 1")).toBeVisible({ timeout: 8_000 });
  await cardAfterUpdate.getByTitle("Als neue Strecke speichern").click();

  // Dialog prüfen: Name ist mit "{Trackname} (Version 1)" vorbelegt
  const nameInput = page.getByLabel("Name der neuen Strecke");
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await expect(nameInput).toHaveValue(/\(Version 1\)$/);
  await nameInput.fill("Save-As-E2E-Kopie");

  // ── 5. Bestätigen → Navigation in den neuen Track ──────────────────────
  await Promise.all([
    page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Speichern", exact: true }).click(),
  ]);
  const newEditorUrl = page.url();
  expect(newEditorUrl).not.toBe(editorUrl);

  // Neuer Track zeigt den Snapshot-Zustand (Breite=18, nicht die aktuellen 24)
  await expect(page.getByLabel(/breite/i)).toHaveValue("18", { timeout: 10_000 });

  // ── 6. Ursprungstrack bleibt unverändert (weiterhin Breite=24) ─────────
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });
  await expect(page.getByLabel(/breite/i)).toHaveValue("24", { timeout: 10_000 });
});

test("Speichern unter (Vorschau-Banner): neuer Track direkt aus der Vorschau", async ({ page }) => {
  await loginWithSession(page);

  // ── 1. Track anlegen + Snapshot bei Breite=18 ──────────────────────────
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });
  const trackId = trackIdFromEditorUrl(page.url());

  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  const card = page.getByTestId(`track-card-${trackId}`);
  await card.getByTitle("Snapshots anzeigen").click();
  await expect(card.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
  await card.getByRole("button", { name: /\+ snapshot/i }).click();
  await expect(card.getByText("Version 1")).toBeVisible({ timeout: 8_000 });

  // Preview-URL sofort sichern (Race-Condition-frei, analog version-history.spec.ts)
  await Promise.all([
    page.waitForURL(/\/editor\/[0-9a-f-]{36}\?previewVersion=/, { timeout: 10_000 }),
    card.getByTitle("Vorschau im Editor (schreibgeschützt)").click(),
  ]);
  const previewUrl = page.url();

  // ── 2. Vorschau ansteuern → "Speichern unter…" im Banner ───────────────
  await page.goto(previewUrl);
  await page.waitForURL(previewUrl, { timeout: 10_000 });
  await expect(page.getByText(/vorschau: version 1/i)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Speichern unter…" }).click();
  const nameInput = page.getByLabel("Name der neuen Strecke");
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill("Save-As-Banner-Kopie");

  await Promise.all([
    page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Speichern", exact: true }).click(),
  ]);

  // Neuer Track (kein previewVersion-Query-Param mehr) mit Snapshot-Breite
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel(/breite/i)).toHaveValue("18", { timeout: 10_000 });
});
