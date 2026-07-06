-- Commit 2/6 der Kartenanbieter-Abstraktion (siehe src/lib/mapProviders.ts,
-- Commit 1, und Roadmap-Notizen zum Esri-Ersatz durch RLP-DOP20).
--
-- Ersetzt das boolesche map_satellite perspektivisch durch map_provider_id
-- (text, 'osm' | 'rlp_dop20'). Reine Persistenzmigration ohne Verhaltens-
-- aenderung: map_satellite bleibt bestehen und bleibt die fuer das Rendering
-- massgebliche Spalte, bis Commit 3 die tatsaechliche RLP-DOP20-Anbindung
-- liefert und die Leseseite auf map_provider_id umstellt. Bis dahin haelt
-- jede schreibende RPC beide Spalten synchron (map_satellite=true <=>
-- map_provider_id='rlp_dop20' — bewusst nicht 'esri', Esri wird in Commit 5
-- entfernt und war nie ein persistierter Wert).

-- ── 1. tracks.map_provider_id ────────────────────────────────────────────────

alter table public.tracks
  add column map_provider_id text not null default 'osm';

update public.tracks
   set map_provider_id = case when map_satellite then 'rlp_dop20' else 'osm' end;

alter table public.tracks
  add constraint tracks_map_provider_id_check
  check (map_provider_id in ('osm', 'rlp_dop20'));

comment on column public.tracks.map_satellite is
  'Deprecated ab map_provider_id (20260706000002) - wird in Commit 5 der '
  'Kartenanbieter-Abstraktion entfernt. Bis dahin von allen schreibenden '
  'RPCs synchron zu map_provider_id gehalten.';

-- ── 2. track_versions.map_provider_id ────────────────────────────────────────

alter table public.track_versions
  add column map_provider_id text;

update public.track_versions
   set map_provider_id = case when map_satellite then 'rlp_dop20' else 'osm' end
 where map_provider_id is null;

alter table public.track_versions
  add constraint track_versions_map_provider_id_check
  check (map_provider_id is null or map_provider_id in ('osm', 'rlp_dop20'));

-- ── 3. save_track: map_provider_id aus p_satellite ableiten ─────────────────

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
    state_json      = p_state_json,
    area_sel_json   = p_area_sel,
    manual_width    = p_width,
    manual_length   = p_length,
    map_satellite   = p_satellite,
    map_provider_id = case when p_satellite then 'rlp_dop20' else 'osm' end,
    map_opacity     = p_opacity
  where id = p_track_id and owner_id = auth.uid();

  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

-- ── 4. create_track_version: map_provider_id mit in den Snapshot übernehmen ──
-- CREATE OR REPLACE (nicht DROP+CREATE): Signatur/Rückgabetyp unverändert,
-- damit bleiben die in 20260703000006_version_rpc_permissions.sql gesetzten
-- REVOKE/GRANT-Zustände erhalten (DROP+CREATE würde EXECUTE wieder an
-- PUBLIC vergeben, siehe Kommentar dort).

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
    manual_width, manual_length, map_satellite, map_provider_id, map_opacity,
    created_by
  )
  select
    p_track_id,
    v_next_no,
    t.state_json,
    t.area_sel_json,
    t.manual_width,
    t.manual_length,
    t.map_satellite,
    t.map_provider_id,
    t.map_opacity,
    auth.uid()
  from public.tracks t
  where t.id = p_track_id
  returning id into v_version_id;

  return v_version_id;
end;
$$;

-- ── 5. restore_track_version: map_provider_id mit zurückschreiben ───────────
-- (Basis: 20260703000005_restore_satellite_gate.sql, Satellite-Gate bleibt)
-- CREATE OR REPLACE aus demselben Grund wie oben (Signatur unverändert).

create or replace function public.restore_track_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier               text;
  v_snapshot_satellite boolean;
begin
  select p.tier
    into v_tier
    from public.profiles p
   where p.id = auth.uid()
     and p.is_deleted = false;
  if not found then
    raise exception 'not_owner';
  end if;

  select v.map_satellite
    into v_snapshot_satellite
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
   where v.id       = p_version_id
     and t.owner_id = auth.uid();
  if not found then
    raise exception 'not_owner';
  end if;

  if coalesce(v_snapshot_satellite, false) and v_tier = 'free' then
    raise exception 'satellite_requires_pro';
  end if;

  update public.tracks t
     set state_json      = v.state_json,
         area_sel_json   = v.area_sel_json,
         manual_width    = coalesce(v.manual_width,  t.manual_width),
         manual_length   = coalesce(v.manual_length, t.manual_length),
         map_satellite   = coalesce(v.map_satellite, t.map_satellite),
         map_provider_id = coalesce(v.map_provider_id, t.map_provider_id),
         map_opacity     = coalesce(v.map_opacity,   t.map_opacity),
         updated_at      = now()
    from public.track_versions v
   where v.id       = p_version_id
     and v.track_id = t.id
     and t.owner_id = auth.uid();
end;
$$;

-- ── 6. create_track_from_version: map_provider_id in den neuen Track übernehmen ──
-- (Basis: 20260703000007_create_track_from_version.sql)

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
  v_map_satellite   boolean;
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
         v.manual_width, v.manual_length, v.map_satellite, v.map_provider_id, v.map_opacity
    into v_state_json, v_area_sel_json,
         v_manual_width, v_manual_length, v_map_satellite, v_map_provider_id, v_map_opacity
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
   where v.id       = p_version_id
     and t.owner_id = auth.uid();
  if not found then
    raise exception 'not_owner';
  end if;

  if coalesce(v_map_satellite, false) and v_tier = 'free' then
    raise exception 'satellite_requires_pro';
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
    manual_width, manual_length, map_satellite, map_provider_id, map_opacity
  )
  values (
    auth.uid(), v_final_name, v_state_json, v_area_sel_json,
    coalesce(v_manual_width, 18), coalesce(v_manual_length, 36),
    coalesce(v_map_satellite, false),
    coalesce(v_map_provider_id, case when coalesce(v_map_satellite, false) then 'rlp_dop20' else 'osm' end),
    coalesce(v_map_opacity, 0.5)
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ── 7. get_track_version_detail: map_provider_id mit ausliefern ─────────────
-- RETURNS-TABLE-Spaltenliste ändert sich hier tatsächlich (neue Spalte) —
-- CREATE OR REPLACE lässt Postgres das nicht zu, also DROP+CREATE nötig.
-- Damit geht die REVOKE/GRANT-Absicherung aus
-- 20260703000006_version_rpc_permissions.sql verloren (Postgres vergibt nach
-- DROP+CREATE wieder EXECUTE an PUBLIC) — unten explizit wiederhergestellt.

drop function if exists public.get_track_version_detail(uuid);

create function public.get_track_version_detail(p_version_id uuid)
returns table (
  version_number   integer,
  state_json       jsonb,
  area_sel_json    jsonb,
  manual_width     numeric,
  manual_length    numeric,
  map_satellite    boolean,
  map_provider_id  text,
  map_opacity      numeric,
  created_at       timestamptz
)
language sql
security definer
set search_path = public
as $$
  select v.version_number, v.state_json, v.area_sel_json,
         v.manual_width, v.manual_length, v.map_satellite, v.map_provider_id, v.map_opacity,
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
