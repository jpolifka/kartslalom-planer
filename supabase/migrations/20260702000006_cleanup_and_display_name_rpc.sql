-- H5 Cleanup + Attribution: get_formation_shares ohne username,
-- set_display_name RPC für optionalen Anzeigenamen

-- 1. get_formation_shares: username-Spalte entfernt (wird nie angezeigt)
-- DROP nötig weil Rückgabe-Typsignatur sich ändert (username entfernt)
drop function if exists public.get_formation_shares(uuid);
create function public.get_formation_shares(p_formation_id uuid)
returns table(
  shared_with_id   uuid,
  email            text,
  permission       text,
  created_at       timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.custom_formations
    where id = p_formation_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  return query
    select
      fs.shared_with_id,
      p.email,
      fs.permission,
      fs.created_at
    from public.formation_shares fs
    join public.profiles p on p.id = fs.shared_with_id
    where fs.formation_id = p_formation_id
    order by fs.created_at asc;
end;
$$;

grant execute on function public.get_formation_shares(uuid) to authenticated;

-- 2. set_display_name: Nutzer setzt optionalen öffentlichen Anzeigenamen
-- null oder leer → setzt display_name auf NULL ("Community-Formation" in der UI)
create or replace function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

  -- Leerer String → NULL (kein Anzeigename). Länge nur bei nicht-leerem Wert prüfen.
  if p_display_name is not null
     and length(trim(p_display_name)) > 0
     and (length(trim(p_display_name)) < 2 or length(trim(p_display_name)) > 40) then
    raise exception 'invalid_display_name';
  end if;

  update profiles
  set display_name = nullif(trim(p_display_name), '')
  where id = auth.uid();
end;
$$;

grant execute on function public.set_display_name(text) to authenticated;
revoke execute on function public.set_display_name(text) from anon;
