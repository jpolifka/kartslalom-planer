-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- Bugfix: admin_update_custom_formation hatte Datenintegritäts-Validierungen
-- aus der User-Version verloren. Hier werden alle Prüfungen aus
-- update_custom_formation übernommen (außer Ownership-Check, der durch
-- Admin-Rollenprüfung ersetzt ist).

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
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles
  where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then raise exception 'not_authorized'; end if;

  -- Validierungen identisch zu update_custom_formation -----
  if length(trim(p_name)) < 1 or length(p_name) > 80 then
    raise exception 'invalid_name';
  end if;

  if p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  if jsonb_typeof(p_cones_json) <> 'array' then
    raise exception 'invalid_cones_json';
  end if;
  if jsonb_typeof(p_arrows_json) <> 'array' then
    raise exception 'invalid_arrows_json';
  end if;

  if jsonb_array_length(p_cones_json) > 40 then
    raise exception 'too_many_cones';
  end if;
  if jsonb_array_length(p_arrows_json) > 100 then
    raise exception 'too_many_arrows';
  end if;

  if p_lichte_breite is not null and (p_lichte_breite <= 0 or p_lichte_breite > 20) then
    raise exception 'invalid_lichte_breite';
  end if;

  if p_duration_seconds is not null and (p_duration_seconds <= 0 or p_duration_seconds > 120) then
    raise exception 'invalid_duration_seconds';
  end if;

  if p_default_direction is not null and p_default_direction not in ('cw', 'ccw', 'none') then
    raise exception 'invalid_default_direction';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_cones_json) c
    where (c->>'x') is null or (c->>'y') is null
       or (c->>'x')::numeric not between -50 and 50
       or (c->>'y')::numeric not between -50 and 50
  ) then
    raise exception 'invalid_cone_coordinates';
  end if;
  -- --------------------------------------------------------

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

  if not found then raise exception 'not_found'; end if;
end;
$$;

grant execute on function public.admin_update_custom_formation(uuid,text,text,text,jsonb,jsonb,text,numeric,numeric) to authenticated;
