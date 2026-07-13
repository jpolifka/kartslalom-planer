-- H4 Admin Completion:
--   1. is_current_user_admin() — serverseitige Rollenprüfung für AdminGuard
--   2. admin_list_custom_formations — edited_by_admin_email + p_limit/p_offset

-- is_current_user_admin: Leichtgewichtige Prüfung für AdminGuard (Frontend).
-- Gibt true zurück wenn der aktuelle Nutzer role='admin' und nicht gelöscht ist.
-- Ergänzt (nicht ersetzt) die inline-Checks in den Admin-RPCs.
create or replace function public.is_current_user_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_deleted = false
  )
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

-- admin_list_custom_formations: edited_by_admin_email + Paginierung
-- Vorherige Versionen (006, 007) entfernen bevor wir den neuen Return-Typ anlegen.
drop function if exists public.admin_list_custom_formations(text, text);

-- CREATE OR REPLACE statt CREATE: defensiv, falls die 4-Parameter-Signatur
-- (mit p_limit/p_offset) auf dieser DB schon existiert (siehe admin_list_tracks
-- in 20260701000003 für denselben Fall). No-Op-Unterschied auf frischen
-- Installationen, wo sie noch nicht existiert.
create or replace function public.admin_list_custom_formations(
  p_status    text    default null,
  p_category  text    default null,
  p_limit     integer default 100,
  p_offset    integer default 0
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
  edited_by_admin_email      text,
  created_at                 timestamptz,
  updated_at                 timestamptz,
  is_deleted                 boolean
)
language sql security definer stable set search_path = public as $$
  select
    cf.id, cf.owner_id,
    op.email  as owner_email,
    cf.name, cf.description, cf.category,
    cf.cones_json, cf.arrows_json, cf.default_direction,
    cf.pylon_count, cf.lichte_breite, cf.duration_seconds,
    cf.source_formation_key, cf.source_custom_formation_id,
    cf.status, cf.is_library,
    cf.previous_cones_json, cf.previous_arrows_json,
    cf.edited_by_admin_id, cf.edited_by_admin_at,
    ap.email  as edited_by_admin_email,
    cf.created_at, cf.updated_at, cf.is_deleted
  from public.custom_formations cf
  left join public.profiles op on op.id = cf.owner_id
  left join public.profiles ap on ap.id = cf.edited_by_admin_id
  where
    -- Admin-Gate: inline-Check (language sql hat kein RAISE EXCEPTION)
    exists (
      select 1 from public.profiles rp
      where rp.id = auth.uid()
        and rp.role = 'admin'
        and rp.is_deleted = false
    )
    and (p_status   is null or cf.status   = p_status)
    and (p_category is null or cf.category = p_category)
  order by cf.created_at desc
  limit  greatest(1, least(p_limit,  500))
  offset greatest(0, p_offset)
$$;

grant execute on function public.admin_list_custom_formations(text, text, integer, integer) to authenticated;
