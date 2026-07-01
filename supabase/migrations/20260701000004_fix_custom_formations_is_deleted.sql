-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- Bugfix: custom_formations.is_deleted fehlte in der ursprünglichen Schema-Migration.
-- Alle H0-Funktionen (get_my_formation_permission, update_custom_formation,
-- duplicate_custom_formation, …) referenzieren is_deleted = false, was ohne diese
-- Spalte zu SQLSTATE 42703 → HTTP 400 führt.
-- Muss als supabase_admin ausgeführt werden.

alter table public.custom_formations
  add column if not exists is_deleted boolean not null default false;

create index if not exists custom_formations_is_deleted_idx
  on public.custom_formations (is_deleted)
  where is_deleted = false;
