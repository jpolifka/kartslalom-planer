-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- admin_list_tracks: owner_email hinzugefügt (JOIN auf profiles).
-- Ersetzt die Version aus 20260701000003_h4_admin_extras.sql.
-- DROP nötig weil sich der Return-Typ ändert (neues OUT-Feld owner_email).
drop function if exists public.admin_list_tracks(uuid);

create or replace function public.admin_list_tracks(
  p_owner_id uuid default null
) returns table (
  id               uuid,
  owner_id         uuid,
  owner_email      text,
  name             text,
  is_public        boolean,
  manual_width     numeric,
  manual_length    numeric,
  created_at       timestamptz,
  updated_at       timestamptz
)
language sql security definer stable set search_path = public as $$
  select
    t.id, t.owner_id,
    p.email as owner_email,
    t.name, t.is_public,
    t.manual_width, t.manual_length,
    t.created_at, t.updated_at
  from public.tracks t
  left join public.profiles p on p.id = t.owner_id
  where
    exists (
      select 1 from public.profiles ap
      where ap.id = auth.uid()
        and ap.role = 'admin'
        and ap.is_deleted = false
    )
    and (p_owner_id is null or t.owner_id = p_owner_id)
  order by t.updated_at desc
  limit 500
$$;

grant execute on function public.admin_list_tracks(uuid) to authenticated;
