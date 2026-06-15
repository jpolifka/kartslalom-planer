-- Phase 0.5 — Schema: profiles, tracks, track_versions
-- Quelle: docs/planning/IMPLEMENTATION_PLAN.md Abschnitt 0.5

create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  tier                    text not null default 'free'
                            check (tier in ('free', 'pro', 'team')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_status           text,
  last_active_at          timestamptz not null default now(),
  reminder_150_sent_at    timestamptz,
  reminder_170_sent_at    timestamptz,
  is_deleted              boolean not null default false,
  deleted_at              timestamptz,
  created_at              timestamptz not null default now()
);

-- Trigger: Signup -> profiles-Zeile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.tracks (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  name             text not null default 'Neue Strecke',
  description      text,
  is_public        boolean not null default false,
  public_token_hash text unique,     -- SHA-256-Hash, Plaintext-Token nur einmalig zurueckgeben
  state_json       jsonb not null default '{"items":[],"arrows":[]}',
  area_sel_json    jsonb,
  manual_width     numeric not null default 18,
  manual_length    numeric not null default 36,
  map_satellite    boolean not null default false,  -- Free/Gast: kein Satellite
  map_opacity      numeric not null default 0.5,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tracks_updated_at
  before update on public.tracks
  for each row execute procedure public.set_updated_at();

-- track_versions (Tabelle anlegen, UI kommt in Phase 2)
create table public.track_versions (
  id             uuid primary key default gen_random_uuid(),
  track_id       uuid not null references public.tracks(id) on delete cascade,
  version_number integer not null,
  state_json     jsonb not null,
  area_sel_json  jsonb,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (track_id, version_number)
);

create index track_versions_by_track
  on public.track_versions(track_id, version_number desc);
