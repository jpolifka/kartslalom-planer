/**
 * Playwright E2E — Versionshistorie (Phase 2)
 *
 * Testet den vollständigen UI-Flow:
 *   Snapshot bei Breite=18 erstellen
 *   → Breite auf 24 ändern + Autosave
 *   → Vorschau (Schreibschutz prüfen)
 *   → Wiederherstellen
 *   → Reload bestätigt Breite=18 im Eingabefeld
 *   → Version löschen
 *
 * Voraussetzung: Dev-Stack läuft, Test-User hat Pro-Tier (global-setup).
 */

import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

test("Versionshistorie: Snapshot → Vorschau → Wiederherstellen (Zustand prüfen) → Löschen", async ({ page }) => {
  await loginWithSession(page);

  // ── 1. Track anlegen (Standardbreite 18 m) ─────────────────────────────
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Autosave abwarten — Breite=18 ist jetzt in der DB gespeichert
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });
  const editorUrl = page.url();

  // ── 2. Snapshot bei Breite=18 erstellen (über Dashboard) ───────────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  await page.getByTitle("Snapshots anzeigen").first().click();
  await expect(page.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /\+ snapshot/i }).click();
  await expect(page.getByText("Version 1")).toBeVisible({ timeout: 8_000 });

  // ── 3. Editor: Breite auf 24 ändern + Autosave ─────────────────────────
  await page.goto(editorUrl);
  await page.waitForURL(editorUrl, { timeout: 10_000 });

  // Cloud-Zustand abwarten — Breite-Input zeigt 18
  await expect(page.getByLabel(/breite/i)).toHaveValue("18", { timeout: 10_000 });

  await page.getByLabel(/breite/i).fill("24");
  await page.getByLabel(/breite/i).press("Tab"); // blur → onManualWidthBlur
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 }); // Autosave ✓

  // ── 4. Versionshistorie: Vorschau öffnen ────────────────────────────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");
  await page.getByTitle("Snapshots anzeigen").first().click();
  await expect(page.getByText("Version 1")).toBeVisible({ timeout: 5_000 });

  await page.getByTitle("Vorschau im Editor (schreibgeschützt)").click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}\?previewVersion=/, { timeout: 10_000 });

  // Vorschau-Banner: Version + Schreibschutz-Hinweis
  await expect(page.getByText(/vorschau: version 1/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/schreibschutz/i)).toBeVisible();

  // Autosave-Indikator darf nicht erscheinen (Schreibschutz deaktiviert Autosave)
  await expect(page.getByText("…")).not.toBeVisible();

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
  await page.getByTitle("Snapshots anzeigen").first().click();
  await expect(page.getByText("Version 1")).toBeVisible({ timeout: 5_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("Snapshot löschen").click();
  await expect(page.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
});
