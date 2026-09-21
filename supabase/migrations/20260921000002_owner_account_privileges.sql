-- Kartslalom Streckenplaner
-- Copyright (c) Jens Polifka
-- All rights reserved.
--
-- Betreiber-Konto: jens@polifka.info bekommt immer role='admin' und tier='team'.
--
-- Anlass: Nach einer Neuinstallation der DB (leeres Datenverzeichnis) musste die
-- Admin-Rolle und der Tarif jedes Mal von Hand per SQL gesetzt werden.
--
-- Wirkung: Ein Trigger auf auth.users (insert/update) setzt die Rechte
--   - bei der Registrierung, sobald die E-Mail bestätigt ist (Magic-Link-Klick),
--   - bei jeder Änderung von email / email_confirmed_at,
--   - bei jedem Login (GoTrue aktualisiert last_sign_in_at) — ein versehentlich
--     oder von Hand zurückgesetztes Konto wird dadurch beim nächsten Login
--     automatisch wieder korrigiert.
-- Zusätzlich korrigiert diese Migration ein bereits bestehendes Konto einmalig.
--
-- SICHERHEIT: Die Rechte hängen ausschliesslich an der BESTÄTIGTEN E-Mail-Adresse.
-- Das ist nur sicher, solange GoTrue neue Registrierungen NICHT automatisch
-- bestätigt (ENABLE_EMAIL_AUTOCONFIRM=false). Bei Autoconfirm könnte sich jeder mit
-- dieser Adresse registrieren und wäre sofort Admin. docker/supabase/preflight-check.sh
-- bricht den Prod-Start deshalb ab, wenn Autoconfirm aktiv ist.
--
-- Grants: Trigger-Funktion in public wie handle_new_user(); anon/PUBLIC werden explizit
-- ausgeschlossen (siehe unten).

create or replace function public.enforce_owner_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null
     and lower(new.email) = 'jens@polifka.info' then
    update public.profiles
       set role = 'admin', tier = 'team'
     where id = new.id
       and (role is distinct from 'admin' or tier is distinct from 'team');
  end if;
  return new;
end;
$$;

-- anon/PUBLIC dürfen die Funktion nicht ausführen (siehe 20260713000002_harden_public_function_grants.sql;
-- rpc-grants.test.ts prüft das für ALLE Funktionen in public). authenticated bleibt wie bei
-- handle_new_user() bewusst unangetastet: als Trigger-Funktion ist sie per RPC ohnehin nicht aufrufbar.
revoke execute on function public.enforce_owner_account() from public, anon;

-- Name sortiert nach on_auth_user_created: bei Autoconfirm (Konto schon beim INSERT
-- bestätigt) muss die profiles-Zeile schon existieren, wenn dieser Trigger feuert.
--
-- Bewusst OHNE Spaltenliste ("update of ..."): Bei einer Neuinstallation läuft diese
-- Migration vor dem ersten GoTrue-Start, und GoTrue legt Spalten wie email_confirmed_at
-- erst danach an — "update of email_confirmed_at" würde die Migration (und damit den
-- DB-Start) abbrechen. Die Funktion liest die Spalten erst zur Laufzeit, und ein
-- Update-Trigger auf auth.users ist billig (Vergleich der E-Mail, sonst nichts).
drop trigger if exists on_auth_user_owner_privileges on auth.users;
create trigger on_auth_user_owner_privileges
  after insert or update on auth.users
  for each row execute function public.enforce_owner_account();

-- Einmalige Korrektur für ein bereits vorhandenes Konto. Nur wenn GoTrue seine Spalten
-- schon angelegt hat (bei einer Neuinstallation gibt es noch kein Konto -> nichts zu tun).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    update public.profiles p
       set role = 'admin', tier = 'team'
      from auth.users u
     where u.id = p.id
       and u.email_confirmed_at is not null
       and lower(u.email) = 'jens@polifka.info'
       and (p.role is distinct from 'admin' or p.tier is distinct from 'team');
  end if;
end;
$$;
