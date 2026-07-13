-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- H4 Extras:
--   1. admin_list_tracks neu als language sql — hebt die plpgsql-Laufzeitambiguität
--      "column reference 'id' is ambiguous" auf.
--   2. admin_update_custom_formation — Admin kann fremde Formationen bearbeiten
--      (SECURITY DEFINER, kein Ownership-Check).
-- Muss als supabase_admin ausgeführt werden.

-- 1. admin_list_tracks — als SQL-Funktion (kein plpgsql scope-Konflikt)
-- DROP zuerst: rein defensiv, falls diese Migration auf eine DB trifft, die
-- admin_list_tracks bereits mit abweichenden OUT-Parametern kennt (z. B.
-- 20260701000005 wurde dort schon angewendet) — sonst bricht CREATE OR
-- REPLACE mit "cannot change return type of existing function" ab. Auf
-- frischen Installationen ein No-Op.
drop function if exists public.admin_list_tracks(uuid);

create or replace function public.admin_list_tracks(
  p_owner_id uuid default null
) returns table (
  id               uuid,
  owner_id         uuid,
  name             text,
  is_public        boolean,
  manual_width     numeric,
  manual_length    numeric,
  created_at       timestamptz,
  updated_at       timestamptz
)
language sql security definer stable set search_path = public as $$
  select
    t.id, t.owner_id, t.name, t.is_public,
    t.manual_width, t.manual_length,
    t.created_at, t.updated_at
  from public.tracks t
  where
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.is_deleted = false
    )
    and (p_owner_id is null or t.owner_id = p_owner_id)
  order by t.updated_at desc
  limit 500
$$;

grant execute on function public.admin_list_tracks(uuid) to authenticated;

-- 2. admin_update_custom_formation — Admin-Override für Formationsbearbeitung
create or replace function public.admin_update_custom_formation(
  p_id                uuid,
  p_name              text,
  p_description       text,
  p_category          text,
  p_cones_json        jsonb,
  p_arrows_json       jsonb,
  p_default_direction text,
  p_lichte_breite     numeric,
  p_duration_seconds  numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_role        text;
  v_pylon_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles
  where id = auth.uid() and is_deleted = false;

  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  -- Pylonen-Anzahl neu berechnen (wie in update_custom_formation)
  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  update public.custom_formations set
    name               = p_name,
    description        = p_description,
    category           = p_category,
    cones_json         = p_cones_json,
    arrows_json        = p_arrows_json,
    default_direction  = p_default_direction,
    pylon_count        = v_pylon_count,
    lichte_breite      = p_lichte_breite,
    duration_seconds   = p_duration_seconds,
    edited_by_admin_id = auth.uid(),
    edited_by_admin_at = now()
  where id = p_id
    and is_deleted = false;

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

grant execute on function public.admin_update_custom_formation(
  uuid, text, text, text, jsonb, jsonb, text, numeric, numeric
) to authenticated;
