-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- admin_list_custom_formations: owner_email hinzugefügt (LEFT JOIN auf profiles).
-- Bisher war der Return-Typ SETOF custom_formations — ohne E-Mail.
-- Jetzt explizite TABLE-Definition mit owner_email-Spalte.

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
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then raise exception 'not_authorized'; end if;

  if p_status is not null
     and p_status not in ('private', 'shared', 'submitted', 'library', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if p_category is not null
     and p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  return query
    select
      cf.id, cf.owner_id,
      p.email as owner_email,
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
    where (p_status is null or cf.status = p_status)
      and (p_category is null or cf.category = p_category)
    order by cf.created_at desc;
end;
$$;

grant execute on function public.admin_list_custom_formations(text, text) to authenticated;
