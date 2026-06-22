# Kartslalom Streckenplaner — Custom-Hindernis-Editor (Community-Formationen)

**Dokument-Version:** 1.2
**Erstellt:** 2026-06-15
**Zuletzt geändert:** 2026-06-15
**Änderungen v1.1:** Review-Feedback eingearbeitet — `profiles.email`-Bezug
geklärt, `auth.uid()`-Checks und Eingabe-/Kategorie-Validierung in allen RPCs,
neue Admin-Read-RPCs (`admin_list_custom_formations`,
`admin_get_custom_formation`), `admin_update_custom_formation` aktualisiert
Metadaten (Pylonenzahl, lichte Breite, Dauer, Richtung) konsistent, Indizes
ergänzt.
**Änderungen v1.2:** Kleinere Härtungen — `admin_promote_to_library` prüft
`not_found`, `too_many_cones`-Check auch in `admin_update_custom_formation`,
serverseitige `name`-Validierung (1–80 Zeichen) in allen Schreib-RPCs,
`username`-Eindeutigkeit case-insensitiv (`lower(username)`-Index), neue RPC
`unshare_custom_formation` inkl. Status-Reset auf `private`.
**Autor:** Claude Sonnet 4.6 (Analyse-Agent)
**Referenz:** `SAAS_PLAN.md` v1.2, `IMPLEMENTATION_PLAN.md` v2.1
**Zweck:** Maschinenlesbares Planungsdokument für das Feature "Nutzer bauen eigene
Hindernisse (Formationen) per WYSIWYG-Editor, speichern, teilen, Admin-Workflows".
Ergänzt — duplisiert nicht — die bestehenden Pläne.

---

## 1. Geltungsbereich

Dieses Dokument beschreibt **ausschließlich** das Custom-Formation-Feature:

- Login-Pflicht für das Erstellen/Bearbeiten von Hindernissen (Voraussetzung:
  `IMPLEMENTATION_PLAN.md` Phase 1 "Login + Cloud Save")
- Vorbereitung auf ein zukünftiges Premium-Modell, ohne dass ein solches Modell
  heute existiert
- Sharing von Hindernissen an andere User (Username **oder** E-Mail, Nextcloud-Stil)
- Admin-Funktionalität: Übernahme in die allgemeine Bibliothek, Löschen,
  Weiterbearbeiten im Admin-Kontext
- WYSIWYG-Editor (online-fähig) mit Regel-Einhaltung (50 cm lichte
  Pylon-Mindestbreite, Fahrspurbreite+40 cm lichte Torbreite), Meta-Informationen,
  Pfeilen als Teil des Hindernisses
- Neue Formations-Kategorie "Individuell"

Alle übrigen SaaS-Themen (Stripe, Tiers, DSGVO-Lifecycle, Hosting) sind in
`SAAS_PLAN.md` / `IMPLEMENTATION_PLAN.md` beschrieben und werden hier nur
referenziert, nicht wiederholt.

---

## 2. Datenmodell-Erweiterungen (Supabase/Postgres)

### 2.1 `profiles` — Erweiterung

```sql
alter table public.profiles
  add column username text,               -- nullable; Pflicht-Onboarding nach Login
  add column role text not null default 'user'
    check (role in ('user', 'admin'));

-- Eindeutigkeit case-insensitiv: "Ralf" und "ralf" dürfen nicht parallel
-- existieren. Die UI normalisiert zusätzlich auf lowercase vor dem Speichern;
-- dieser Index erzwingt es serverseitig (ersetzt einen einfachen UNIQUE-Constraint).
create unique index profiles_username_lower_idx on public.profiles (lower(username));
```

`username` ist *nullable*, damit bestehende/neue Profile zunächst ohne Username
existieren können — die UI erzwingt die Vergabe vor dem ersten Zugriff auf
Dashboard-Funktionen (siehe 6.2).

`profiles.email` existiert bereits gemäß `IMPLEMENTATION_PLAN.md` Abschnitt 0.5
(`email text not null`, per Trigger `handle_new_user()` aus `auth.users`
gespiegelt) — `find_shareable_user()` (2.6) kann darauf direkt zugreifen, ohne
`auth.users` ansprechen zu müssen.

### 2.2 `custom_formations`

```sql
create table public.custom_formations (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    uuid references public.profiles(id) on delete set null,
  name                        text not null,
  description                 text,
  category                    text not null default 'individuell'
                                check (category in
                                  ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell')),
  cones_json                  jsonb not null,            -- ConePoint[]
  arrows_json                 jsonb not null default '[]', -- PlacedArrow[] (formation-lokal)
  default_direction           text,                      -- DirectionMode | null
  pylon_count                 integer not null default 0,  -- serverseitig berechnet
  lichte_breite                numeric,                   -- Meter
  duration_seconds            numeric,
  source_formation_key        text,                      -- FormationKey, falls auf Standard-Basis
  source_custom_formation_id  uuid references public.custom_formations(id) on delete set null,
  status                      text not null default 'private'
                                check (status in
                                  ('private', 'shared', 'submitted', 'library', 'rejected')),
  is_library                  boolean not null default false,
  previous_cones_json         jsonb,                     -- letzte Version vor Admin-Edit/Promote
  previous_arrows_json        jsonb,
  edited_by_admin_id          uuid references public.profiles(id) on delete set null,
  edited_by_admin_at          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger custom_formations_updated_at
  before update on public.custom_formations
  for each row execute procedure public.set_updated_at();  -- existiert bereits (Phase 0)

create index custom_formations_owner_idx   on public.custom_formations(owner_id);
create index custom_formations_library_idx on public.custom_formations(is_library);
```

`owner_id` nutzt `on delete set null` (nicht `cascade`): Library-Formationen
sollen eine Account-Löschung des Erstellers überleben (siehe 9.4).

### 2.3 `formation_shares`

```sql
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
```

### 2.4 `app_config` — Premium-Vorbereitung ohne Tarif-Modell

```sql
create table public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('custom_formations_required_tier', 'null'::jsonb);
```

`value = null` bedeutet: Feature ist für **alle eingeloggten User** frei
nutzbar. Wird später `'"pro"'` o. ä. gesetzt, greift das Premium-Gate in
`create_custom_formation()` (siehe 2.6) — **ohne Code-Änderung**, sobald ein
Tarif-Modell existiert (`profiles.tier` ist bereits in `SAAS_PLAN.md` als
`free|pro|team` vorgesehen).

### 2.5 Row Level Security

```sql
alter table public.custom_formations enable row level security;
alter table public.formation_shares  enable row level security;
alter table public.app_config        enable row level security;
```

**custom_formations — Lesen**

```sql
-- Eigene Formationen
create policy "custom_formations_select_own" on public.custom_formations
  for select using (owner_id = auth.uid());

-- Mit mir geteilte Formationen
create policy "custom_formations_select_shared" on public.custom_formations
  for select using (
    exists (select 1 from public.formation_shares fs
            where fs.formation_id = id and fs.shared_with_id = auth.uid())
  );

-- Bibliothek: öffentlich lesbar, auch für Gäste (anon)
create policy "custom_formations_select_library" on public.custom_formations
  for select using (is_library = true);
```

**Schreiben: komplett gesperrt für Client, nur via SECURITY DEFINER RPCs**

```sql
revoke insert, update, delete on public.custom_formations from anon, authenticated;
revoke insert, update, delete on public.formation_shares   from anon, authenticated;

-- app_config: lesbar für alle (Feature-Flags müssen im Client auswertbar sein)
create policy "app_config_select_all" on public.app_config for select using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;
```

**formation_shares — Lesen**

```sql
create policy "formation_shares_select" on public.formation_shares
  for select using (shared_with_id = auth.uid() or shared_by_id = auth.uid());
```

### 2.6 SECURITY DEFINER Funktionen

**create_custom_formation — Premium-Gate + Limits**

```sql
create or replace function public.create_custom_formation(
  p_name              text,
  p_description       text,
  p_category          text,
  p_cones_json        jsonb,
  p_arrows_json       jsonb,
  p_default_direction text,
  p_lichte_breite     numeric,
  p_duration_seconds  numeric,
  p_source_formation_key       text,
  p_source_custom_formation_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_required_tier jsonb;
  v_tier          text;
  v_count         integer;
  v_cone_count    integer;
  v_pylon_count   integer;
  v_new_id        uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if length(trim(p_name)) < 1 or length(p_name) > 80 then
    raise exception 'invalid_name';
  end if;

  if p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  if jsonb_typeof(p_cones_json) <> 'array' then
    raise exception 'invalid_cones_json';
  end if;
  if jsonb_typeof(p_arrows_json) <> 'array' then
    raise exception 'invalid_arrows_json';
  end if;

  -- Premium-Gate: heute null -> kein Limit
  select value into v_required_tier from public.app_config
    where key = 'custom_formations_required_tier';

  if v_required_tier is not null and v_required_tier <> 'null'::jsonb then
    select tier into v_tier from public.profiles where id = auth.uid();
    if not (
      (v_required_tier #>> '{}') = 'free'
      or ((v_required_tier #>> '{}') = 'pro'  and v_tier in ('pro', 'team'))
      or ((v_required_tier #>> '{}') = 'team' and v_tier = 'team')
    ) then
      raise exception 'premium_required' using hint = v_required_tier #>> '{}';
    end if;
  end if;

  -- Abuse-Schutz: max. 100 eigene Custom-Formationen, max. 40 Cones je Formation
  select count(*) into v_count from public.custom_formations where owner_id = auth.uid();
  if v_count >= 100 then
    raise exception 'custom_formation_limit_reached';
  end if;

  select jsonb_array_length(p_cones_json) into v_cone_count;
  if v_cone_count > 40 then
    raise exception 'too_many_cones';
  end if;

  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  insert into public.custom_formations (
    owner_id, name, description, category, cones_json, arrows_json,
    default_direction, pylon_count, lichte_breite, duration_seconds,
    source_formation_key, source_custom_formation_id
  ) values (
    auth.uid(), p_name, p_description, p_category, p_cones_json, p_arrows_json,
    p_default_direction, v_pylon_count, p_lichte_breite, p_duration_seconds,
    p_source_formation_key, p_source_custom_formation_id
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_custom_formation(
  text, text, text, jsonb, jsonb, text, numeric, numeric, text, uuid
) to authenticated;
```

**update_custom_formation — Owner ODER `permission='edit'`-Share**

```sql
create or replace function public.update_custom_formation(
  p_id                uuid,
  p_name              text,
  p_description       text,
  p_category          text,
  p_cones_json        jsonb,
  p_arrows_json       jsonb,
  p_default_direction text,
  p_lichte_breite     numeric,
  p_duration_seconds  numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_pylon_count integer;
  v_can_edit    boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if length(trim(p_name)) < 1 or length(p_name) > 80 then
    raise exception 'invalid_name';
  end if;

  if p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  if jsonb_typeof(p_cones_json) <> 'array' then
    raise exception 'invalid_cones_json';
  end if;
  if jsonb_typeof(p_arrows_json) <> 'array' then
    raise exception 'invalid_arrows_json';
  end if;

  select
    (owner_id = auth.uid())
    or exists (
      select 1 from public.formation_shares fs
      where fs.formation_id = p_id and fs.shared_with_id = auth.uid()
        and fs.permission = 'edit'
    )
  into v_can_edit
  from public.custom_formations where id = p_id;

  if not coalesce(v_can_edit, false) then
    raise exception 'not_authorized';
  end if;

  if jsonb_array_length(p_cones_json) > 40 then
    raise exception 'too_many_cones';
  end if;

  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  update public.custom_formations set
    name = p_name, description = p_description, category = p_category,
    cones_json = p_cones_json, arrows_json = p_arrows_json,
    default_direction = p_default_direction, pylon_count = v_pylon_count,
    lichte_breite = p_lichte_breite, duration_seconds = p_duration_seconds
  where id = p_id;
end;
$$;

grant execute on function public.update_custom_formation(
  uuid, text, text, text, jsonb, jsonb, text, numeric, numeric
) to authenticated;
```

**delete_custom_formation — nur Owner**

```sql
create or replace function public.delete_custom_formation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.custom_formations where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'not_authorized';
  end if;
end;
$$;

grant execute on function public.delete_custom_formation(uuid) to authenticated;
```

**find_shareable_user — Username ODER E-Mail, kein Enumeration-Leak**

```sql
create or replace function public.find_shareable_user(p_query text)
returns table(id uuid, username text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  return query
    select p.id, p.username from public.profiles p
    where (p.username = p_query or p.email = p_query)
      and p.id <> auth.uid()
      and p.is_deleted = false
    limit 1;
end;
$$;

grant execute on function public.find_shareable_user(text) to authenticated;
```

Liefert nur bei **exaktem** Treffer ein Ergebnis (kein Teilstring-Match) — die
UI zeigt bei leerem Ergebnis "Nutzer nicht gefunden", was ein gewisses
Enumeration-Risiko birgt (üblich bei Sharing-Features, vgl. Nextcloud), aber
keine Teilstring-Suche über alle User erlaubt.

**share_custom_formation**

```sql
create or replace function public.share_custom_formation(
  p_formation_id uuid,
  p_target_id    uuid,
  p_permission   text default 'view'
) returns void language plpgsql security definer set search_path = public as $$
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

  if p_permission not in ('view', 'edit') then
    raise exception 'invalid_permission';
  end if;

  insert into public.formation_shares (formation_id, shared_with_id, shared_by_id, permission)
  values (p_formation_id, p_target_id, auth.uid(), p_permission)
  on conflict (formation_id, shared_with_id)
    do update set permission = excluded.permission;

  update public.custom_formations set status = 'shared'
    where id = p_formation_id and status = 'private';
end;
$$;

-- Gegenstück zu share_custom_formation: entfernt einen einzelnen Share und
-- setzt status zurück auf 'private', falls keine Shares mehr bestehen.
-- status in ('submitted','library','rejected') wird NICHT verändert, da diese
-- unabhängig vom Sharing-Status sind (Admin-Workflow, siehe 6).
create or replace function public.unshare_custom_formation(
  p_formation_id uuid,
  p_target_id    uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_remaining integer;
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

  delete from public.formation_shares
    where formation_id = p_formation_id and shared_with_id = p_target_id;

  select count(*) into v_remaining from public.formation_shares
    where formation_id = p_formation_id;

  if v_remaining = 0 then
    update public.custom_formations set status = 'private'
      where id = p_formation_id and status = 'shared';
  end if;
end;
$$;

grant execute on function public.share_custom_formation(uuid, uuid, text) to authenticated;
grant execute on function public.unshare_custom_formation(uuid, uuid) to authenticated;
```

**Admin-RPCs — Rolle wird serverseitig aus `profiles.role` geprüft**

```sql
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

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  -- KOPIE anlegen, Original bleibt unverändert beim Ersteller
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

  return v_new_id;
end;
$$;

create or replace function public.admin_delete_custom_formation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  delete from public.custom_formations where id = p_id;
end;
$$;

-- Admin-Read-Pfad: RLS (2.5) lässt Admins nur eigene/geteilte/Library-Formationen
-- sehen. Für /admin/formations (6) wird daher ein eigener Read-RPC benötigt,
-- der die Rolle prüft und anschließend RLS via SECURITY DEFINER umgeht.
create or replace function public.admin_list_custom_formations(
  p_status   text default null,
  p_category text default null
) returns setof public.custom_formations
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  if p_status is not null
     and p_status not in ('private', 'shared', 'submitted', 'library', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if p_category is not null
     and p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  return query
    select * from public.custom_formations cf
    where (p_status is null or cf.status = p_status)
      and (p_category is null or cf.category = p_category)
    order by cf.created_at desc;
end;
$$;

-- Admin-Read für eine einzelne Formation (z. B. zum Öffnen im Editor, 6 "Weiterbearbeiten")
create or replace function public.admin_get_custom_formation(p_id uuid)
returns public.custom_formations
language plpgsql security definer set search_path = public as $$
declare
  v_role  text;
  v_row   public.custom_formations;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  select * into v_row from public.custom_formations where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_update_custom_formation(
  p_id                uuid,
  p_name              text,
  p_description       text,
  p_category          text,
  p_cones_json        jsonb,
  p_arrows_json       jsonb,
  p_default_direction text,
  p_lichte_breite     numeric,
  p_duration_seconds  numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_role        text;
  v_pylon_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if length(trim(p_name)) < 1 or length(p_name) > 80 then
    raise exception 'invalid_name';
  end if;

  if p_category not in ('start_ziel', 'basis', 'kurven', 'komplex', 'individuell') then
    raise exception 'invalid_category';
  end if;

  if jsonb_typeof(p_cones_json) <> 'array' then
    raise exception 'invalid_cones_json';
  end if;
  if jsonb_typeof(p_arrows_json) <> 'array' then
    raise exception 'invalid_arrows_json';
  end if;
  if jsonb_array_length(p_cones_json) > 40 then
    raise exception 'too_many_cones';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'not_authorized';
  end if;

  -- pylon_count wird wie in create/update_custom_formation serverseitig neu
  -- berechnet, damit Metadaten nach einer Admin-Bearbeitung konsistent bleiben.
  select count(*) into v_pylon_count
    from jsonb_array_elements(p_cones_json) c
    where c->>'kind' in ('standing', 'lying');

  update public.custom_formations set
    previous_cones_json  = cones_json,
    previous_arrows_json = arrows_json,
    name = p_name, description = p_description, category = p_category,
    cones_json = p_cones_json, arrows_json = p_arrows_json,
    pylon_count = v_pylon_count,
    default_direction = p_default_direction,
    lichte_breite = p_lichte_breite,
    duration_seconds = p_duration_seconds,
    edited_by_admin_id = auth.uid(), edited_by_admin_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.admin_promote_to_library(uuid, text) to authenticated;
grant execute on function public.admin_delete_custom_formation(uuid) to authenticated;
grant execute on function public.admin_list_custom_formations(text, text) to authenticated;
grant execute on function public.admin_get_custom_formation(uuid) to authenticated;
grant execute on function public.admin_update_custom_formation(
  uuid, text, text, text, jsonb, jsonb, text, numeric, numeric
) to authenticated;
```

---

## 3. Typsystem-Erweiterungen (`src/types.ts`)

```typescript
export type FormationCategory =
  | "start_ziel"
  | "basis"
  | "kurven"
  | "komplex"
  | "individuell";          // NEU (Punkt 4)

export type CustomFormationStatus =
  | "private"
  | "shared"
  | "submitted"
  | "library"
  | "rejected";

export type CustomFormationMeta = {
  id: string;
  ownerId: string | null;
  ownerUsername?: string;
  name: string;                       // Punkt 2.3.4
  description?: string;
  category: FormationCategory;
  status: CustomFormationStatus;
  isLibrary: boolean;
  pylonCount: number;                 // Punkt 2.3.1 — serverseitig berechnet
  lichteBreite?: number;              // Punkt 2.3.3
  durationSeconds?: number;           // Punkt 2.3.2
  sourceFormationKey?: FormationKey;
  sourceCustomFormationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomFormationDefinition = CustomFormationMeta & {
  cones: ConePoint[];
  arrows: PlacedArrow[];              // formation-lokale Koordinaten (Punkt 2.4)
  defaultDirection?: DirectionMode;
};
```

**`PlacedFormation` — Erweiterung für Custom-Formationen**

```typescript
export type PlacedFormation = {
  id: string;
  key: FormationKey;                  // unverändert für Standard-Formationen
  x: number;
  y: number;
  rotationDeg: number;
  direction: DirectionMode;
  durationSeconds?: number;

  // NEU — nur gesetzt, wenn key auf eine Custom-Formation verweist
  customFormationId?: string;
  customSnapshot?: {
    cones: ConePoint[];
    arrows: PlacedArrow[];
    label: string;
  };
};
```

`key` bekommt für Custom-Formationen den Literalwert `"custom"`
(neuer Eintrag in `FormationKey`). `getFormation()` in `formationRegistry.ts`
erhält einen zweiten, optionalen Parameter für den Custom-Fall: wenn
`key === "custom"`, wird die Definition aus `customSnapshot` (denormalisiert,
siehe 9.1) statt aus `RAW_FORMATIONS` gebaut. Bestehende Aufrufe von
`getFormation(key)` für Standard-Formationen bleiben unverändert.

---

## 4. WYSIWYG-Hindernis-Editor

Neue Komponente `FormationEditorCanvas` (Arbeitstitel), die bewusst Code aus
`TrackCanvas.tsx` wiederverwendet (Grid, Drag & Drop, Multi-Select, Rotation,
Undo/Redo-Pattern aus dem `trackReducer` in `App.tsx`), aber im
**Single-Formation-Modus** arbeitet: ein Hindernis statt einer ganzen Strecke,
Koordinatenursprung = Formation-lokal (wie bei `normalizeCones`).

### 4.1 Werkzeuge

```yaml
cone_tools: [standing, lying, sensor]   # bestehende ConeKind-Werte aus types.ts
arrow_tool: true                         # PlacedArrow, formation-lokale Koordinaten (Punkt 2.4)
rotation: "0/90/180/270°, wie bei bestehenden Kurven-Formationen"
multi_select_move: "wiederverwendet aus TrackCanvas"
undo_redo: "wiederverwendet aus App.tsx trackReducer-Pattern"
```

### 4.2 Regel-Overlays (Online-Validierung während des Bauens)

```yaml
regel_pylon_mindestabstand:
  bezeichnung: "50 cm lichte Breite zwischen Pylonen"
  konstante: PYLON_GAP            # 0.5 m, src/lib/formations/common.ts
  pruefung: "Kante-zu-Kante-Abstand zwischen je zwei Pylonen >= 0.5 m"
  implementierung: >
    Reuse der cone_too_close-Logik aus validation/geometry.ts
    (Schwellwert ist dort bereits 0.5 m) — als Live-Overlay im Editor,
    nicht erst beim Speichern.

regel_tor_lichte_breite:
  bezeichnung: "Fahrspurbreite + 40 cm lichte Torbreite"
  konstante: TASK_LANE_WIDTH      # 1.65 m = SLICK_TRACK_WIDTH(1.25) + 0.4
  mechanismus: >
    Im Editor können zwei Pylonen als "Tor-Paar" markiert werden.
    Lichte Breite = Mittelpunktabstand - PYLON_FOOT_SIZE (0.30 m).
    Live-Anzeige des berechneten Werts; Warnung (severity: warning),
    wenn < TASK_LANE_WIDTH (1.65 m).
  uebernahme_meta: "Ergebnis wird als Vorschlag in das Meta-Feld 'lichteBreite' übernommen"
```

Beide Regeln referenzieren ausschließlich die bestehenden Konstanten aus
`src/lib/formations/common.ts` (`PYLON_GAP`, `PYLON_FOOT_SIZE`,
`TASK_LANE_WIDTH`, `PYLON_SPACING`) — keine neuen Magic Numbers.

### 4.3 Meta-Informationen (Punkt 2.3)

```yaml
name:
  pflichtfeld: true                 # Punkt 2.3.4

pylon_count:
  quelle: "automatisch berechnet = Anzahl cones mit kind in (standing, lying)"
  anzeige: "read-only im Meta-Panel"   # Punkt 2.3.1

duration_seconds:
  eingabe: "Zahlenfeld, analog DEFAULT_DURATIONS-Pattern in formationRegistry.ts"
  # Punkt 2.3.2

lichte_breite:
  quelle: "aus Tor-Paar-Markierung (4.2) übernommen, manuell überschreibbar"
  # Punkt 2.3.3
```

### 4.4 Basis-Auswahl (Punkt 3)

```yaml
optionen:
  - "Leer starten"
  - "Bestehende Standard-Formation duplizieren (aus RAW_FORMATIONS)
     -> sourceFormationKey gesetzt, cones via normalizeCones() übernommen"
  - "Eigene oder geteilte Custom-Formation duplizieren
     -> sourceCustomFormationId gesetzt"
```

### 4.5 Kategorie-Auswahl (Punkt 4)

`category`-Feld im Meta-Panel, Werte: `start_ziel | basis | kurven | komplex |
individuell`. Default für neue Custom-Formationen: `individuell`.

### 4.6 Validierungs-Pipeline

Die bestehende Pipeline (`runValidation`, `validation/geometry.ts`,
`validation/track.ts`) arbeitet generisch auf `worldCones` und benötigt
**keine Änderung**, um platzierte Custom-Formationen auf einer Strecke zu
prüfen — die `cones` kommen für `key === "custom"` aus `customSnapshot` statt
aus der Registry.

---

## 5. Sharing (Nextcloud-Stil)

```yaml
flow:
  1: "Such-Eingabe akzeptiert Username ODER E-Mail-Adresse"
  2: "find_shareable_user(query) -> exakter Treffer {id, username} oder leer"
  3: "share_custom_formation(formation_id, target_id, permission: view|edit)"
  4: "Empfänger sieht Formation unter 'Geteilt mit mir' (Status: shared)"

permissions:
  view: "Empfänger kann Formation platzieren/duplizieren (eigene Kopie via
         sourceCustomFormationId), aber nicht das Original verändern"
  edit: "Empfänger kann das Original direkt über update_custom_formation
         bearbeiten (Berechtigung wird dort geprüft)"

unshare:
  rpc: "unshare_custom_formation(formation_id, target_id)"
  verhalten: >
    Entfernt einen einzelnen Share-Eintrag. Bestehen danach keine weiteren
    formation_shares-Einträge mehr, wechselt status von 'shared' zurück auf
    'private'. status in (submitted, library, rejected) bleibt unberührt.
```

### 5.1 Username-Onboarding

```yaml
trigger: "Erster Login nach Implementierung von Phase 1 (Login),
          falls profiles.username IS NULL"
ui: "Pflicht-Dialog 'Wähle deinen Benutzernamen' vor Zugriff auf Dashboard
     (AuthGuard-Erweiterung, ähnlich AuthCallbackPage-Redirect-Logik)"
validierung: "eindeutig (DB unique constraint), 3-24 Zeichen, [a-z0-9_-]"
```

---

## 6. Admin-Funktionalität (Punkt 1.3)

```yaml
admin_dashboard:
  route: "/admin/formations"
  zugriff: >
    Eigene Route-Guard-Variante (analog AuthGuard.tsx), die zusätzlich
    profiles.role === 'admin' prüft. Die Rolle wird NIE vom Client
    übernommen — jede Admin-RPC prüft role serverseitig erneut (2.6).

  ansichten:
    liste:
      datenquelle: "admin_list_custom_formations(status?, category?) — SECURITY DEFINER,
                    umgeht die User-Select-Policies aus 2.5 nach serverseitiger
                    role='admin'-Prüfung"
      filter: [status, category, owner]
      spalten: [name, owner_username, category, status, pylon_count, created_at]

    uebernahme_in_bibliothek:        # Punkt 1.3.1
      aktion: "admin_promote_to_library(formation_id, category)"
      verhalten: >
        Erstellt eine KOPIE mit is_library=true. Das Original bleibt beim
        Ersteller (Status, Bearbeitungsrechte unverändert) — siehe 9.2.
        Attribution ('Erstellt von <username>') bleibt über
        source_custom_formation_id nachvollziehbar.

    loeschen:                        # Punkt 1.3.2
      aktion: "admin_delete_custom_formation(formation_id)"
      verhalten: "Löschen unabhängig vom Owner, inkl. Library-Einträgen"

    weiterbearbeiten:                # Punkt 1.3.3
      aktion: >
        Öffnet FormationEditorCanvas im Admin-Kontext: lädt beliebige Formation
        unabhängig von RLS-Sichtbarkeit via admin_get_custom_formation(id),
        speichert via admin_update_custom_formation (aktualisiert auch
        pylon_count, lichte_breite, duration_seconds, default_direction).
      audit: >
        previous_cones_json/previous_arrows_json sichern den Stand vor der
        Admin-Bearbeitung; edited_by_admin_id/_at dokumentieren wer/wann.
```

---

## 7. Premium-Vorbereitung ohne existierendes Modell (Punkt 1.1)

```yaml
mechanismus:
  tabelle: app_config
  key: "custom_formations_required_tier"
  initial_value: null    # Feature für alle eingeloggten User frei nutzbar

  create_custom_formation:
    - "liest app_config.custom_formations_required_tier"
    - "ist der Wert null -> kein Gate"
    - "ist ein Tier-Wert gesetzt (z.B. 'pro') -> Vergleich mit profiles.tier
       (free < pro < team), bei Unterdeckung: exception 'premium_required'"

  frontend:
    hook: "useFeatureGate('custom_formations')"
    verhalten_heute: "allowed = true für jeden eingeloggten User"
    aktivierung_spaeter: >
      Sobald ein Tarif-Modell existiert (SAAS_PLAN.md Tier-Definition),
      genügt das Setzen von app_config.custom_formations_required_tier
      auf 'pro' o.ä. — kein Frontend- oder RPC-Deploy nötig.
```

---

## 8. Neue Kategorie "Individuell" (Punkt 4)

`FormationCategory` wird um `"individuell"` erweitert (siehe 3). Die
Formations-Palette (UI-Gruppierung, aktuell `start_ziel | basis | kurven |
komplex`) erhält eine fünfte Gruppe **"Individuell"** mit drei Untergruppen:

```yaml
individuell_untergruppen:
  - "Meine Hindernisse"     # eigene custom_formations, status in (private, shared, submitted)
  - "Geteilt mit mir"       # via formation_shares
  - "Bibliothek"            # is_library = true, für alle inkl. Gäste sichtbar
```

---

## 9. Zusätzliche Überlegungen (Punkt 5)

### 9.1 Denormalisierte Snapshots (`customSnapshot`)

Beim Platzieren einer Custom-Formation auf einer Strecke wird `cones`/`arrows`
**eingefroren** in `PlacedFormation.customSnapshot` kopiert. Tracks bleiben
dadurch self-contained für Export/Import/PDF/SVG, auch wenn die Quell-Formation
später gelöscht oder die Freigabe entzogen wird. `exportSVG.ts` benötigt dafür
**keine Änderung der Render-Logik** — nur den Datenzugriffspfad über
`getFormation()` (siehe 3).

### 9.2 Promote-to-Library = Kopie, nicht Verschieben

`admin_promote_to_library` erzeugt einen eigenständigen Library-Eintrag. Der
Ersteller behält sein Original samt Bearbeitungsrechten — Library-Einträge und
private Originale entwickeln sich unabhängig weiter.

### 9.3 Abuse-Limits

- max. 100 eigene Custom-Formationen pro User (serverseitig in
  `create_custom_formation`, siehe 2.6) — analog zum `track_limit`-Pattern aus
  `IMPLEMENTATION_PLAN.md`. Sollte ein Premium-Tier eingeführt werden, kann
  dieser Wert tier-abhängig gestaffelt werden.
- max. 40 Cones pro Formation (Server-Check in create/update RPC).

### 9.4 DSGVO / Account-Löschung

Bei Löschung eines Accounts mit `is_library=true`-Einträgen: `owner_id` wird
durch `on delete set null` automatisch `NULL` (Bibliothek bleibt erhalten,
Attribution wird in der UI als "[gelöschter Nutzer]" angezeigt) — analog zum
Track-Anonymisierungs-Pattern aus `IMPLEMENTATION_PLAN.md` Abschnitt 1.14.
Private/geteilte (nicht-Library) Formationen werden über `formation_shares
on delete cascade` und ggf. expliziten Cleanup im
`delete-account`-Edge-Function-Flow entfernt.

### 9.5 Gast-Modus bleibt erhalten

Gäste (nicht eingeloggt) dürfen **keine** Custom-Formationen erstellen, teilen
oder bearbeiten (Login-Pflicht gem. Punkt 1). Sie **können** Library-Custom-
Formationen (`is_library = true`, RLS-Policy 2.5) lesen und im Editor
platzieren — konsistent mit dem Prinzip "Gast-Modus vollständig funktionsfähig"
aus `IMPLEMENTATION_PLAN.md` Phase 0.

### 9.6 Rate-Limiting & Input-Validierung

Neue RPCs folgen den bestehenden `api_security`-Vorgaben aus `SAAS_PLAN.md`
(Zod-Schemas im Frontend, Größenlimits, parametrisierte Queries — bereits
durch SECURITY DEFINER + `jsonb`-Parameter gegeben).

### 9.7 Konsistenz mit Pylon-Konstanten

Alle neuen Regel-Checks (4.2) referenzieren ausschließlich die bestehenden
Konstanten aus `src/lib/formations/common.ts` (`PYLON_GAP`, `TASK_LANE_WIDTH`,
`PYLON_FOOT_SIZE`, `PYLON_SPACING`) — keine neuen Magic Numbers.

---

## 10. Phasen-Roadmap (H0–H5)

Diese Phasen klinken sich in die Roadmap aus `IMPLEMENTATION_PLAN.md` ein:
**H0 läuft auf Basis von / parallel zu Phase 0+1** (Login + Cloud Save ist
Voraussetzung). H1 (Editor-Skeleton) kann bereits vor H0 begonnen werden, da er
zunächst ohne Backend-Anbindung auskommt.

```yaml
phase_H0:
  name: "Fundament"
  voraussetzung: "IMPLEMENTATION_PLAN.md Phase 0 + 1 (Login + Cloud Save)"
  scope:
    - "profiles: username (unique, nullable), role"
    - "Tabellen custom_formations, formation_shares, app_config + RLS-Grundgerüst (2.5)"
    - "Seed app_config.custom_formations_required_tier = null"
    - "SECURITY DEFINER Funktionen aus 2.6"

phase_H1:
  name: "Editor-Skeleton (lokal, ohne Backend)"
  scope:
    - "types.ts: FormationCategory 'individuell', CustomFormationDefinition,
       PlacedFormation-Erweiterung (Abschnitt 3)"
    - "FormationEditorCanvas: Cone-/Pfeil-Editing, Rule-Overlays (4.2), Meta-Panel (4.3)"
    - "Basis-Auswahl: leer / Standard-Formation duplizieren (4.4, erster Teil)"

phase_H2:
  name: "Cloud-Integration"
  voraussetzung: H0
  scope:
    - "create/update/delete_custom_formation RPC-Anbindung inkl. Premium-Gate (7)"
    - "'Meine Hindernisse'-Bereich im Dashboard"
    - "useFeatureGate('custom_formations')"
    - "Duplizieren eigener/geteilter Custom-Formationen (4.4, zweiter Teil)"

phase_H3:
  name: "Sharing"
  voraussetzung: H2
  scope:
    - "Username-Onboarding-Dialog (5.1)"
    - "find_shareable_user, share_custom_formation Anbindung"
    - "'Geteilt mit mir'-Ansicht, Permission view/edit"

phase_H4:
  name: "Admin"
  voraussetzung: H2
  scope:
    - "/admin/formations Dashboard (6)"
    - "admin_promote_to_library, admin_delete_custom_formation, admin_update_custom_formation"
    - "Audit-Anzeige (edited_by_admin_id/_at, previous_*_json-Diff)"

phase_H5:
  name: "Library-Integration & Export-Robustheit"
  voraussetzung: [H2, H4]
  scope:
    - "Library-Custom-Formationen in Palette/Registry mergen, inkl. Gast-Zugriff (8, 9.5)"
    - "customSnapshot-Denormalisierung in PlacedFormation (9.1), Export/Import/SVG-Pfade verifizieren"
    - "Attribution-UI ('Erstellt von <username>' / '[gelöschter Nutzer]')"
```

---

*Dieses Dokument ist maschinenlesbar strukturiert (YAML/SQL-Blöcke in Markdown)
und ergänzt `SAAS_PLAN.md` v1.2 und `IMPLEMENTATION_PLAN.md` v2.1.*
