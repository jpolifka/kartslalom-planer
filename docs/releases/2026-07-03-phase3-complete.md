# Release-Nachweis: Phase 3 (H0–H5) vollständig — 2026-07-03

## Zusammenfassung

Phase 3 (Custom-Hindernisse, H0–H5) ist vollständig implementiert, getestet und grün.
Alle Sicherheitsüberprüfungen und Integrationstests wurden vor diesem Stand ausgeführt.

## Testergebnis

| Suite | Ergebnis |
|---|---|
| Unit-Tests (Vitest) | **175 Tests bestanden** |
| Integrationstests (lokale Supabase) | **89 Tests bestanden** |
| Security Smoke Tests | **14 Tests bestanden** |
| Build (TypeScript + Vite) | **Fehlerfrei** |

## Abgeschlossene Milestones

### Phase 0 (DoD: vollständig)
- Schema: `profiles`, `tracks`, `track_versions` ausgerollt
- SECURITY DEFINER RPCs: `create_track`, `save_track`, `rename_track`
- RLS: alle Tabellen, `revoke insert, update` von `anon`/`authenticated`
- Tier-System: Free (3 Strecken), Pro (50), Team (unbegrenzt)
- Satellite-Gate: Free abgelehnt, Pro erlaubt
- Übergangspolitik dokumentiert: `tier DEFAULT 'pro'` bis öffentliches Rollout

### Phase 3 — H0 Custom Formations (DoD: vollständig)
- Tabellen: `custom_formations`, `formation_shares`, `app_config`
- RPCs: `create_custom_formation`, `update_custom_formation`, `delete_custom_formation`,
  `find_shareable_user`, `share_custom_formation`, `unshare_custom_formation`
- Admin-RPCs: `admin_list_custom_formations`, `admin_get_custom_formation`,
  `admin_promote_to_library`, `admin_delete_custom_formation`, `admin_update_custom_formation`
- Premium-Gate: `app_config.custom_formations_required_tier` (null = offen, 'pro' = gesperrt)
- Fehler-Mapping: `PREMIUM_REQUIRED`, `FORMATION_LIMIT_REACHED`, `NOT_OWNER`, …
- Unit-Tests: 17 mapError-Tests

### Phase 3 — H1–H5 (DoD: vollständig)
- Formation Editor: BasisAuswahl, Cone-/Pfeil-Platzierung, Speichern/Laden
- Formation-Sharing: finden, teilen, entfernen
- Library-Formationen: is_library=true, anon-lesbar
- Admin-Ansichten: Strecken, Formationen, Nutzer
- Display-Name-Attributierung in Formation-Shares
- Account-Löschung: `delete_account_data` RPC, ON DELETE CASCADE

## Sicherheitsstatus

- Kein direktes `.insert()`/`.update()` vom Client — alle Schreibops via SECURITY DEFINER RPC
- Kein `select("*")` — explizite Spaltenlisten in `fetchTrack()`
- Keine `as never`-Casts in Typ-kritischen Pfaden
- CSP gehärtet, CORS-Allowlist statt `*`
- Tier-Manipulation auf `profiles` per RLS/REVOKE gesperrt
- Satellite-Gate: deterministischer Test mit explizitem Tier-Set (Free + Pro)

## Bekannte offene Punkte (geplant für Phase 2)

- Rate Limiting für Share-Links (noch nicht implementiert)
- Token-Widerruf für öffentliche Share-Links (noch nicht implementiert)
- Playwright-Smoke für Login, Cloud Save, Sharing, Export (noch nicht implementiert)
- `profiles.tier DEFAULT` vor öffentlichem Rollout von 'pro' auf 'free' ändern

## Git-Log (die 6 Commits vor diesem Stand)

```
8af2b5f Plan: profiles.tier DEFAULT korrigiert ('free' → 'pro' + Hinweis)
18cfd97 Security-Smoke deterministisch + navigate-Cast + SAAS_PLAN Mapbox
908eaa2 Satellite-Gate-Test deterministisch + Übergangspolitik dokumentiert
7795224 Review-Nachbesserungen: as never, fetchTrack, Karten-Plan, reset-dev
52925f7 Fix H2 integration tests + Phase 0 DoD abgeschlossen
4020220 Security & Qualität: display_name UI, CORS-Allowlist, CSP-Hardening, Node-Versionen
```
