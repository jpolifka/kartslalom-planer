-- delete_account_data() — Atomische DB-Bereinigung vor Account-Löschung
--
-- Atomisch in einer Transaktion:
--   1. Profil als gelöscht markieren (Soft-Delete, Audit-Trail)
--   2. Nicht-Library-Formationen des Nutzers löschen
--      Library-Formationen erhalten owner_id=null über ON DELETE SET NULL,
--      sobald auth.admin.deleteUser() danach in der Edge Function läuft.
--
-- WICHTIG: Da auth.admin.deleteUser() außerhalb der PostgreSQL-Transaktion läuft,
-- gibt es keine echte Atomizität über Auth + DB hinweg. Wenn deleteUser() scheitert,
-- wird der Soft-Delete per PATCH rückgängig gemacht. Die gelöschten Formationen
-- können hingegen nicht wiederhergestellt werden — dies ist eine explizit akzeptierte
-- Einschränkung (Produktionseinsatz: diese Funktion vor bekannten Auth-Problemen aufrufen).

create or replace function public.delete_account_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Soft-Delete-Markierung für Audit-Trail
  update profiles
  set is_deleted = true,
      deleted_at = now()
  where id = v_uid;

  -- Nicht-Library-Formationen löschen (ohne Wiederherstellung möglich)
  delete from custom_formations
  where owner_id = v_uid
    and is_library = false;
end;
$$;

revoke all on function public.delete_account_data() from public, anon;
grant execute on function public.delete_account_data() to authenticated;
