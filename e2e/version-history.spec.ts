/**
 * Playwright E2E — Versionshistorie (Phase 2)
 *
 * Flow:
 *   Snapshot bei Breite=18 erstellen
 *   → Preview-URL sofort beim Dashboard-Besuch sichern (kein zweiter Dashboard-Umweg)
 *   → Breite auf 24 ändern + Autosave
 *   → Vorschau über gespeicherte URL direkt ansteuern (Race-Condition-frei)
 *   → Schreibschutz prüfen
 *   → Wiederherstellen → Reload bestätigt Breite=18
 *   → Version löschen
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

test("Versionshistorie: Snapshot → Vorschau → Wiederherstellen (Zustand prüfen) → Löschen", async ({ page }) => {
  await loginWithSession(page);

  // ── 1. Track anlegen (Standardbreite 18 m) ─────────────────────────────
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Autosave abwarten — Breite=18 ist jetzt in der DB gespeichert
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });
  const editorUrl = page.url();
  const trackId = trackIdFromEditorUrl(editorUrl);

  // ── 2. Dashboard: Snapshot erstellen + Preview-URL sofort sichern ───────
  // Zugriff über data-testid="track-card-{id}" statt .first() — der globale
  // E2E-Test-User teilt sich die Dashboard-Liste mit parallel laufenden
  // Spec-Dateien (z. B. save-as-version.spec.ts), .first() wäre race-anfällig.
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  const card = page.getByTestId(`track-card-${trackId}`);
  await card.getByTitle("Snapshots anzeigen").click();
  await expect(card.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
  await card.getByRole("button", { name: /\+ snapshot/i }).click();
  await expect(card.getByText("Version 1")).toBeVisible({ timeout: 8_000 });

  // Eye-Button klicken + resultierender URL-Wechsel abfangen → Preview-URL
  await Promise.all([
    page.waitForURL(/\/editor\/[0-9a-f-]{36}\?previewVersion=/, { timeout: 10_000 }),
    card.getByTitle("Vorschau im Editor (schreibgeschützt)").click(),
  ]);
  const previewUrl = page.url();

  // ── 3. Editor: Breite auf 24 ändern + Autosave ─────────────────────────
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });

  // Cloud-Zustand abwarten — Breite-Input zeigt 18
  await expect(page.getByLabel(/breite/i)).toHaveValue("18", { timeout: 10_000 });
  await page.getByLabel(/breite/i).fill("24");
  await page.getByLabel(/breite/i).press("Tab"); // blur → onManualWidthBlur
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 }); // Autosave ✓

  // ── 4. Vorschau direkt ansteuern (gesicherte URL, kein Dashboard-Umweg) ─
  // Vermeidet Race Condition: Parallel-Tests können .first() verschieben.
  await page.goto(previewUrl);
  await page.waitForURL(previewUrl, { timeout: 10_000 });

  // Vorschau-Banner: Version + Schreibschutz-Hinweis
  await expect(page.getByText(/vorschau: version 1/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/schreibschutz/i)).toBeVisible();

  // Autosave-Pending-Indikator darf nicht erscheinen (Schreibschutz blockiert Autosave)
  // exact:true nötig — sonst trifft die Substring-Suche auch den neuen
  // "Speichern unter…"-Button im selben Vorschau-Banner.
  await expect(page.getByText("…", { exact: true })).not.toBeVisible();

  // ── 5. Wiederherstellen via Vorschau-Banner ─────────────────────────────
  // exact:true nötig — sonst trifft /wiederherstellen/i auch den Redo-Button
  // "Wiederherstellen (⌘⇧Z)" in der Toolbar (strict mode violation).
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();

  // Voller Seitenreload (window.location.assign) → Editor ohne previewVersion-Param
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Breite-Input muss wieder 18 zeigen — bestätigt den fachlichen Restore
  await expect(page.getByLabel(/breite/i)).toHaveValue("18", { timeout: 10_000 });

  // ── 6. Version löschen ───────────────────────────────────────────────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  const cardAfterRestore = page.getByTestId(`track-card-${trackId}`);
  await cardAfterRestore.getByTitle("Snapshots anzeigen").click();
  await expect(cardAfterRestore.getByText("Version 1")).toBeVisible({ timeout: 5_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await cardAfterRestore.getByTitle("Snapshot löschen").click();
  await expect(cardAfterRestore.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
});
