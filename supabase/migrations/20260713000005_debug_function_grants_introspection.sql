-- Red-Team-Review 2026-07-13 (2. Runde): Automatisierter Grants-Test
--
-- Der externe Reviewer hat zu Recht angemerkt, dass einzelne stichprobenhafte
-- anonyme RPC-Aufrufe (wie im Security-Smoke-Test) nicht ausreichen, um
-- sicherzustellen, dass KEINE der ~37 Funktionen in `public` versehentlich
-- für `anon` erreichbar ist — insbesondere nicht für künftig neu
-- hinzukommende Funktionen. Diese Funktion macht `has_function_privilege()`
-- für den gesamten `public`-Funktionsbestand automatisiert testbar, ohne
-- eine rohe Postgres-Verbindung zu benötigen (PostgREST erlaubt keine
-- direkten Katalog-Abfragen) — nur `service_role` darf sie aufrufen, nie
-- `anon`/`authenticated`. Verwendet u. a. in
-- src/__integration__/rpc-grants.test.ts.
--
-- Exponiert ausschließlich Funktionsnamen + zwei Booleans, keine sensiblen
-- Daten.

create or replace function public.debug_list_function_grants()
returns table(
  function_name              text,
  anon_can_execute           boolean,
  authenticated_can_execute  boolean
)
language sql security definer set search_path = public as $$
  select
    p.proname::text,
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by p.proname;
$$;

revoke all on function public.debug_list_function_grants() from public, anon, authenticated;
grant execute on function public.debug_list_function_grants() to service_role;
