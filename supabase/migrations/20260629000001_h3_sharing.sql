-- H3: Sharing — get_formation_shares RPC

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
