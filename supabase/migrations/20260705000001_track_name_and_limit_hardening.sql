-- Phase 2: Härtung nach Review von v2.1.0 ("Speichern unter")
--
-- Zwei Funde:
--   1. Trackname wird serverseitig nirgends in der Länge begrenzt (create_track,
--      rename_track, create_track_from_version) — ein authentifizierter Nutzer
--      könnte beliebig lange Namen speichern (Datenintegrität/Missbrauch, kein
--      Berechtigungs-Bypass).
--   2. Tier-Limit-Prüfung (count-dann-insert) ist nicht race-sicher: zwei
--      parallele Aufrufe können denselben Count sehen und beide einfügen,
--      wodurch das Limit unter Parallelzugriff überschritten werden kann
--      (betrifft create_track und create_track_from_version).
--
-- Fix 1: length(trim(name)) > 100 → 'invalid_name', einheitlich in allen drei
-- namensverarbeitenden RPCs.
-- Fix 2: `select ... from profiles where id = auth.uid() for update` sperrt
-- die Profilzeile des Users für die Transaktionsdauer — ein zweiter paralleler
-- Aufruf desselben Users wartet, bis der erste committed hat, und sieht danach
-- den aktualisierten Count. Serialisiert nur pro User (kein globaler Lock).
--
-- CREATE OR REPLACE FUNCTION (statt DROP+CREATE) behält bestehende
-- GRANT/REVOKE-Zustände bei — kein erneutes REVOKE/GRANT nötig.

-- ── create_track ────────────────────────────────────────────────────────────

create or replace function public.create_track(track_name text default 'Neue Strecke')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tier    text;
  v_count   integer;
  v_limit   integer;
  v_new_id  uuid;
begin
  -- Profilzeile sperren: serialisiert parallele create_track-Aufrufe desselben
  -- Users, damit die Count-Prüfung unten nicht durch ein Race umgangen wird.
  select tier into v_tier from public.profiles where id = auth.uid() for update;

  if track_name is not null and length(trim(track_name)) > 100 then
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

  insert into public.tracks (owner_id, name)
  values (auth.uid(), coalesce(nullif(trim(track_name), ''), 'Neue Strecke'))
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ── rename_track ─────────────────────────────────────────────────────────────
-- Kein Tier-Limit betroffen — nur die Namens-Längenprüfung ergänzen.

create or replace function public.rename_track(p_track_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  if p_name is not null and length(trim(p_name)) > 100 then
    raise exception 'invalid_name';
  end if;

  update public.tracks set name = trim(p_name) where id = p_track_id and owner_id = auth.uid();
end;
$$;

-- ── create_track_from_version ────────────────────────────────────────────────

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
  -- 1. Aktiven Account sicherstellen + Tier laden. FOR UPDATE sperrt die
  --    Profilzeile für die Transaktionsdauer (Race-Schutz für den
  --    Tier-Limit-Check weiter unten, analog zu create_track_version's Lock
  --    auf der Track-Zeile für die Versionsnummer-Vergabe).
  select p.tier
    into v_tier
    from public.profiles p
   where p.id = auth.uid()
     and p.is_deleted = false
   for update;
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

  -- 4. Namenslänge prüfen, bevor der Name weiterverarbeitet wird.
  if p_name is not null and length(trim(p_name)) > 100 then
    raise exception 'invalid_name';
  end if;

  -- 5. Tier-Limit für die Gesamtzahl an Tracks prüfen (gleiche Grenzen wie
  --    create_track). Durch den FOR UPDATE-Lock oben ist dieser Check jetzt
  --    race-sicher: ein zweiter paralleler Aufruf desselben Users wartet auf
  --    das Commit des ersten und sieht den aktualisierten Count.
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

  -- 6. Name serverseitig absichern — Client-Eingabe nicht blind vertrauen
  --    (leerer/Whitespace-Name fällt auf den Standard-Namen zurück statt einen
  --    unbenannten Track anzulegen)
  v_final_name := coalesce(nullif(trim(p_name), ''), 'Neue Strecke');

  -- 7. Neuen Track aus dem Snapshot anlegen.
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
