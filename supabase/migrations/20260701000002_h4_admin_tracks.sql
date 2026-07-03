-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- H4: Admin-RPCs für Strecken-Verwaltung
-- Muss als supabase_admin ausgeführt werden.

-- admin_list_tracks: Alle Strecken aller Nutzer (mit owner_id)
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

  return query
    select
      t.id, t.owner_id, t.name, t.is_public,
      t.manual_width, t.manual_length,
      t.created_at, t.updated_at
    from public.tracks t
    where (p_owner_id is null or t.owner_id = p_owner_id)
    order by t.updated_at desc
    limit 500;
end;
$$;

grant execute on function public.admin_list_tracks(uuid) to authenticated;

-- admin_get_track: Einzelne Strecke inkl. state_json (für Lesezugriff)
create or replace function public.admin_get_track(p_id uuid)
returns public.tracks
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_row  public.tracks;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  select * into v_row from public.tracks where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.admin_get_track(uuid) to authenticated;

-- admin_delete_track: Strecke löschen (Admin-Override)
create or replace function public.admin_delete_track(p_id uuid)
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

  delete from public.tracks where id = p_id;
end;
$$;

grant execute on function public.admin_delete_track(uuid) to authenticated;
