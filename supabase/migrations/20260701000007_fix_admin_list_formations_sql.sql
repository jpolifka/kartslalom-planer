-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- Bugfix: admin_list_custom_formations als language sql neu schreiben.
-- plpgsql RETURNS TABLE erzeugt OUT-Parameter "id" die mit cf.id kollidiert
-- → "column reference 'id' is ambiguous" (SQLSTATE 42702) → HTTP 400.
-- language sql hat keinen plpgsql-Variablen-Scope — keine Ambiguität.
-- Admin-Check via EXISTS-Subquery statt RAISE EXCEPTION.

drop function if exists public.admin_list_custom_formations(text, text);

create function public.admin_list_custom_formations(
  p_status   text default null,
  p_category text default null
) returns table (
  id                         uuid,
  owner_id                   uuid,
  owner_email                text,
  name                       text,
  description                text,
  category                   text,
  cones_json                 jsonb,
  arrows_json                jsonb,
  default_direction          text,
  pylon_count                integer,
  lichte_breite              numeric,
  duration_seconds           numeric,
  source_formation_key       text,
  source_custom_formation_id uuid,
  status                     text,
  is_library                 boolean,
  previous_cones_json        jsonb,
  previous_arrows_json       jsonb,
  edited_by_admin_id         uuid,
  edited_by_admin_at         timestamptz,
  created_at                 timestamptz,
  updated_at                 timestamptz,
  is_deleted                 boolean
)
language sql security definer stable set search_path = public as $$
  select
    cf.id, cf.owner_id,
    p.email  as owner_email,
    cf.name, cf.description, cf.category,
    cf.cones_json, cf.arrows_json, cf.default_direction,
    cf.pylon_count, cf.lichte_breite, cf.duration_seconds,
    cf.source_formation_key, cf.source_custom_formation_id,
    cf.status, cf.is_library,
    cf.previous_cones_json, cf.previous_arrows_json,
    cf.edited_by_admin_id, cf.edited_by_admin_at,
    cf.created_at, cf.updated_at, cf.is_deleted
  from public.custom_formations cf
  left join public.profiles p on p.id = cf.owner_id
  where
    exists (
      select 1 from public.profiles ap
      where ap.id = auth.uid()
        and ap.role = 'admin'
        and ap.is_deleted = false
    )
    and (p_status   is null or cf.status   = p_status)
    and (p_category is null or cf.category = p_category)
  order by cf.created_at desc
  limit 500
$$;

grant execute on function public.admin_list_custom_formations(text, text) to authenticated;
