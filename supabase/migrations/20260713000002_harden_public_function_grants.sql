-- Red-Team-Review 2026-07-13: RPC-Berechtigungen systematisch härten
--
-- Ursache (verifiziert gegen den lokalen Docker-Stack via
-- has_function_privilege() und direkter pg_proc.proacl-Inspektion): ZWEI sich
-- überlagernde Mechanismen gaben anon EXECUTE auf praktisch jede Funktion in
-- `public`:
--
-- 1) Dieses self-hosted Setup führt App-Migrationen als Rolle
--    `supabase_admin` aus (docker/supabase/migrate.sh). Ein Init-Skript des
--    Basis-Images (supabase/postgres) hat für diese Rolle
--    `alter default privileges in schema public grant execute on functions
--    to postgres, anon, authenticated, service_role` gesetzt.
-- 2) UNABHÄNGIG davon greift PostgreSQLs eingebauter Funktions-Default
--    (PUBLIC bekommt EXECUTE) ZUSÄTZLICH bei jedem CREATE FUNCTION — direkt
--    nach dem Anlegen, noch vor jedem expliziten GRANT, enthält proacl
--    bereits einen Public-Eintrag (`=X/supabase_admin`). Jede Rolle
--    (inklusive anon) ist implizit Mitglied von PUBLIC.
--
-- KORREKTUR (2. Runde, nach externem Review): Die erste Fassung dieser
-- Migration hat nur `anon` explizit revoked, nicht `public`. Dadurch blieb
-- der PUBLIC-Eintrag aus (2) unangetastet stehen — anon erbte EXECUTE
-- weiterhin über die PUBLIC-Mitgliedschaft, der eigentliche Fund war NICHT
-- behoben. Ein vorheriger Kommentar hier behauptete fälschlich, der
-- generische PostgreSQL-PUBLIC-Default existiere in diesem Setup nicht —
-- das stimmt nicht: ein fehlender/geänderter pg_default_acl-Eintrag für eine
-- bestimmte Rolle verhindert nicht, dass PostgreSQLs eingebauter Default
-- (PUBLIC=EXECUTE) beim Anlegen trotzdem zusätzlich angewendet wird.
--
-- Betroffen waren u. a. create_track_share_link, revoke_track_share_link,
-- find_shareable_user und sämtliche admin_*-RPCs: alle verlassen sich zwar
-- korrekt auf interne auth.uid()-/Owner-/Rollen-Prüfungen (kein bekannter
-- Datenabfluss), waren aber zusätzlich für anon direkt aufrufbar — unnötige
-- Angriffsfläche.
--
-- 1) Entzieht den Default für KÜNFTIGE Funktionen (PUBLIC und `anon`;
--    `authenticated` bleibt Default, da praktisch jede RPC ohnehin für
--    eingeloggte Nutzer gedacht ist).
-- 2) Entzieht PUBLIC und `anon` EXECUTE auf ALLEN bestehenden Funktionen in
--    `public`.
-- 3) Stellt den Zugriff für die zwei bewusst öffentlichen RPCs explizit
--    wieder her.
--
-- Verifikation (Erwartung: nur die zwei Zeilen unten liefern `t` für
-- anon_can_execute):
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' order by p.proname;

alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on all functions in schema public from public, anon;

grant execute on function public.get_library_formations() to anon;
grant execute on function public.get_track_by_share_token(text) to anon;
