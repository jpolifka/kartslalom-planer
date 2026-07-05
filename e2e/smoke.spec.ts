/**
 * Playwright Smoke Tests — Login, Cloud Save, Sharing, Export
 *
 * Läuft gegen den lokalen Dev-Stack via docker/run-playwright-local.sh.
 * Voraussetzung: Dev-Stack läuft (docker compose -f docker/docker-compose.dev.yml up -d).
 *
 * Auth: global-setup legt Test-User an und speichert Session in /tmp/e2e-credentials.json.
 * loginWithSession() injiziert die Session per localStorage (kein OTP-Formular nötig).
 */

import { test, expect } from "@playwright/test";
import { loginWithSession } from "./helpers/auth";

// ── 1: Login / Session ─────────────────────────────────────────────────────────

test("Login: Session-Injection → Dashboard", async ({ page }) => {
  await loginWithSession(page);

  // Dashboard-Überschrift sichtbar
  await expect(page.getByRole("heading", { name: /meine strecken/i })).toBeVisible();
});

// ── 2: Cloud Save ─────────────────────────────────────────────────────────────

test("Cloud Save: Neue Strecke anlegen + Autosave", async ({ page }) => {
  await loginWithSession(page);

  // Neue Strecke anlegen
  await page.getByRole("button", { name: /neue strecke/i }).click();

  // Editor öffnet sich — URL enthält /editor/<uuid>
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Autosave feuert automatisch ~1 s nach cloudLoaded.
  // Toolbar zeigt "✓" (grün) wenn gespeichert, "…" wenn Pending.
  await expect(page.getByText("✓")).toBeVisible({ timeout: 10_000 });
});

// ── 3: Sharing ────────────────────────────────────────────────────────────────

test("Sharing: Hindernisse-Liste erreichbar", async ({ page }) => {
  await loginWithSession(page);

  // Zur Formationen-Übersicht navigieren
  await page.goto("/formations");

  // Die Seite enthält entweder Hindernisse oder den "Neues Hindernis"-Button.
  // .first() nötig: Beide Elemente können gleichzeitig sichtbar sein (strict mode).
  await expect(
    page.getByRole("button", { name: /neues hindernis/i })
      .or(page.getByText(/noch keine hindernisse/i))
      .first()
  ).toBeVisible({ timeout: 10_000 });
});

// ── 4: Export ─────────────────────────────────────────────────────────────────

test("Export: SVG-Download aus dem Editor auslösen", async ({ page }) => {
  await loginWithSession(page);

  // Neue Strecke anlegen (frischer Zustand für sauberen Export-Test)
  await page.getByRole("button", { name: /neue strecke/i }).click();
  await page.waitForURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Toolbar laden abwarten (Autosave / Toolbar sichtbar)
  await expect(page.getByRole("button", { name: /download/i })).toBeVisible({ timeout: 10_000 });

  // Download-Event abfangen: "Download"-Dropdown öffnen → "Als SVG" klicken
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    (async () => {
      await page.getByRole("button", { name: /download/i }).click();
      await page.getByRole("button", { name: /als svg/i }).click();
    })(),
  ]);

  // Dateiname sollte .svg enthalten
  expect(download.suggestedFilename()).toMatch(/\.svg$/i);
});
