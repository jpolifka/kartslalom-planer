-- P1 Security Fix: is_deleted=false in allen schreibenden RPCs erzwingen
-- Ein soft-deleteter User mit aktiver Session darf keine Tracks mehr anlegen oder speichern.

create or replace function public.create_track(track_name text default 'Neue Strecke')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tier    text;
  v_count   integer;
  v_limit   integer;
  v_new_id  uuid;
begin
  select tier into v_tier
  from public.profiles
  where id = auth.uid()
    and is_deleted = false;

  if v_tier is null then
    raise exception 'account_deleted';
  end if;

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
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  select tier into v_tier
  from public.profiles
  where id = auth.uid()
    and is_deleted = false;

  if v_tier is null then
    raise exception 'account_deleted';
  end if;

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

  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;
