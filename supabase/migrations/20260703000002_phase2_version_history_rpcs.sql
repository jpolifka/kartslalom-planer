-- Phase 2 — Versionshistorie: SECURITY DEFINER RPCs
-- Tabelle track_versions existiert bereits (20260615120000_app_schema.sql).
-- Direkter Schreibzugriff ist bereits gesperrt (revoke insert, update ... from anon, authenticated).
-- Hier: RPCs fuer Erstellen, Lesen, Wiederherstellen und Loeschen von Versionen.
--
-- Tier-Limits: Free = 0 (keine Versionshistorie), Pro = 10, Team = unbegrenzt.

-- Revoke delete ebenfalls sperren (konsistent mit insert/update)
revoke delete on public.track_versions from anon, authenticated;

-- create_track_version — Snapshot der aktuellen Strecke speichern
-- Prueft Tier-Limit, legt neuen Eintrag mit naechster version_number an.
create or replace function public.create_track_version(p_track_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tier        text;
  v_is_deleted  boolean;
  v_limit       integer;
  v_count       integer;
  v_next_num    integer;
  v_state_json  jsonb;
  v_area_sel    jsonb;
  v_new_id      uuid;
begin
  -- Auth-Check
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Profil laden
  select tier, is_deleted into v_tier, v_is_deleted
    from public.profiles where id = auth.uid();
  if v_is_deleted then
    raise exception 'account_deleted';
  end if;

  -- Ownership pruefen
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  -- Tier-Limit bestimmen
  v_limit := case v_tier
    when 'free' then 0
    when 'pro'  then 10
    when 'team' then 2147483647
    else 0
  end;

  if v_limit = 0 then
    raise exception 'version_history_requires_pro';
  end if;

  -- Aktuelle Versionsanzahl pruefen
  select count(*) into v_count
    from public.track_versions where track_id = p_track_id;

  if v_count >= v_limit then
    -- Aelteste Version loeschen um Platz zu machen (gleitendes Fenster)
    delete from public.track_versions
      where id = (
        select id from public.track_versions
        where track_id = p_track_id
        order by version_number asc
        limit 1
      );
  end if;

  -- Naechste version_number
  select coalesce(max(version_number), 0) + 1 into v_next_num
    from public.track_versions where track_id = p_track_id;

  -- Aktuellen Stand lesen
  select state_json, area_sel_json into v_state_json, v_area_sel
    from public.tracks where id = p_track_id;

  -- Version speichern
  insert into public.track_versions (track_id, version_number, state_json, area_sel_json, created_by)
  values (p_track_id, v_next_num, v_state_json, v_area_sel, auth.uid())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_track_version(uuid) to authenticated;

-- get_track_versions — Versionsliste einer Strecke abrufen
create or replace function public.get_track_versions(p_track_id uuid)
returns table (
  id             uuid,
  version_number integer,
  created_at     timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  return query
    select v.id, v.version_number, v.created_at
      from public.track_versions v
      where v.track_id = p_track_id
      order by v.version_number desc;
end;
$$;

grant execute on function public.get_track_versions(uuid) to authenticated;

-- restore_track_version — Version als aktuellen Stand wiederherstellen
-- Ueberschreibt state_json und area_sel_json der Strecke.
create or replace function public.restore_track_version(p_version_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_track_id    uuid;
  v_state_json  jsonb;
  v_area_sel    jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Version laden und Ownership via Track-Join pruefen
  select v.track_id, v.state_json, v.area_sel_json
    into v_track_id, v_state_json, v_area_sel
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    where v.id = p_version_id and t.owner_id = auth.uid();

  if v_track_id is null then
    raise exception 'not_owner';
  end if;

  update public.tracks set
    state_json    = v_state_json,
    area_sel_json = v_area_sel
  where id = v_track_id and owner_id = auth.uid();
end;
$$;

grant execute on function public.restore_track_version(uuid) to authenticated;

-- delete_track_version — einzelne Version loeschen
create or replace function public.delete_track_version(p_version_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_track_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select v.track_id into v_track_id
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    where v.id = p_version_id and t.owner_id = auth.uid();

  if v_track_id is null then
    raise exception 'not_owner';
  end if;

  delete from public.track_versions where id = p_version_id;
end;
$$;

grant execute on function public.delete_track_version(uuid) to authenticated;

-- get_track_version_detail — Snapshot-Inhalt fuer Vorschau im Editor laden
-- Gibt state_json + area_sel_json einer spezifischen Version zurueck.
create or replace function public.get_track_version_detail(p_version_id uuid)
returns table (
  version_number integer,
  state_json     jsonb,
  area_sel_json  jsonb,
  created_at     timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  return query
    select v.version_number, v.state_json, v.area_sel_json, v.created_at
      from public.track_versions v
      join public.tracks t on t.id = v.track_id
      where v.id = p_version_id and t.owner_id = auth.uid();
end;
$$;

grant execute on function public.get_track_version_detail(uuid) to authenticated;
