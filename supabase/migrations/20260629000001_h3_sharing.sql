-- H3: Sharing — set_username + get_formation_shares RPCs

-- set_username: Nutzer setzt seinen eigenen Benutzernamen (3-24 Zeichen, [a-z0-9_-])
create or replace function public.set_username(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_normalized text := lower(trim(p_username));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

  if not (v_normalized ~ '^[a-z0-9_-]{3,24}$') then
    raise exception 'invalid_username';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(username) = v_normalized and id <> auth.uid()
  ) then
    raise exception 'username_taken';
  end if;

  update public.profiles set username = v_normalized where id = auth.uid();
end;
$$;

grant execute on function public.set_username(text) to authenticated;

-- get_formation_shares: Gibt alle Shares einer Formation zurück (nur für den Owner)
create or replace function public.get_formation_shares(p_formation_id uuid)
returns table(
  shared_with_id   uuid,
  username         text,
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
      p.username,
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
