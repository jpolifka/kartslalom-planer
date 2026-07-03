import { defineConfig, devices } from "@playwright/test";

// Im Docker-Container: App via Host-Port erreichbar (Vite blockiert Anfragen per Hostname,
// host.docker.internal umgeht das und greift über den gemappten Port 5174 zu).
// Lokal (falls direkt ausgeführt): App läuft auf localhost:5174
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://host.docker.internal:5174";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    headless: true,
    // --disable-web-security: deaktiviert CORS-Checks im Browser, damit die Supabase-URL
    // (localhost:8000, via page.route() auf host.docker.internal:8000 umgeleitet)
    // aus dem host.docker.internal:5174-Kontext ohne CORS-Fehler erreichbar ist.
    launchOptions: {
      args: ["--disable-web-security", "--disable-features=VizDisplayCompositor"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
});
