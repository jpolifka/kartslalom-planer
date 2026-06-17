-- Phase 0.6 — Row Level Security
-- Quelle: docs/planning/IMPLEMENTATION_PLAN.md Abschnitt 0.6
-- Kernregel: Client darf nur lesen. Alle Schreiboperationen gehen durch SECURITY DEFINER Funktionen.

alter table public.profiles      enable row level security;
alter table public.tracks        enable row level security;
alter table public.track_versions enable row level security;

-- profiles — nur lesen, kein direktes Schreiben
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- Kein UPDATE-Policy. tier, is_deleted nur via service_role / Funktionen.
-- last_active_at via touch_last_active() (SECURITY DEFINER, s. u.)

-- tracks — direktes INSERT und UPDATE gesperrt, nur via RPC

-- Lesen: nur eigene Tracks
create policy "tracks_select_own" on public.tracks
  for select using (auth.uid() = owner_id);

-- Loeschen: nur eigene Tracks (kein Feature-Bypass moeglich, RLS reicht)
create policy "tracks_delete_own" on public.tracks
  for delete using (auth.uid() = owner_id);

-- INSERT und UPDATE fuer authenticated und anon sperren
-- Erstellen laeuft via create_track() RPC
-- Speichern laeuft via save_track() RPC
revoke insert, update on public.tracks from anon, authenticated;

-- Kein oeffentliches SELECT via is_public — Zugriff nur via get_track_by_share_token() RPC (Phase 2)

-- track_versions — alles via SECURITY DEFINER
create policy "versions_select_own" on public.track_versions
  for select using (
    exists (select 1 from public.tracks t
            where t.id = track_id and t.owner_id = auth.uid())
  );

revoke insert, update on public.track_versions from anon, authenticated;
