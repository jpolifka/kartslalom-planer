-- H5: Attribution — display_name statt owner_username
--
-- Produktentscheidung (2026-07-02):
--   Variante B — optionaler Anzeigename. Kein Onboarding-Pflichtschritt.
--   Ist display_name null → UI zeigt "Community-Formation" (anonym).
--   E-Mail wird bei Library-Formationen niemals ausgegeben (Datenschutz).
--
-- profiles.username bleibt in der DB (ältere Migrationen, Index), ist aber
-- keine Produktanforderung und wird im Sharing-Flow nicht mehr verwendet.

alter table public.profiles
  add column if not exists display_name text;

-- get_library_formations: display_name statt username
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
  display_name         text,   -- null = "Community-Formation" (kein Anzeigename gesetzt)
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
    p.display_name,
    cf.created_at
  from public.custom_formations cf
  left join public.profiles p on p.id = cf.owner_id
  where cf.is_library = true
    and cf.is_deleted = false
  order by cf.name asc;
$$;

grant execute on function public.get_library_formations() to anon, authenticated;
