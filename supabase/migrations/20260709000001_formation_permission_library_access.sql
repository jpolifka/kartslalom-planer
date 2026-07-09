-- Library-Formationen (is_library=true) waren bisher nur über RLS lesbar, aber weder
-- in get_my_formation_permission noch in duplicate_custom_formation als eigener
-- Zugriffsfall bekannt. Ergebnis: Nutzer ohne Owner/Share-Eintrag bekamen beim Öffnen
-- "Kein Zugriff" und beim Kopieren "not_authorized", obwohl RLS das Lesen erlaubt.
-- Reihenfolge bleibt: owner > explizites share > library-fallback ('view') > null.

create or replace function public.get_my_formation_permission(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_permission text;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Owner-Check
  if exists (
    select 1 from public.custom_formations
    where id = p_id and owner_id = auth.uid() and is_deleted = false
  ) then
    return 'owner';
  end if;

  -- Share-Check (nur für nicht-gelöschte Formationen)
  select fs.permission into v_permission
  from public.formation_shares fs
  join public.custom_formations cf on cf.id = fs.formation_id
  where fs.formation_id = p_id
    and fs.shared_with_id = auth.uid()
    and cf.is_deleted = false;

  if v_permission is not null then
    return v_permission;
  end if;

  -- Library-Fallback: öffentlich lesbare Bibliotheks-Formationen sind für jeden
  -- eingeloggten Nutzer ohne Owner/Share zumindest "view" zugänglich.
  if exists (
    select 1 from public.custom_formations
    where id = p_id and is_library = true and is_deleted = false
  ) then
    return 'view';
  end if;

  return null; -- kein Zugriff
end;
$$;

grant execute on function public.get_my_formation_permission(uuid) to authenticated;

-- duplicate_custom_formation: gleicher Library-Fallback wie oben, sonst unverändert
-- (Owner/Share-Prüfung um "oder is_library=true" ergänzt).
create or replace function public.duplicate_custom_formation(p_source_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_required_tier jsonb;
  v_tier          text;
  v_is_deleted    boolean;
  v_count         integer;
  v_new_id        uuid;
  v_source        public.custom_formations%rowtype;
  v_has_access    boolean;
  v_pylon_count   integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select tier, is_deleted into v_tier, v_is_deleted
    from public.profiles where id = auth.uid();
  if coalesce(v_is_deleted, true) then
    raise exception 'account_deleted';
  end if;

  -- Premium-Gate: gleiche Logik wie create_custom_formation
  select value into v_required_tier from public.app_config
    where key = 'custom_formations_required_tier';

  if v_required_tier is not null and v_required_tier <> 'null'::jsonb then
    if not (
      (v_required_tier #>> '{}') = 'free'
      or ((v_required_tier #>> '{}') = 'pro'  and v_tier in ('pro', 'team'))
      or ((v_required_tier #>> '{}') = 'team' and v_tier = 'team')
    ) then
      raise exception 'premium_required' using hint = v_required_tier #>> '{}';
    end if;
  end if;

  -- Abuse-Schutz: max. 100 eigene Custom-Formationen
  select count(*) into v_count from public.custom_formations where owner_id = auth.uid();
  if v_count >= 100 then
    raise exception 'custom_formation_limit_reached';
  end if;

  -- Quellenformation laden + Zugangsprüfung
  select * into v_source from public.custom_formations
  where id = p_source_id and is_deleted = false;

  if not found then
    raise exception 'not_found';
  end if;

  select (
    v_source.owner_id = auth.uid()
    or exists (
      select 1 from public.formation_shares fs
      where fs.formation_id = p_source_id and fs.shared_with_id = auth.uid()
    )
    or v_source.is_library = true
  ) into v_has_access;

  if not v_has_access then
    raise exception 'not_authorized';
  end if;

  select count(*) into v_pylon_count
    from jsonb_array_elements(v_source.cones_json) c
    where c->>'kind' in ('standing', 'lying');

  v_new_id := gen_random_uuid();

  insert into public.custom_formations (
    id, owner_id, name, description, category,
    cones_json, arrows_json, default_direction,
    pylon_count, lichte_breite, duration_seconds,
    source_formation_key, source_custom_formation_id,
    status, is_library
  ) values (
    v_new_id,
    auth.uid(),
    v_source.name || ' (Kopie)',
    v_source.description,
    v_source.category,
    v_source.cones_json,
    v_source.arrows_json,
    v_source.default_direction,
    v_pylon_count,
    v_source.lichte_breite,
    v_source.duration_seconds,
    v_source.source_formation_key,
    p_source_id,
    'private',
    false
  );

  return v_new_id;
end;
$$;

grant execute on function public.duplicate_custom_formation(uuid) to authenticated;
