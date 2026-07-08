-- Commit 7 der Kartenanbieter-Abstraktion (Nachfolger von
-- 20260706000002_map_provider_id_persistence.sql): löst die dort bewusst
-- übergangsweise beibehaltene map_satellite-Spalte ab. map_provider_id ist
-- seit Commit 3 (src/lib/mapProviders.ts / mapRender.ts) die für das
-- Rendering maßgebliche Spalte und wurde seither von jeder schreibenden RPC
-- synchron zu map_satellite gehalten — map_satellite trägt also keine
-- zusätzliche Information mehr und wird hier entfernt.
--
-- 'satellite_requires_pro' wird zu 'map_provider_requires_pro' (generischer
-- Name — gilt für jeden Pro-pflichtigen Kartenanbieter, nicht nur "Satellit").

-- ── 1. Spalten entfernen ─────────────────────────────────────────────────────

alter table public.tracks
  drop column map_satellite;

alter table public.track_versions
  drop column map_satellite;

-- ── 2. save_track: p_satellite → p_map_provider_id ──────────────────────────
-- Parametername ändert sich → DROP+CREATE nötig (CREATE OR REPLACE erlaubt
-- keine Umbenennung von Parametern). save_track hat keine gesonderte
-- REVOKE/GRANT-Härtung wie die Versions-RPCs, daher unproblematisch.

drop function if exists public.save_track(uuid, jsonb, jsonb, numeric, numeric, boolean, numeric);

create function public.save_track(
  p_track_id        uuid,
  p_state_json      jsonb,
  p_area_sel        jsonb,
  p_width           numeric,
  p_length          numeric,
  p_map_provider_id text,
  p_opacity         numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tier text;
begin
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  if p_map_provider_id not in ('osm', 'rlp_dop20') then
    raise exception 'invalid_map_provider_id';
  end if;

  select tier into v_tier
  from public.profiles
  where id = auth.uid()
    and is_deleted = false;

  if v_tier is null then
    raise exception 'account_deleted';
  end if;

  if p_map_provider_id <> 'osm' and v_tier = 'free' then
    raise exception 'map_provider_requires_pro';
  end if;

  update public.tracks set
    state_json      = p_state_json,
    area_sel_json   = p_area_sel,
    manual_width    = p_width,
    manual_length   = p_length,
    map_provider_id = p_map_provider_id,
    map_opacity     = p_opacity
  where id = p_track_id and owner_id = auth.uid();

  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.save_track(uuid, jsonb, jsonb, numeric, numeric, text, numeric) to authenticated;

-- ── 3. create_track_version: map_satellite aus Insert/Select entfernen ─────
-- Signatur unverändert → CREATE OR REPLACE erhält die REVOKE/GRANT-Härtung
-- aus 20260703000006_version_rpc_permissions.sql.

create or replace function public.create_track_version(p_track_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier        text;
  v_limit       integer;
  v_next_no     integer;
  v_version_id  uuid;
  v_track       record;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'not_owner';
  end if;

  select t.*, p.tier
    into v_track
    from public.tracks t
    join public.profiles p on p.id = auth.uid()
   where t.id = p_track_id
     and t.owner_id = auth.uid()
    for update;

  if not found then
    raise exception 'not_owner';
  end if;

  v_tier := v_track.tier;

  if v_tier = 'free' then
    raise exception 'version_history_requires_pro';
  elsif v_tier = 'pro' then
    v_limit := 10;
  else
    v_limit := null;
  end if;

  if v_limit is not null then
    if (select count(*) from public.track_versions where track_id = p_track_id) >= v_limit then
      delete from public.track_versions
       where id = (
         select id from public.track_versions
          where track_id = p_track_id
          order by version_number asc
          limit 1
       );
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_no
    from public.track_versions
   where track_id = p_track_id;

  insert into public.track_versions (
    track_id, version_number, state_json, area_sel_json,
    manual_width, manual_length, map_provider_id, map_opacity,
    created_by
  )
  select
    p_track_id,
    v_next_no,
    t.state_json,
    t.area_sel_json,
    t.manual_width,
    t.manual_length,
    t.map_provider_id,
    t.map_opacity,
    auth.uid()
  from public.tracks t
  where t.id = p_track_id
  returning id into v_version_id;

  return v_version_id;
end;
$$;

-- ── 4. restore_track_version: Gate über map_provider_id statt map_satellite ─
-- Signatur unverändert → CREATE OR REPLACE.

create or replace function public.restore_track_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier                  text;
  v_snapshot_provider_id  text;
begin
  select p.tier
    into v_tier
    from public.profiles p
   where p.id = auth.uid()
     and p.is_deleted = false;
  if not found then
    raise exception 'not_owner';
  end if;

  select v.map_provider_id
    into v_snapshot_provider_id
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
   where v.id       = p_version_id
     and t.owner_id = auth.uid();
  if not found then
    raise exception 'not_owner';
  end if;

  if coalesce(v_snapshot_provider_id, 'osm') <> 'osm' and v_tier = 'free' then
    raise exception 'map_provider_requires_pro';
  end if;

  update public.tracks t
     set state_json      = v.state_json,
         area_sel_json   = v.area_sel_json,
         manual_width    = coalesce(v.manual_width,  t.manual_width),
         manual_length   = coalesce(v.manual_length, t.manual_length),
         map_provider_id = coalesce(v.map_provider_id, t.map_provider_id),
         map_opacity     = coalesce(v.map_opacity,   t.map_opacity),
         updated_at      = now()
    from public.track_versions v
   where v.id       = p_version_id
     and v.track_id = t.id
     and t.owner_id = auth.uid();
end;
$$;

-- ── 5. create_track_from_version: Gate + Insert über map_provider_id ───────
-- Signatur unverändert → CREATE OR REPLACE.

create or replace function public.create_track_from_version(p_version_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier            text;
  v_limit           integer;
  v_count           integer;
  v_state_json      jsonb;
  v_area_sel_json   jsonb;
  v_manual_width    numeric;
  v_manual_length   numeric;
  v_map_provider_id text;
  v_map_opacity     numeric;
  v_final_name      text;
  v_new_id          uuid;
begin
  select p.tier
    into v_tier
    from public.profiles p
   where p.id = auth.uid()
     and p.is_deleted = false
   for update;
  if not found then
    raise exception 'not_owner';
  end if;

  select v.state_json, v.area_sel_json,
         v.manual_width, v.manual_length, v.map_provider_id, v.map_opacity
    into v_state_json, v_area_sel_json,
         v_manual_width, v_manual_length, v_map_provider_id, v_map_opacity
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
   where v.id       = p_version_id
     and t.owner_id = auth.uid();
  if not found then
    raise exception 'not_owner';
  end if;

  if coalesce(v_map_provider_id, 'osm') <> 'osm' and v_tier = 'free' then
    raise exception 'map_provider_requires_pro';
  end if;

  if p_name is not null and length(trim(p_name)) > 100 then
    raise exception 'invalid_name';
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

  v_final_name := coalesce(nullif(trim(p_name), ''), 'Neue Strecke');

  insert into public.tracks (
    owner_id, name, state_json, area_sel_json,
    manual_width, manual_length, map_provider_id, map_opacity
  )
  values (
    auth.uid(), v_final_name, v_state_json, v_area_sel_json,
    coalesce(v_manual_width, 18), coalesce(v_manual_length, 36),
    coalesce(v_map_provider_id, 'osm'),
    coalesce(v_map_opacity, 0.5)
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ── 6. get_track_version_detail: map_satellite aus RETURNS TABLE entfernen ──
-- Spaltenliste ändert sich → DROP+CREATE nötig; REVOKE/GRANT danach explizit
-- wiederhergestellt (Postgres vergibt nach DROP+CREATE wieder EXECUTE an
-- PUBLIC, siehe 20260703000006_version_rpc_permissions.sql /
-- 20260706000002_map_provider_id_persistence.sql für das gleiche Muster).

drop function if exists public.get_track_version_detail(uuid);

create function public.get_track_version_detail(p_version_id uuid)
returns table (
  version_number   integer,
  state_json       jsonb,
  area_sel_json    jsonb,
  manual_width     numeric,
  manual_length    numeric,
  map_provider_id  text,
  map_opacity      numeric,
  created_at       timestamptz
)
language sql
security definer
set search_path = public
as $$
  select v.version_number, v.state_json, v.area_sel_json,
         v.manual_width, v.manual_length, v.map_provider_id, v.map_opacity,
         v.created_at
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    join public.profiles p on p.id = auth.uid()
   where v.id       = p_version_id
     and t.owner_id = auth.uid()
     and p.is_deleted = false;
$$;

revoke execute on function public.get_track_version_detail(uuid) from public, anon;
grant execute on function public.get_track_version_detail(uuid) to authenticated;
