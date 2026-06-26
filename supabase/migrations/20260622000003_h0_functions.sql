-- H0: Custom-Formationen — SECURITY DEFINER Funktionen

-- create_custom_formation
create or replace function public.create_custom_formation(
  p_name                       text,
  p_description                text,
  p_category                   text,
  p_cones_json                 jsonb,
  p_arrows_json                jsonb,
  p_default_direction          text,
  p_lichte_breite              numeric,
  p_duration_seconds           numeric,
  p_source_formation_key       text,
  p_source_custom_formation_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_required_tier jsonb;
  v_tier          text;
  v_is_deleted    boolean;
  v_count         integer;
  v_cone_count    integer;
  v_pylon_count   integer;
  v_new_id        uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select tier, is_deleted into v_tier, v_is_deleted
    from public.profiles where id = auth.uid();
  if coalesce(v_is_deleted, true) then
    raise exception 'account_deleted';
  end if;

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

  -- Premium-Gate: heute null -> kein Limit
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

  -- Abuse-Schutz: max. 100 eigene Custom-Formationen, max. 40 Cones je Formation
  select count(*) into v_count from public.custom_formations where owner_id = auth.uid();
  if v_count >= 100 then
    raise exception 'custom_formation_limit_reached';
  end if;

  select jsonb_array_length(p_cones_json) into v_cone_count;
  if v_cone_count > 40 then
    raise exception 'too_many_cones';
  end if;

  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  insert into public.custom_formations (
    owner_id, name, description, category, cones_json, arrows_json,
    default_direction, pylon_count, lichte_breite, duration_seconds,
    source_formation_key, source_custom_formation_id
  ) values (
    auth.uid(), p_name, p_description, p_category, p_cones_json, p_arrows_json,
    p_default_direction, v_pylon_count, p_lichte_breite, p_duration_seconds,
    p_source_formation_key, p_source_custom_formation_id
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_custom_formation(
  text, text, text, jsonb, jsonb, text, numeric, numeric, text, uuid
) to authenticated;

-- update_custom_formation
create or replace function public.update_custom_formation(
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
  v_pylon_count integer;
  v_can_edit    boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

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

  select
    (owner_id = auth.uid())
    or exists (
      select 1 from public.formation_shares fs
      where fs.formation_id = p_id and fs.shared_with_id = auth.uid()
        and fs.permission = 'edit'
    )
  into v_can_edit
  from public.custom_formations where id = p_id;

  if not coalesce(v_can_edit, false) then
    raise exception 'not_authorized';
  end if;

  if jsonb_array_length(p_cones_json) > 40 then
    raise exception 'too_many_cones';
  end if;

  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  update public.custom_formations set
    name = p_name, description = p_description, category = p_category,
    cones_json = p_cones_json, arrows_json = p_arrows_json,
    default_direction = p_default_direction, pylon_count = v_pylon_count,
    lichte_breite = p_lichte_breite, duration_seconds = p_duration_seconds
  where id = p_id;
end;
$$;

grant execute on function public.update_custom_formation(
  uuid, text, text, text, jsonb, jsonb, text, numeric, numeric
) to authenticated;

-- delete_custom_formation
create or replace function public.delete_custom_formation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

  delete from public.custom_formations where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;
end;
$$;

grant execute on function public.delete_custom_formation(uuid) to authenticated;

-- find_shareable_user
create or replace function public.find_shareable_user(p_query text)
returns table(id uuid, username text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  return query
    select p.id, p.username from public.profiles p
    where (p.username = p_query or p.email = p_query)
      and p.id <> auth.uid()
      and p.is_deleted = false
    limit 1;
end;
$$;

grant execute on function public.find_shareable_user(text) to authenticated;

-- share_custom_formation
create or replace function public.share_custom_formation(
  p_formation_id uuid,
  p_target_id    uuid,
  p_permission   text default 'view'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

  if p_target_id = auth.uid() then
    raise exception 'cannot_share_with_self';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_target_id and is_deleted = false
  ) then
    raise exception 'target_not_found';
  end if;

  if not exists (
    select 1 from public.custom_formations
    where id = p_formation_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  if p_permission not in ('view', 'edit') then
    raise exception 'invalid_permission';
  end if;

  insert into public.formation_shares (formation_id, shared_with_id, shared_by_id, permission)
  values (p_formation_id, p_target_id, auth.uid(), p_permission)
  on conflict (formation_id, shared_with_id)
    do update set permission = excluded.permission;

  update public.custom_formations set status = 'shared'
    where id = p_formation_id and status = 'private';
end;
$$;

grant execute on function public.share_custom_formation(uuid, uuid, text) to authenticated;

-- unshare_custom_formation
create or replace function public.unshare_custom_formation(
  p_formation_id uuid,
  p_target_id    uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

  if not exists (
    select 1 from public.custom_formations
    where id = p_formation_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  delete from public.formation_shares
    where formation_id = p_formation_id and shared_with_id = p_target_id;

  select count(*) into v_remaining from public.formation_shares
    where formation_id = p_formation_id;

  if v_remaining = 0 then
    update public.custom_formations set status = 'private'
      where id = p_formation_id and status = 'shared';
  end if;
end;
$$;

grant execute on function public.unshare_custom_formation(uuid, uuid) to authenticated;

-- admin_list_custom_formations
create or replace function public.admin_list_custom_formations(
  p_status   text default null,
  p_category text default null
) returns setof public.custom_formations
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  if p_status is not null
     and p_status not in ('private', 'shared', 'submitted', 'library', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if p_category is not null
     and p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  return query
    select * from public.custom_formations cf
    where (p_status is null or cf.status = p_status)
      and (p_category is null or cf.category = p_category)
    order by cf.created_at desc;
end;
$$;

grant execute on function public.admin_list_custom_formations(text, text) to authenticated;

-- admin_get_custom_formation
create or replace function public.admin_get_custom_formation(p_id uuid)
returns public.custom_formations
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_row  public.custom_formations;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  select * into v_row from public.custom_formations where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_get_custom_formation(uuid) to authenticated;

-- admin_promote_to_library
create or replace function public.admin_promote_to_library(
  p_formation_id uuid,
  p_category     text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  -- Kopie anlegen, Original bleibt unverändert beim Ersteller
  insert into public.custom_formations (
    owner_id, name, description, category, cones_json, arrows_json,
    default_direction, pylon_count, lichte_breite, duration_seconds,
    source_custom_formation_id, status, is_library
  )
  select owner_id, name, description, p_category, cones_json, arrows_json,
         default_direction, pylon_count, lichte_breite, duration_seconds,
         id, 'library', true
  from public.custom_formations
  where id = p_formation_id
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'not_found';
  end if;

  return v_new_id;
end;
$$;

grant execute on function public.admin_promote_to_library(uuid, text) to authenticated;

-- admin_delete_custom_formation
create or replace function public.admin_delete_custom_formation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  delete from public.custom_formations where id = p_id;
end;
$$;

grant execute on function public.admin_delete_custom_formation(uuid) to authenticated;

-- admin_update_custom_formation
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

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  update public.custom_formations set
    previous_cones_json  = cones_json,
    previous_arrows_json = arrows_json,
    name = p_name, description = p_description, category = p_category,
    cones_json = p_cones_json, arrows_json = p_arrows_json,
    pylon_count = v_pylon_count,
    default_direction = p_default_direction,
    lichte_breite = p_lichte_breite,
    duration_seconds = p_duration_seconds,
    edited_by_admin_id = auth.uid(), edited_by_admin_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.admin_update_custom_formation(
  uuid, text, text, text, jsonb, jsonb, text, numeric, numeric
) to authenticated;
