-- Red-Team-Review 2026-07-13: RPC-Berechtigungen systematisch härten
--
-- Ursache (verifiziert gegen den lokalen Docker-Stack, siehe pg_default_acl):
-- Dieses self-hosted Setup führt App-Migrationen als Rolle `supabase_admin`
-- aus (docker/supabase/migrate.sh). Ein Init-Skript des Basis-Images
-- (supabase/postgres) hat für diese Rolle bereits
-- `alter default privileges in schema public grant execute on functions
-- to postgres, anon, authenticated, service_role` gesetzt. Jede neu
-- angelegte Funktion in `public` bekommt dadurch automatisch EXECUTE für
-- `anon` — unabhängig davon, ob die einzelne Migration einen eigenen
-- `grant ... to authenticated` gesetzt hat. Das ist NICHT der generische
-- PostgreSQL-PUBLIC-Default (den es hier separat gar nicht gibt), sondern
-- eine rollen-spezifische Default-Privilege-Regel — ein REVOKE ... FROM
-- PUBLIC allein greift hier nicht, siehe Korrektur unten.
--
-- Betroffen waren u. a. create_track_share_link, revoke_track_share_link,
-- find_shareable_user und sämtliche admin_*-RPCs: alle verlassen sich zwar
-- korrekt auf interne auth.uid()-/Owner-/Rollen-Prüfungen (kein bekannter
-- Datenabfluss), sind aber zusätzlich für anon direkt aufrufbar — unnötige
-- Angriffsfläche.
--
-- 1) Entzieht den Default für KÜNFTIGE Funktionen (nur `anon`; `authenticated`
--    bleibt Default, da praktisch jede RPC ohnehin für eingeloggte Nutzer
--    gedacht ist).
-- 2) Entzieht `anon` EXECUTE auf ALLEN bestehenden Funktionen in `public`.
-- 3) Stellt den Zugriff für die zwei bewusst öffentlichen RPCs explizit
--    wieder her.

alter default privileges in schema public revoke execute on functions from anon;

revoke execute on all functions in schema public from anon;

grant execute on function public.get_library_formations() to anon;
grant execute on function public.get_track_by_share_token(text) to anon;
