-- Phase 2: Versionshistorie — explizite RPC-Berechtigungen
--
-- PostgreSQL erteilt nach DROP FUNCTION + CREATE FUNCTION standardmäßig
-- EXECUTE für PUBLIC. Frühere REVOKE-Statements gehen dabei verloren.
-- Dieses Skript stellt das Least-Privilege-Modell explizit wieder her:
-- nur authenticated darf die Versions-RPCs aufrufen.

revoke execute on function public.create_track_version(uuid)    from public, anon;
revoke execute on function public.get_track_versions(uuid)      from public, anon;
revoke execute on function public.get_track_version_detail(uuid) from public, anon;
revoke execute on function public.restore_track_version(uuid)   from public, anon;
revoke execute on function public.delete_track_version(uuid)    from public, anon;

grant execute on function public.create_track_version(uuid)    to authenticated;
grant execute on function public.get_track_versions(uuid)      to authenticated;
grant execute on function public.get_track_version_detail(uuid) to authenticated;
grant execute on function public.restore_track_version(uuid)   to authenticated;
grant execute on function public.delete_track_version(uuid)    to authenticated;
