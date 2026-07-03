-- find_shareable_user — Produktentscheidung: nur E-Mail, kein Username
--
-- Vorherige Funktion hat nach username ODER email gesucht und username zurückgegeben.
-- Neue Funktion: exakte E-Mail-Suche (case-insensitive, getrimmt), gibt email zurück.
-- Enumeration-Schutz: exakte Übereinstimmung statt LIKE/ILIKE, kein Teilstring-Match.

drop function if exists public.find_shareable_user(text);

create function public.find_shareable_user(p_email text)
returns table(id uuid, email text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  return query
    select p.id, p.email
    from public.profiles p
    where lower(trim(p.email)) = lower(trim(p_email))
      and p.id <> auth.uid()
      and p.is_deleted = false
    limit 1;
end;
$$;

grant execute on function public.find_shareable_user(text) to authenticated;
