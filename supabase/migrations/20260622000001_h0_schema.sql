-- H0: Custom-Formationen — Schema

-- profiles erweitern
alter table public.profiles
  add column username text,
  add column role text not null default 'user'
    check (role in ('user', 'admin'));

create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- custom_formations
create table public.custom_formations (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    uuid references public.profiles(id) on delete set null,
  name                        text not null,
  description                 text,
  category                    text not null default 'individuell'
                                check (category in
                                  ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell')),
  cones_json                  jsonb not null,
  arrows_json                 jsonb not null default '[]',
  default_direction           text,
  pylon_count                 integer not null default 0,
  lichte_breite               numeric,
  duration_seconds            numeric,
  source_formation_key        text,
  source_custom_formation_id  uuid references public.custom_formations(id) on delete set null,
  status                      text not null default 'private'
                                check (status in
                                  ('private', 'shared', 'submitted', 'library', 'rejected')),
  is_library                  boolean not null default false,
  previous_cones_json         jsonb,
  previous_arrows_json        jsonb,
  edited_by_admin_id          uuid references public.profiles(id) on delete set null,
  edited_by_admin_at          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger custom_formations_updated_at
  before update on public.custom_formations
  for each row execute procedure public.set_updated_at();

create index custom_formations_owner_idx   on public.custom_formations(owner_id);
create index custom_formations_library_idx on public.custom_formations(is_library);

-- formation_shares
create table public.formation_shares (
  id              uuid primary key default gen_random_uuid(),
  formation_id    uuid not null references public.custom_formations(id) on delete cascade,
  shared_with_id  uuid not null references public.profiles(id) on delete cascade,
  shared_by_id    uuid not null references public.profiles(id) on delete cascade,
  permission      text not null default 'view' check (permission in ('view', 'edit')),
  created_at      timestamptz not null default now(),
  unique (formation_id, shared_with_id)
);

create index formation_shares_shared_with_idx on public.formation_shares(shared_with_id);
create index formation_shares_formation_idx   on public.formation_shares(formation_id);

-- app_config
create table public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('custom_formations_required_tier', 'null'::jsonb);
