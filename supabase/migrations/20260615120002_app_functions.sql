-- Phase 0.7 — SECURITY DEFINER Funktionen
-- Quelle: docs/planning/IMPLEMENTATION_PLAN.md Abschnitt 0.7
-- Diese Funktionen laufen mit Datenbankrechten und koennen daher REVOKE-Sperren
-- und RLS umgehen — aber nur kontrolliert und mit eigenen Pruefungen.

-- create_track — mit serverseitiger Limit-Pruefung
create or replace function public.create_track(track_name text default 'Neue Strecke')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tier    text;
  v_count   integer;
  v_limit   integer;
  v_new_id  uuid;
begin
  select tier into v_tier from public.profiles where id = auth.uid();

  v_limit := case v_tier
    when 'free' then 3
    when 'pro'  then 50
    when 'team' then 2147483647
    else 3
  end;

  select count(*) into v_count from public.tracks where owner_id = auth.uid();

  if v_count >= v_limit then
    raise exception 'track_limit_reached'
      using hint = v_tier, detail = v_limit::text;
  end if;

  insert into public.tracks (owner_id, name)
  values (auth.uid(), track_name)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_track(text) to authenticated;

-- save_track — mit Tier-Validierung
-- Kein direktes .update() vom Client — diese Funktion ist der einzige Weg einen Track zu speichern.
-- Sie prueft Ownership und verhindert Feature-Bypass (z. B. map_satellite = true fuer Free-User).
create or replace function public.save_track(
  p_track_id    uuid,
  p_state_json  jsonb,
  p_area_sel    jsonb,
  p_width       numeric,
  p_length      numeric,
  p_satellite   boolean,
  p_opacity     numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tier text;
begin
  -- Ownership pruefen — kein Zugriff auf fremde Tracks
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  select tier into v_tier from public.profiles where id = auth.uid();

  -- Satellite nur fuer Pro/Team
  if p_satellite = true and v_tier = 'free' then
    raise exception 'satellite_requires_pro';
  end if;

  update public.tracks set
    state_json    = p_state_json,
    area_sel_json = p_area_sel,
    manual_width  = p_width,
    manual_length = p_length,
    map_satellite = p_satellite,
    map_opacity   = p_opacity
  where id = p_track_id and owner_id = auth.uid();

  -- last_active_at direkt hier aktualisieren (kein separater RPC-Call noetig)
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.save_track(uuid, jsonb, jsonb, numeric, numeric, boolean, numeric)
  to authenticated;

-- touch_last_active — fuer Aktionen ohne save_track (z. B. Export)
create or replace function public.touch_last_active()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.touch_last_active() to authenticated;
