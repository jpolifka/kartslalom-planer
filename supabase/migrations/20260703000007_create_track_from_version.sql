-- Phase 2: Versionshistorie — "Speichern unter" (Save As)
--
-- Problem: restore_track_version() überschreibt immer den bestehenden Track.
-- Nutzer wollen einen alten Snapshot manchmal stattdessen als NEUEN,
-- eigenständigen Track übernehmen, ohne den Ursprungstrack zu verändern
-- (z. B. um zwei Varianten parallel weiterzuentwickeln).
--
-- create_track_from_version() kombiniert drei bereits etablierte Muster:
--   - Ownership/Account/Tier-Check + Satellite-Gate wie restore_track_version
--     (20260703000005_restore_satellite_gate.sql)
--   - Tier-Limit-Check wie create_track (20260615120002_app_functions.sql)
--   - Copy-in-neue-Zeile wie duplicate_custom_formation
--     (20260701000001_h3_completion.sql)

create or replace function public.create_track_from_version(p_version_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier          text;
  v_limit         integer;
  v_count         integer;
  v_state_json    jsonb;
  v_area_sel_json jsonb;
  v_manual_width  numeric;
  v_manual_length numeric;
  v_map_satellite boolean;
  v_map_opacity   numeric;
  v_final_name    text;
  v_new_id        uuid;
begin
  -- 1. Aktiven Account sicherstellen + Tier laden
  select p.tier
    into v_tier
    from public.profiles p
   where p.id = auth.uid()
     and p.is_deleted = false;
  if not found then
    raise exception 'not_owner';
  end if;

  -- 2. Snapshot laden + Ownership über den Ursprungstrack prüfen (defense in depth,
  --    genau wie bei restore_track_version — der Aufrufer muss den Track besitzen,
  --    aus dessen Historie die Version stammt, nicht nur die Version selbst)
  select v.state_json, v.area_sel_json,
         v.manual_width, v.manual_length, v.map_satellite, v.map_opacity
    into v_state_json, v_area_sel_json,
         v_manual_width, v_manual_length, v_map_satellite, v_map_opacity
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
   where v.id       = p_version_id
     and t.owner_id = auth.uid();
  if not found then
    raise exception 'not_owner';
  end if;

  -- 3. Satellite-Gate: Free-User darf keinen Satellite-Snapshot als neuen Track
  --    übernehmen (identisch zum Restore-Gate, verhindert Feature-Bypass bei Downgrade)
  if coalesce(v_map_satellite, false) and v_tier = 'free' then
    raise exception 'satellite_requires_pro';
  end if;

  -- 4. Tier-Limit für die Gesamtzahl an Tracks prüfen (gleiche Grenzen wie create_track)
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

  -- 5. Name serverseitig absichern — Client-Eingabe nicht blind vertrauen
  --    (leerer/Whitespace-Name fällt auf den Standard-Namen zurück statt einen
  --    unbenannten Track anzulegen)
  v_final_name := coalesce(nullif(trim(p_name), ''), 'Neue Strecke');

  -- 6. Neuen Track aus dem Snapshot anlegen. Kein FOR UPDATE-Lock nötig:
  --    anders als bei create_track_version wird hier kein gemeinsamer Zähler
  --    (version_number) mutiert, nur eine neue, unabhängige Zeile eingefügt.
  --    manual_width/manual_length/map_satellite/map_opacity sind in
  --    track_versions nullable (ältere Snapshots vor 20260703000004 haben sie
  --    nicht) — coalesce auf die tracks-Defaults verhindert NULL in den
  --    NOT NULL-Spalten der Zieltabelle.
  insert into public.tracks (
    owner_id, name, state_json, area_sel_json,
    manual_width, manual_length, map_satellite, map_opacity
  )
  values (
    auth.uid(), v_final_name, v_state_json, v_area_sel_json,
    coalesce(v_manual_width, 18), coalesce(v_manual_length, 36),
    coalesce(v_map_satellite, false), coalesce(v_map_opacity, 0.5)
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Least-Privilege: nur authenticated darf diese RPC aufrufen (CREATE FUNCTION
-- erteilt PUBLIC standardmäßig EXECUTE zurück, siehe 20260703000006).
revoke execute on function public.create_track_from_version(uuid, text) from public, anon;
grant  execute on function public.create_track_from_version(uuid, text) to authenticated;
