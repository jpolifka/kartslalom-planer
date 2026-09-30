-- Formation-Bibliothek: fehlenden "Einreichen"-Schritt für Nutzer nachziehen
--
-- custom_formations.status kennt seit der H0-Migration (20260622000001) den
-- vollen Zustandsraum 'private' | 'shared' | 'submitted' | 'library' |
-- 'rejected' (siehe docs/planning/CUSTOM_FORMATIONS_PLAN.md), und
-- admin_list_custom_formations/AdminFormationsPage.tsx filtern/labeln
-- 'submitted' und 'rejected' bereits vollständig. Es gab dafür aber nie einen
-- Weg, wie eine Formation dort ankommt: kein Client-Code setzte je
-- status='submitted', und admin_promote_to_library() befördert bislang JEDE
-- Formation direkt, unabhängig vom Status — der Moderationsfilter
-- "Eingereicht" konnte dadurch nie etwas anzeigen. Diese Migration schließt
-- beide fehlenden Seiten:
--
-- 1) submit_custom_formation(): Owner reicht eine eigene Formation ein
--    (private/shared/rejected -> submitted). Erneutes Einreichen nach
--    Ablehnung ist bewusst erlaubt (überarbeiten + erneut vorschlagen).
-- 2) admin_reject_custom_formation(): Admin lehnt eine eingereichte
--    Formation ab (submitted -> rejected) — Gegenstück zu
--    admin_promote_to_library(), das bereits existierte, aber ohne
--    Gegenstück nie zu einem sichtbaren Ergebnis führte.
--
-- admin_promote_to_library() bleibt bewusst promotbar aus JEDEM Status (siehe
-- Kommentar dort) — ein Admin soll eine gute Formation nicht erst zur
-- Einreichung zwingen müssen. Neu ist nur: nach der Promotion (Kopie mit
-- is_library=true, siehe 9.2 im Plan) wird der Status des ORIGINALS auf den
-- Wert zurückgesetzt, den er ohne den Einreichen-Umweg auch hätte (abhängig
-- davon, ob noch aktive formation_shares bestehen) — sonst bliebe ein
-- promotetes Original für immer als 'submitted' in der Moderations-Queue
-- hängen, obwohl es bereits entschieden ist. is_library, Inhalt und
-- Bearbeitungsrechte des Originals bleiben davon unberührt (9.2 gilt
-- weiterhin: Promotion ist eine Kopie, kein Verschieben).
--
-- Explizites REVOKE nach jeder CREATE-Anweisung unten (zusätzlich zum
-- `grant execute ... to authenticated`), nicht nur das globale `alter default
-- privileges ... revoke ... from public, anon` aus 20260713000002: Dessen
-- Wirkung gilt nur für die Rolle, die die ALTER-Anweisung ausgeführt hat
-- (supabase_admin, siehe migrate.sh). apply-migrations.sh (der Produktions-
-- Weg für Migrationen auf einem laufenden Stack, siehe build-und-deployment.md)
-- versucht neue Migrationen zuerst als Rolle "postgres" auszuführen — für
-- eine brandneue Funktion (kein Ownership-Konflikt, kein Fallback auf
-- supabase_admin nötig) bekäme sie dadurch PostgreSQLs eingebauten
-- PUBLIC-Default (EXECUTE für alle, auch anon), unabhängig vom globalen
-- ALTER DEFAULT PRIVILEGES. Empirisch verifiziert gegen den lokalen Stack.
-- Gleiches Muster bereits in 20260921000002_owner_account_privileges.sql für
-- enforce_owner_account() — hier für beide neuen Funktionen unten ergänzt.

-- submit_custom_formation
create or replace function public.submit_custom_formation(p_formation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_deleted = false
  ) then
    raise exception 'account_deleted';
  end if;

  if not exists (
    select 1 from public.custom_formations
    where id = p_formation_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  if not exists (
    select 1 from public.custom_formations
    where id = p_formation_id and status in ('private', 'shared', 'rejected')
  ) then
    raise exception 'invalid_status_for_submit';
  end if;

  update public.custom_formations set status = 'submitted' where id = p_formation_id;
end;
$$;

revoke execute on function public.submit_custom_formation(uuid) from public, anon;
grant execute on function public.submit_custom_formation(uuid) to authenticated;

-- admin_reject_custom_formation
create or replace function public.admin_reject_custom_formation(p_formation_id uuid)
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

  if not exists (
    select 1 from public.custom_formations
    where id = p_formation_id and status = 'submitted'
  ) then
    raise exception 'invalid_status_for_reject';
  end if;

  update public.custom_formations set status = 'rejected' where id = p_formation_id;
end;
$$;

revoke execute on function public.admin_reject_custom_formation(uuid) from public, anon;
grant execute on function public.admin_reject_custom_formation(uuid) to authenticated;

-- admin_promote_to_library (create or replace — identisch zu
-- 20260622000003_h0_functions.sql, nur um den Status-Reset des Originals
-- ergänzt; Grant bleibt an der Signatur hängen, kein erneutes GRANT nötig)
create or replace function public.admin_promote_to_library(
  p_formation_id uuid,
  p_category     text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  select role into v_role from public.profiles where id = auth.uid() and is_deleted = false;
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  -- Kopie anlegen, Original bleibt unverändert beim Ersteller
  insert into public.custom_formations (
    owner_id, name, description, category, cones_json, arrows_json,
    default_direction, pylon_count, lichte_breite, duration_seconds,
    source_custom_formation_id, status, is_library
  )
  select owner_id, name, description, p_category, cones_json, arrows_json,
         default_direction, pylon_count, lichte_breite, duration_seconds,
         id, 'library', true
  from public.custom_formations
  where id = p_formation_id
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'not_found';
  end if;

  -- Neu: Review-Status des Originals auflösen, damit eine promotete Formation
  -- nicht für immer als 'submitted' in der Moderations-Queue hängen bleibt.
  -- is_library/Inhalt/Bearbeitungsrechte des Originals bleiben unverändert.
  update public.custom_formations set
    status = case
      when exists (
        select 1 from public.formation_shares where formation_id = p_formation_id
      ) then 'shared'
      else 'private'
    end
  where id = p_formation_id;

  return v_new_id;
end;
$$;

-- Verteidigung in der Tiefe: admin_promote_to_library existierte bereits mit
-- korrektem Grant (nur authenticated), CREATE OR REPLACE übernimmt dessen ACL
-- unverändert. Dieses REVOKE ändert an einer bestehenden, korrekten Funktion
-- nichts, schützt aber denselben Fall wie oben, falls diese Migration je
-- isoliert auf eine Datenbank angewendet wird, in der die Funktion noch nicht
-- existiert (z. B. abweichende Migrationsreihenfolge in einem Fork).
revoke execute on function public.admin_promote_to_library(uuid, text) from public, anon;
grant execute on function public.admin_promote_to_library(uuid, text) to authenticated;
