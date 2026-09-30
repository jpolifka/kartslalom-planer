# Beitragen zum Kartslalom Planer

## Pflichttest-Protokoll für Datenbankänderungen

Jede Änderung an SQL-Migrationen, RLS-Policies oder SECURITY DEFINER RPCs erfordert
vor dem Mergen die lokale Ausführung aller drei Test-Suites.

### 1. Unit-Tests (immer)

```sh
docker compose -f docker/docker-compose.unit.yml up --build --exit-code-from unit-test
```

Muss grün sein bevor Integration oder Smoke gestartet wird.

### 2. Integrationstests (bei jeder SQL/RLS/RPC-Änderung)

```sh
sh docker/run-integration-test-local.sh
```

**Wann Pflicht:**
- Neue oder geänderte Migrationen (`.sql`-Dateien in `supabase/migrations/`)
- Neue oder geänderte RLS-Policies
- Neue oder geänderte SECURITY DEFINER Funktionen

Die Integrationstests laufen gegen eine lokale Supabase-Instanz und prüfen echte
Datenbankoperationen — kein Mocking.

### 3. Security Smoke Tests (bei RLS/RPC/Permission-Änderungen)

```sh
sh docker/run-security-test-local.sh
```

**Wann Pflicht:**
- Änderungen an RLS-Policies
- Änderungen an GRANT/REVOKE
- Neue SECURITY DEFINER Funktionen
- Tier-Logik-Änderungen (Feature-Gates)

## Sicherheitsregeln (unveränderlich)

- **Kein direktes `.insert()`/`.update()` vom Client.** Alle Schreibops über SECURITY DEFINER RPCs.
- **Kein `select("*")` in `fetchTrack()` oder ähnlichen Fetch-Funktionen.** Explizite Spaltenlisten.
- **Kein `as never` in typ-kritischen Pfaden.** Ehrliche Casts oder direkte Typen.
- **Kein Stripe / kein Checkout** in der App. Tier-Upgrades manuell per SQL; Upgrade-UX = Kontakt-Link.
- **Immer Docker** — niemals direkt auf dem Host installieren oder ausführen.

## Tier-Logik

| Tier | Bedeutung |
|---|---|
| `free` | Eingeschränkte Features (3 Strecken, kein Satellite, keine Versionshistorie) |
| `pro` | Erweiterte Features (50 Strecken, Satellite, 10 Versionen) |
| `team` | Unbegrenzt |

**Übergangspolitik (aktiv):** `profiles.tier DEFAULT 'pro'` bis zum öffentlichen Rollout.
Vor der Freigabe: DEFAULT auf `'free'` ändern und bestehende Profile klassifizieren.

Neue Tier-Checks müssen **immer** auf beiden Seiten getestet werden:
- Free: Feature wird abgelehnt
- Pro: Feature wird erlaubt

Siehe `src/__integration__/track-lifecycle.test.ts` als Muster.

## Neue Migrations-Checkliste

- [ ] SQL-Datei nach Schema `YYYYMMDDHHMMSS_beschreibung.sql` benennen
- [ ] `security definer set search_path = public` bei jeder neuen Funktion
- [ ] `grant execute on function ... to authenticated` (oder `anon` wenn nötig)
- [ ] **`revoke execute on function ... from public, anon` direkt bei jeder neuen Funktion**,
      zusätzlich zum `grant`, auch wenn `anon` ohnehin nicht gewollt ist. Nicht auf das globale
      `alter default privileges ...` aus `20260713000002_harden_public_function_grants.sql`
      verlassen — dessen Wirkung gilt nur für die Rolle, die diese Anweisung ausgeführt hat, nicht
      für jede Rolle, die künftig eine Migration ausführt (siehe Kommentar in
      `docker/supabase/apply-migrations.sh`). `apply-migrations.sh` prüft das am Ende automatisch
      gegen die Allowlist in `src/__integration__/rpc-grants.test.ts`
      (`get_library_formations`, `get_track_by_share_token`) und bricht bei einem Fund ab —
      als Backstop, nicht als Ersatz für das explizite `revoke` in der Migration selbst.
- [ ] `revoke insert, update on public.<neue_tabelle> from anon, authenticated` wenn Table nur via RPC beschrieben werden soll
- [ ] RLS-Policy für SELECT anlegen (owner-scoped)
- [ ] Integrationstest für neue RPC ergänzen
- [ ] Sicherheitstest ergänzen wenn neue Permission-Grenze eingeführt wird
