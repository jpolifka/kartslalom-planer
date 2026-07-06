-- Phase 2: Öffentliche Track-Share-Links
-- Quelle: Produktentscheidung 2026-07-06 (siehe Roadmap-Notizen) — bewusst
-- einfach gehalten: 1 aktiver Link pro Strecke (kein Verlauf mehrerer
-- Tokens), kein Ablaufdatum, jederzeit widerrufbar, neues Erzeugen ersetzt
-- den alten Link. Nutzt die bereits in 20260615120000_app_schema.sql
-- vorbereiteten Spalten `tracks.is_public` / `tracks.public_token_hash`
-- statt einer eigenen Tabelle — es gibt ohnehin nie mehr als einen aktiven
-- Token pro Strecke.
--
-- Rate-Limiting: IP-basiertes Limiting gehört auf die Cloudflare-Ebene vor
-- Kong (siehe docs/export.md / Betriebs-Doku) und ist kein Teil dieser
-- Migration. Zusätzlich als Verteidigungstiefe: ein einfacher, pro Token
-- geführter Zähler in get_track_by_share_token() (max. 120 Aufrufe/Stunde).

create extension if not exists pgcrypto with schema extensions;

alter table public.tracks
  add column share_access_count integer not null default 0,
  add column share_window_started_at timestamptz;

-- ── create_track_share_link ──────────────────────────────────────────────────
-- Erstellt (oder ersetzt) den Share-Link einer Strecke. Gibt den Plaintext-
-- Token EINMALIG zurück — gespeichert wird nur dessen SHA-256-Hash.

create or replace function public.create_track_share_link(p_track_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_tier  text;
  v_token text;
begin
  select tier into v_tier
  from public.profiles
  where id = auth.uid()
    and is_deleted = false;

  if v_tier is null then
    raise exception 'account_deleted';
  end if;

  if v_tier = 'free' then
    raise exception 'share_requires_pro';
  end if;

  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.tracks
     set is_public               = true,
         public_token_hash       = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         share_access_count      = 0,
         share_window_started_at = null
   where id = p_track_id and owner_id = auth.uid();

  return v_token;
end;
$$;

grant execute on function public.create_track_share_link(uuid) to authenticated;

-- ── revoke_track_share_link ───────────────────────────────────────────────────

create or replace function public.revoke_track_share_link(p_track_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  update public.tracks
     set is_public               = false,
         public_token_hash       = null,
         share_access_count      = 0,
         share_window_started_at = null
   where id = p_track_id and owner_id = auth.uid();
end;
$$;

grant execute on function public.revoke_track_share_link(uuid) to authenticated;

-- ── get_track_by_share_token ──────────────────────────────────────────────────
-- Öffentlich (anon + authenticated), kein Ownership-Check. Reduzierter
-- Feldsatz ohne owner_id/E-Mail (analog get_library_formations). Ungültiger
-- UND widerrufener Token liefern denselben Fehler ('token_invalid') — kein
-- Unterschied nach außen, der Enumeration begünstigen würde. Ein gelöschter
-- Track (Zeile weg) oder ein soft-gelöschter Account (is_deleted=true, Join
-- unten) machen den Link automatisch ungültig, ohne dass revoke_track_share_link
-- explizit aufgerufen werden müsste.

create or replace function public.get_track_by_share_token(p_token text)
returns table(
  id            uuid,
  name          text,
  state_json    jsonb,
  area_sel_json jsonb,
  manual_width  numeric,
  manual_length numeric,
  map_satellite boolean,
  map_opacity   numeric,
  updated_at    timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_hash              text;
  v_track_id          uuid;
  v_access_count      integer;
  v_window_started_at timestamptz;
begin
  if p_token is null or length(p_token) = 0 then
    raise exception 'token_invalid';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select t.id, t.share_access_count, t.share_window_started_at
    into v_track_id, v_access_count, v_window_started_at
    from public.tracks t
    join public.profiles p on p.id = t.owner_id
   where t.is_public = true
     and t.public_token_hash = v_hash
     and p.is_deleted = false
   for update of t;

  if not found then
    raise exception 'token_invalid';
  end if;

  -- Einfacher Rate-Limit-Zähler pro Token (Verteidigungstiefe zusätzlich zum
  -- IP-basierten Limiting auf Cloudflare-Ebene): max. 120 Aufrufe/Stunde.
  -- "t.id" statt "id": unqualifiziert wäre es mehrdeutig gegenüber dem
  -- gleichnamigen RETURNS-TABLE-Ausgabeparameter "id" dieser Funktion.
  if v_window_started_at is null or now() - v_window_started_at > interval '1 hour' then
    update public.tracks t
       set share_access_count = 1, share_window_started_at = now()
     where t.id = v_track_id;
  elsif v_access_count >= 120 then
    raise exception 'rate_limit_exceeded';
  else
    update public.tracks t
       set share_access_count = share_access_count + 1
     where t.id = v_track_id;
  end if;

  return query
    select t.id, t.name, t.state_json, t.area_sel_json,
           t.manual_width, t.manual_length, t.map_satellite, t.map_opacity,
           t.updated_at
      from public.tracks t
     where t.id = v_track_id;
end;
$$;

grant execute on function public.get_track_by_share_token(text) to anon, authenticated;
