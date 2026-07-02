-- H5: get_library_formations mit owner_username für Attribution in der Palette.
-- DROP + CREATE wegen Änderung des RETURNS TABLE (neues Feld owner_username).

drop function if exists public.get_library_formations();

create function public.get_library_formations()
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
  owner_username       text,
  created_at           timestamptz
) language sql security definer set search_path = public as $$
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
    p.username,
    cf.created_at
  from public.custom_formations cf
  left join public.profiles p on p.id = cf.owner_id
  where cf.is_library = true
    and cf.is_deleted = false
  order by cf.name asc;
$$;

grant execute on function public.get_library_formations() to anon, authenticated;
