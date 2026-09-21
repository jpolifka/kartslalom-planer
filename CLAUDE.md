# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Kartslalom-Streckenplaner: React-18/TypeScript-SPA (Vite) zum Entwerfen, Validieren und Exportieren von Kartslalom-Strecken, mit self-hosted Supabase als Backend. Code-Kommentare, Docs und Commit-Messages sind auf Deutsch — beim Ändern im selben Stil bleiben.

## Befehle

**Docker ist Pflicht** (Projektregel, siehe CONTRIBUTING.md): nichts direkt auf dem Host installieren oder ausführen. Alle Skripte unten sind vom Projekt-Root aus aufzurufen.

```bash
# Dev-Stack (App + kompletter Supabase-Stack + Mailpit) — Projektname "kartslalom"
docker compose --profile dev -f docker/docker-compose.dev.yml up -d
#   App http://localhost:5174 · API/Kong + Studio http://localhost:8000 · Mailpit http://localhost:8025
sh docker/reset-dev.sh            # ACHTUNG: löscht Images + lokale DB/Storage-Daten
(cd docker/supabase && sh reset.sh)   # nur DB neu anlegen, alle Migrationen erneut ausführen

# Unit-Tests (offline, kein Supabase nötig) — Service heißt `unit-test`
docker compose -f docker/docker-compose.unit.yml up --build --exit-code-from unit-test

# Einzelne Testdatei / einzelner Test im laufenden Dev-Container
docker exec kartslalom-kartslalom-dev-1 npx vitest run src/lib/storage.test.ts
docker exec kartslalom-kartslalom-dev-1 npx vitest run -t "Testname"

# Typcheck / Build / Coverage (im Dev-Container, npm-Skripte siehe package.json)
docker exec kartslalom-kartslalom-dev-1 npm run type-check
docker exec kartslalom-kartslalom-dev-1 npm run build          # tsc --noEmit && vite build
docker exec kartslalom-kartslalom-dev-1 npm run test:coverage  # Schwellen: 80 % stmt/func/lines, 70 % branches

# Tests gegen den laufenden Dev-Stack (echte DB, kein Mocking)
sh docker/run-integration-test-local.sh   # src/__integration__/**, vitest.integration.config.ts
sh docker/run-security-test-local.sh      # scripts/security-smoke-test.ts (RLS/GRANT/Tier-Grenzen)
sh docker/run-playwright-local.sh         # e2e/*.spec.ts, Chromium, App über host.docker.internal:5174
```

Es gibt keinen Linter (kein ESLint/Prettier) — `tsc` mit `strict`, `noUnusedLocals`, `noUnusedParameters` ist die einzige statische Prüfung.

CI (`.github/workflows/ci.yml`) läuft auf PRs und `main`: Job `build` (`npm test` + `npm run build`) und `security-smoke` (baut den Stack ephemer im Runner). Beide sind Required Checks (strict, auch für Admins); direkte Pushes auf `main` sind nicht möglich, alles läuft per PR. Die Workflow-Trigger haben bewusst keinen `paths-ignore`, sonst wären Doku-PRs nicht mergebar. Der Job `full-test` (Integration + Security + E2E + `npm audit`) ist nur manuell per `workflow_dispatch`.

### Pflicht-Testprotokoll bei DB-Änderungen

Jede Änderung an `supabase/migrations/*.sql`, RLS-Policies, GRANT/REVOKE, oder SECURITY-DEFINER-RPCs verlangt vor dem Merge alle drei Suiten (Unit → Integration → Security-Smoke). Neue Tier-Checks immer beidseitig testen (Free lehnt ab, Pro erlaubt) — Muster: `src/__integration__/track-lifecycle.test.ts`.

## Architektur

### Schichten und Datenfluss

`UI (pages/components) → Hook (hooks/) → API-Modul (lib/api/) → Supabase-RPC`. Verbindliche Regeln (aus dem Modularitäts-Review):

- Keine Supabase-Aufrufe in Pages/Komponenten; Pages transformieren keine DB-Zeilen fachlich (Mapper wie `trackRowToSavedState()` oder Hooks).
- Explizite Spaltenlisten, nie `select("*")` (siehe `TRACK_DETAIL_COLUMNS` in `src/lib/api/tracks.ts`); RPC-Antworten mit eigenen Rückgabetypen; Domänenmodelle (`src/types.ts`) bleiben unabhängig von Supabase-Typen.
- **Kein direktes `.insert()`/`.update()` vom Client** für Tabellen mit Tarif-/Limit-Logik — Schreiben nur über SECURITY-DEFINER-RPCs (`create_track`, `save_track`, …). Kein `as never` in typkritischen Pfaden.
- Neue, klar abgrenzbare Features als Feature-Slice unter `src/features/<name>/{api,hooks,components,types.ts}` anlegen (Vorbilder: `png-export`, `track-share`) statt in die Schicht-Ordner zu mischen. Bestehender Code bleibt bewusst nach Schichten organisiert.
- Fehler aus RPCs werden aktuell als String-Codes geworfen (`throw new Error("TRACK_LIMIT_REACHED")`), in der API-Schicht aus der Postgres-Fehlermeldung gemappt.

### Auth, Gast-Modus und Routing (`src/router.tsx`)

Drei Zugriffszonen unter `GlobalLayout` (lädt das Profil via `useProfile`): öffentlich (Login, Editor, Formation-Editor, `/share/:token`), `AuthGuard` (Dashboard, Formationen, Settings), `AdminGuard` (`/admin/*`). Editor und Formation-Editor funktionieren **ohne Login** über localStorage (`lib/storage.ts`); mit Session speichert `EditorPage` per RPC in die Cloud. Unbekannte Pfade landen im Editor. `main.tsx` befüllt `useAuthStore` (Zustand) aus `supabase.auth.getSession()` + `onAuthStateChange`; der Router rendert erst nach `isLoading === false`. Login ist Magic-Link/PKCE (`AuthCallbackPage` migriert danach localStorage-Strecken).

### Tarife (free / pro / team)

Zwei client-seitige Mechanismen, beide **nur UX** — das echte Enforcement liegt in den RPCs/RLS:
- `hooks/useTier.ts`: fest einkompilierte Limits (3 / 50 / ∞ Strecken) und Feature-Flags.
- `hooks/useFeatureGate.ts`: erforderlicher Tarif kommt zur Laufzeit aus der Tabelle `app_config` (ohne Deploy änderbar), z. B. `custom_formations_required_tier`.

Tier-Upgrades passieren manuell per SQL — kein Stripe/Checkout in der App, Upgrade-UX ist ein Kontakt-Link. `profiles.tier` hat aktuell `DEFAULT 'pro'` (Übergangspolitik bis zum öffentlichen Rollout). Die Migration `20260921000002_owner_account_privileges.sql` macht das Betreiber-Konto (bestätigte E-Mail) automatisch zu `admin`/`team` — nur sicher mit `ENABLE_EMAIL_AUTOCONFIRM=false`, was `preflight-check.sh` erzwingt.

### Editor-State

`src/pages/EditorPage.tsx` hält `TrackState = { items, arrows }` in einem Undo/Redo-History-Objekt `{ past, present, future }` (max. 30 Schritte), Reducer in `src/pages/editor/trackReducer.ts`. Zwei Aktionsklassen: *committing* (ADD/DELETE/UPDATE …) schreiben History; *live* (`MOVE_*`) verändern nur `present`, damit ein Drag nicht pro Frame einen Undo-Schritt erzeugt — ein `CHECKPOINT` bei Drag-Start sichert den Vorzustand. Koordinaten sind in **Metern**, nicht Pixeln.

### Formationen

Eingebaute Formationen: eine Datei je Formation in `src/lib/formations/` (Cone-Geometrie), zentral registriert in `src/lib/formationRegistry.ts` (dort auch die Dauern-Override-Tabelle). Zusätzlich gibt es benutzerdefinierte Formationen in der DB (`custom_formations`, Formation-Editor unter `/formations/*`, Sharing mit `view`/`edit`-Rechten, `is_library` für öffentliche Bibliothek, Admin-Bearbeitung fremder Formationen über eigene `admin_*`-RPCs). Die Zugriffslogik zentral in `lib/formations/permission.ts` (`owner > edit > view > null`, Admin = effektiv `edit`). Validierung (Geometrie- und Streckenregeln) in `src/lib/validation/`.

### Karte und Export

`lib/mapProviders.ts` ist die zentrale Registry der Kartenanbieter (`osm` = XYZ-Kacheln, `rlp_dop20` = WMS-Einzelbild; Esri wurde aus Lizenzgründen entfernt). `tracks.map_provider_id` ist ein String-Enum, kein Boolean mehr. Rendering in `MapBackground.tsx` (Editor) und `lib/mapRender.ts`/`exportSVG.ts` (Export) — Änderungen an Anbietern müssen beide Pfade treffen (`mapProviderConfigDrift.test.ts` prüft die Konsistenz). Im Editor lädt der Client den WMS-Dienst direkt, im Export läuft er über die Edge Function `map-background-image` (Allowlist-Proxy). Exporte: SVG/PDF (`exportSVG.ts`, jsPDF + svg2pdf) und PNG (`features/png-export`); „transparent“ heißt sauberes Overlay ohne Raster/Rand/Beschriftung. Alle Labels/Attributionen im SVG müssen escaped werden (Injection-Tests vorhanden).

**Stolperfalle:** `tracks.manual_width/manual_length` ist bei Strecken mit Kartenausschnitt **nicht** die effektive Feldgröße — die kommt aus `area_sel_json` (`lib/areaSelection.ts`). Das war die Ursache des Share-Link-Rendering-Bugs vom 2026-07-13.

### Backend (`supabase/` + `docker/supabase/`)

- **Migrationen** (`supabase/migrations/YYYYMMDDHHMMSS_beschreibung.sql`) sind die einzige Schemaquelle. `docker/supabase/migrate.sh` führt sie nur bei **leerem** DB-Datenverzeichnis aus und trägt sie in `public._applied_migrations` ein; für laufende Instanzen (auch Prod) `sh docker/supabase/apply-migrations.sh`. `push-to-prod.sh` ist obsolet (alte Cloud-Anbindung).
- **Checkliste für neue RPCs:** `security definer set search_path = public`; explizit `grant execute … to authenticated` (nur bei Bedarf `anon`); bei RPC-only-Tabellen `revoke insert, update … from anon, authenticated`; owner-scoped SELECT-Policy. `anon`/PUBLIC hat standardmäßig **kein** EXECUTE mehr (nur `get_library_formations` und `get_track_by_share_token` sind öffentlich) — der Security-Test prüft das dynamisch über alle `public`-Funktionen; Rechte mit `has_function_privilege()` prüfen, nicht mit `pg_default_acl`.
- **Edge Functions** (Deno, `supabase/functions/`): Kong routet `/functions/v1/*` komplett an `main/index.ts`, einen Dispatcher, der die Handler statisch importiert. Jede Function ist in `handler.ts` (Logik, single source of truth) + `index.ts` (dünner `Deno.serve`-Entrypoint) geteilt — Logik nie in `main` duplizieren. Handler-Tests liegen in `src/functions/*.test.ts` (nicht neben den Functions) und importieren die Handler aus `supabase/functions/` — deshalb kopiert `docker/Dockerfile.unit` diesen Ordner mit.
- Self-hosted-Stack liegt in `docker/supabase/` (Kong-Config in `volumes/api/kong.yml` mit CORS-Allowlist); `docker/docker-compose.dev.yml` bindet ihn per `include` ein, `docker/docker-compose.yml` ist die Produktion (Projekt `kartslalom-prod`, nginx-Container für die App, Start nur über `sh docker/deploy-prod.sh` wegen Secret-Preflight).

### Build-/Deploy-Besonderheiten

- `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` werden zur **Build-Zeit** ins Bundle gebacken — Änderung braucht Rebuild, nicht nur Restart. Lokal: `.env.local`; Prod: Root-`.env` (per `--env-file`, sonst still leer).
- `docker/nginx.conf` hat eine CSP mit fest verdrahtetem `connect-src` auf `kartapi.cheezuscraizt.de`; neue externe Hosts (z. B. Kartendienste) müssen dort ergänzt werden.
- Vitest-Konfiguration steckt in `vite.config.ts` (`test`-Block, jsdom, `src/test-setup.ts`); Integrationstests (`src/__integration__/`, Node-Umgebung, sequentiell) sind aus dem normalen Lauf ausgeschlossen. Pages, Canvas-/Map-Komponenten und Auth-Hooks sind bewusst von der Coverage ausgenommen (→ Playwright).
- Testdateien liegen neben dem Code als `*.test.ts(x)`, `tsconfig.json` schließt sie vom Typcheck aus.

## Dokumentationspflicht

Die Dokumentation muss **spätestens vor dem Öffnen eines Pull Requests** geprüft und bei Bedarf überarbeitet werden. Dazu gehören `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/` (vor allem `architektur.md` und das jeweils betroffene Fachdokument), `supabase/migrations/README.md` und bei Änderungen an Bedienung oder Funktionsumfang die Nutzerhilfe in `docs/user/`. Prüfen heißt: Aussagen gegen den aktuellen Code abgleichen (Dateipfade, Befehle, Routen, Tarif-Grenzen, RPC-Namen), nicht nur neue Abschnitte anhängen. Steht nach der Prüfung nichts an, das im PR-Text kurz festhalten (die PR-Vorlage in `.github/pull_request_template.md` fragt das ab).

## Repo-Eigenheiten

- Nutzerdokumentation (in der App-Hilfe angezeigt, per `?raw`-Import gebündelt) liegt in `docs/user/`; Entwicklerdoku in `docs/` (`architektur.md`, `persistenz.md`, `build-und-deployment.md`, ADRs in `docs/adr/`, Pläne in `docs/planning/`).
- Das Projekt liegt in einem iCloud-synchronisierten Ordner: `node_modules` ist ein Symlink auf `node_modules.nosync`; Konfliktkopien wie `node_modules 2`, `volumes 2`, `formation-editor 2` sind Artefakte und nicht Teil des Projekts. iCloud kann laufende lokale Postgres-Daten beschädigen — bei kaputter lokaler DB zuerst `reset-dev.sh`/`reset.sh`.
- Lokale Auth-Probleme sind meist Konfiguration, keine Regression: veralteter `ANON_KEY` in `.env.local` (Drift gegenüber `docker/supabase/.env`), Mailpit-SMTP-Host/Port, fehlendes Confirmation-Mail-Template, falsche `SITE_URL`.
- `CHANGELOG.md` und `package.json`-Version werden pro Release gepflegt (aktuell 2.6.x).
