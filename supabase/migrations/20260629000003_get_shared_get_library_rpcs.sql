-- H3: get_shared_formations + get_library_formations RPCs
-- Ersetzt direkte Tabellenabfragen durch explizite RPCs mit kontrolliertem Feldsatz.

-- get_shared_formations: Gibt nur Formationen zurück, die explizit mit dem aktuellen
-- Nutzer geteilt wurden — kein RLS-Trick mit neq(owner_id).
-- Enthält permission aus formation_shares.
create or replace function public.get_shared_formations()
returns table(
  id                         uuid,
  owner_id                   uuid,
  name                       text,
  description                text,
  category                   text,
  pylon_count                integer,
  lichte_breite              numeric,
  duration_seconds           numeric,
  cones_json                 jsonb,
  arrows_json                jsonb,
  default_direction          text,
  source_formation_key       text,
  source_custom_formation_id uuid,
  status                     text,
  permission                 text,
  created_at                 timestamptz,
  updated_at                 timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  return query
    select
      cf.id,
      cf.owner_id,
      cf.name,
      cf.description,
      cf.category,
      cf.pylon_count,
      cf.lichte_breite,
      cf.duration_seconds,
      cf.cones_json,
      cf.arrows_json,
      cf.default_direction,
      cf.source_formation_key,
      cf.source_custom_formation_id,
      cf.status,
      fs.permission,
      cf.created_at,
      cf.updated_at
    from public.custom_formations cf
    join public.formation_shares fs
      on fs.formation_id = cf.id
     and fs.shared_with_id = auth.uid()
    order by cf.updated_at desc;
end;
$$;

grant execute on function public.get_shared_formations() to authenticated;

-- get_library_formations: Öffentlich lesbar, reduzierter Feldsatz ohne owner_id
-- und ohne interne Adminfelder.
create or replace function public.get_library_formations()
returns table(
  id                   uuid,
  name                 text,
  description          text,
  category             text,
  pylon_count          integer,
  lichte_breite        numeric,
  duration_seconds     numeric,
  cones_json           jsonb,
  arrows_json          jsonb,
  default_direction    text,
  source_formation_key text,
  created_at           timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
    select
      cf.id,
      cf.name,
      cf.description,
      cf.category,
      cf.pylon_count,
      cf.lichte_breite,
      cf.duration_seconds,
      cf.cones_json,
      cf.arrows_json,
      cf.default_direction,
      cf.source_formation_key,
      cf.created_at
    from public.custom_formations cf
    where cf.is_library = true
    order by cf.name;
end;
$$;

grant execute on function public.get_library_formations() to anon, authenticated;
