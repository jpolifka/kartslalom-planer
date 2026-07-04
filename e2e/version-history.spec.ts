/**
 * Playwright E2E — Versionshistorie (Phase 2)
 *
 * Testet den vollständigen UI-Flow: Snapshot erstellen → Versionsliste →
 * Vorschau (Schreibschutz) → Wiederherstellen → Reload bestätigt Zustand → Löschen.
 *
 * Voraussetzung: Dev-Stack läuft, Test-User hat Pro-Tier (global-setup).
 */

import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

test("Versionshistorie: Snapshot → Vorschau → Wiederherstellen → Löschen", async ({ page }) => {
  await loginWithSession(page);

  // ── 1. Track anlegen ──────────────────────────────────────────────────────
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Autosave abwarten — stellt sicher dass der Track serverseitig existiert
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });

  // ── 2. Dashboard öffnen → Versions-Panel ausklappen ──────────────────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");

  // ChevronRight-Button (title="Snapshots anzeigen") — erste Strecke in der Liste
  await page.getByTitle("Snapshots anzeigen").first().click();

  // Kein Snapshot vorhanden
  await expect(page.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });

  // ── 3. Snapshot erstellen ─────────────────────────────────────────────────
  await page.getByRole("button", { name: /\+ snapshot/i }).click();

  // Version 1 erscheint in der Liste
  await expect(page.getByText("Version 1")).toBeVisible({ timeout: 8_000 });

  // ── 4. Vorschau öffnen (Eye-Icon) ────────────────────────────────────────
  await page.getByTitle("Vorschau im Editor (schreibgeschützt)").click();

  // URL enthält jetzt ?previewVersion=<uuid>
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}\?previewVersion=/, { timeout: 10_000 });

  // Vorschau-Banner: Version + Schreibschutz-Hinweis
  await expect(page.getByText(/vorschau: version 1/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/schreibschutz/i)).toBeVisible();

  // Autosave-Indikator darf nicht erscheinen (Schreibschutz deaktiviert Autosave)
  await expect(page.getByText("✓")).not.toBeVisible();

  // ── 5. Wiederherstellen über Vorschau-Banner ──────────────────────────────
  // exact:true nötig — sonst trifft /wiederherstellen/i auch den Redo-Button
  // "Wiederherstellen (⌘⇧Z)" in der Toolbar (strict mode violation).
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();

  // Voller Seitenreload (window.location.assign) → Editor ohne previewVersion-Param
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Editor lädt restaurierten Zustand — Autosave feuert
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });

  // ── 6. Version löschen ───────────────────────────────────────────────────
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard");

  await page.getByTitle("Snapshots anzeigen").first().click();
  await expect(page.getByText("Version 1")).toBeVisible({ timeout: 5_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("Snapshot löschen").click();

  // Nach dem Löschen: Liste leer
  await expect(page.getByText(/noch keine snapshots/i)).toBeVisible({ timeout: 5_000 });
});
