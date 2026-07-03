-- Phase 2: Versionshistorie — vollständiger Trackzustand + Sicherheitsverbesserungen
--
-- Änderungen gegenüber 20260703000002/000003:
--   1. track_versions um manual_width, manual_length, map_satellite, map_opacity erweitern
--   2. create_track_version: vollständigen State speichern + FOR UPDATE Race-Lock
--   3. restore_track_version: vollständigen State zurückschreiben
--   4. is_deleted-Prüfung in allen schreibenden und lesenden RPCs
--   5. get_track_versions / get_track_version_detail: is_deleted-Prüfung ergänzen

-- ── 1. Schema erweitern ─────────────────────────────────────────────────────────

alter table public.track_versions
  add column if not exists manual_width   numeric,
  add column if not exists manual_length  numeric,
  add column if not exists map_satellite  boolean,
  add column if not exists map_opacity    numeric;

-- ── 2. create_track_version (vollständig neu) ───────────────────────────────────

drop function if exists public.create_track_version(uuid);

create function public.create_track_version(p_track_id uuid)
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
  -- Aktiven Account sicherstellen
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'not_owner';
  end if;

  -- Track sperren (Race-Schutz für version_number-Berechnung)
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

  -- Tier-Limit prüfen
  if v_tier = 'free' then
    raise exception 'version_history_requires_pro';
  elsif v_tier = 'pro' then
    v_limit := 10;
  else
    v_limit := null; -- Team: unbegrenzt
  end if;

  -- Älteste Version löschen wenn Limit erreicht (gleitendes Fenster)
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

  -- Nächste Versionsnummer (sicher, weil Track-Zeile gesperrt ist)
  select coalesce(max(version_number), 0) + 1
    into v_next_no
    from public.track_versions
   where track_id = p_track_id;

  -- Vollständigen Snapshot einfügen
  insert into public.track_versions (
    track_id, version_number, state_json, area_sel_json,
    manual_width, manual_length, map_satellite, map_opacity,
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
    t.map_opacity,
    auth.uid()
  from public.tracks t
  where t.id = p_track_id
  returning id into v_version_id;

  return v_version_id;
end;
$$;

-- ── 3. restore_track_version (vollständig neu) ──────────────────────────────────

drop function if exists public.restore_track_version(uuid);

create function public.restore_track_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Aktiven Account sicherstellen
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'not_owner';
  end if;

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

  if not found then
    raise exception 'not_owner';
  end if;
end;
$$;

-- ── 4. delete_track_version (is_deleted-Prüfung ergänzen) ───────────────────────

drop function if exists public.delete_track_version(uuid);

create function public.delete_track_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'not_owner';
  end if;

  delete from public.track_versions v
   using public.tracks t
   where v.id       = p_version_id
     and v.track_id = t.id
     and t.owner_id = auth.uid();

  if not found then
    raise exception 'not_owner';
  end if;
end;
$$;

-- ── 5. get_track_versions (is_deleted-Prüfung ergänzen) ─────────────────────────

drop function if exists public.get_track_versions(uuid);

create function public.get_track_versions(p_track_id uuid)
returns table (id uuid, version_number integer, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select v.id, v.version_number, v.created_at
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    join public.profiles p on p.id = auth.uid()
   where v.track_id = p_track_id
     and t.owner_id = auth.uid()
     and p.is_deleted = false
   order by v.version_number desc;
$$;

-- ── 6. get_track_version_detail (is_deleted + vollständige Felder) ───────────────

drop function if exists public.get_track_version_detail(uuid);

create function public.get_track_version_detail(p_version_id uuid)
returns table (
  version_number integer,
  state_json     jsonb,
  area_sel_json  jsonb,
  manual_width   numeric,
  manual_length  numeric,
  map_satellite  boolean,
  map_opacity    numeric,
  created_at     timestamptz
)
language sql
security definer
set search_path = public
as $$
  select v.version_number, v.state_json, v.area_sel_json,
         v.manual_width, v.manual_length, v.map_satellite, v.map_opacity,
         v.created_at
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    join public.profiles p on p.id = auth.uid()
   where v.id       = p_version_id
     and t.owner_id = auth.uid()
     and p.is_deleted = false;
$$;
