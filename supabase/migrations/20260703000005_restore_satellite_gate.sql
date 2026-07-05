-- Phase 2: Versionshistorie — Satellite-Gate beim Restore
--
-- Problem: restore_track_version() schrieb map_satellite aus dem Snapshot
-- direkt zurück ohne den aktuellen Tier zu prüfen. Ein ehemaliger Pro-User
-- (jetzt Free) konnte damit das Satellite-Feature-Gate umgehen.
--
-- Fix: Tier des aufrufenden Users laden. Wenn der Snapshot map_satellite=true
-- enthält und der User aktuell Free ist → satellite_requires_pro.

drop function if exists public.restore_track_version(uuid);

create function public.restore_track_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier               text;
  v_snapshot_satellite boolean;
begin
  -- 1. Profil laden: is_deleted + aktueller Tier
  select p.tier
    into v_tier
    from public.profiles p
   where p.id = auth.uid()
     and p.is_deleted = false;
  if not found then
    raise exception 'not_owner';
  end if;

  -- 2. Snapshot-Ownership prüfen + Satellite-Wert lesen
  select v.map_satellite
    into v_snapshot_satellite
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
   where v.id       = p_version_id
     and t.owner_id = auth.uid();
  if not found then
    raise exception 'not_owner';
  end if;

  -- 3. Satellite-Gate: Free-User darf keinen Satellite-Snapshot restaurieren
  if coalesce(v_snapshot_satellite, false) and v_tier = 'free' then
    raise exception 'satellite_requires_pro';
  end if;

  -- 4. Restore (ownership erneut im WHERE — defense in depth)
  update public.tracks t
     set state_json    = v.state_json,
         area_sel_json = v.area_sel_json,
         manual_width  = coalesce(v.manual_width,  t.manual_width),
         manual_length = coalesce(v.manual_length, t.manual_length),
         map_satellite = coalesce(v.map_satellite, t.map_satellite),
         map_opacity   = coalesce(v.map_opacity,   t.map_opacity),
         updated_at    = now()
    from public.track_versions v
   where v.id       = p_version_id
     and v.track_id = t.id
     and t.owner_id = auth.uid();
end;
$$;
