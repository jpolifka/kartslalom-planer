-- Red-Team-Review 2026-07-13: get_track_by_share_token() Lesepfad gehärtet
--
-- Zwei Findings zum selben Read-Pfad, siehe docs/track-share-links.md:
--
-- 1. "for update of t" sperrte die Track-Zeile bei JEDEM öffentlichen Abruf,
--    auch bloss lesenden. Parallele Requests auf denselben Share-Link wurden
--    dadurch serialisiert statt nur den Zähler-Update zu schützen — unnötige
--    Lock-Wartezeit und eine Verstärkung des folgenden Punkts.
--
-- 2. Der Zähler (120 Aufrufe/Stunde, hartes Limit pro Token) ist die EINZIGE
--    aktive Schutzschicht, solange das in docs/track-share-links.md als
--    "noch nicht eingerichtet" vermerkte IP-Limiting auf Cloudflare-Ebene
--    fehlt. Ein Angreifer, der einen gültigen Link kennt, konnte ihn 120x
--    abrufen und damit legitime Besucher für den Rest der Stunde aussperren
--    (DoS gegen den Track-Eigentümer). Schwelle auf 3000/h angehoben — als
--    Notfall-Bremse gegen automatisiertes Scraping gedacht, nicht als
--    praktisches Pro-Besucher-Limit, das echte Sharing-Nutzung (z. B. viele
--    Teilnehmer prüfen vor einem Renntag denselben Link) treffen könnte.
--    Echtes IP-basiertes Limiting bleibt als TODO auf Cloudflare-Ebene offen.
--
-- Ohne Row-Lock ist der Zähler nicht mehr exakt (verlorene Updates unter
-- hoher Nebenläufigkeit möglich) — akzeptabel, da er ohnehin nur
-- Verteidigungstiefe ist, kein Abrechnungs-/Sicherheitszähler.

create or replace function public.get_track_by_share_token(p_token text)
returns table(
  id            uuid,
  name          text,
  state_json    jsonb,
  manual_width  numeric,
  manual_length numeric,
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
     and p.is_deleted = false;

  if not found then
    raise exception 'token_invalid';
  end if;

  -- Einfacher Rate-Limit-Zähler pro Token (Verteidigungstiefe zusätzlich zum
  -- IP-basierten Limiting auf Cloudflare-Ebene, siehe Kommentar oben): max.
  -- 3000 Aufrufe/Stunde. "t.id" statt "id": unqualifiziert wäre es
  -- mehrdeutig gegenüber dem gleichnamigen RETURNS-TABLE-Ausgabeparameter
  -- "id" dieser Funktion.
  if v_window_started_at is null or now() - v_window_started_at > interval '1 hour' then
    update public.tracks t
       set share_access_count = 1, share_window_started_at = now()
     where t.id = v_track_id;
  elsif v_access_count >= 3000 then
    raise exception 'rate_limit_exceeded';
  else
    update public.tracks t
       set share_access_count = share_access_count + 1
     where t.id = v_track_id;
  end if;

  return query
    select t.id, t.name, t.state_json, t.manual_width, t.manual_length, t.updated_at
      from public.tracks t
     where t.id = v_track_id;
end;
$$;
