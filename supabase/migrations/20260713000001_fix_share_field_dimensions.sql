-- Fix: Share-Ansicht zeigte bei Strecken mit aktivem Kartenhintergrund ein
-- falsch skaliertes/verzerrtes Bild.
--
-- Ursache: get_track_by_share_token() liefert manual_width/manual_length
-- zurueck. Diese Spalten enthalten aber IMMER nur die reinen "manueller
-- Modus"-Eingabewerte (Default 18x36) — src/pages/EditorPage.tsx haelt die
-- tatsaechlich fuer die Item-Platzierung genutzte Feldgroesse separat vor:
--   fieldWidth  = areaSel ? areaSel.widthM  : manualWidth
--   fieldLength = areaSel ? areaSel.heightM : manualLength
-- Bei aktivem Kartenausschnitt liegen Item-Koordinaten also im Bereich der
-- (i. d. R. deutlich groesseren) areaSel-Masse, waehrend manual_width/
-- manual_length weiterhin die kleinen Default-Werte sind. Der oeffentliche
-- Share-Viewer (SharedTrackPage.tsx) nutzt manual_width/manual_length direkt
-- als SVG-Skalierungsbasis (scale = SVG_WIDTH / fieldWidth) — Items landen
-- dadurch groesstenteils ausserhalb der viewBox, das Ergebnis ist ein
-- abgeschnittenes/verzerrtes Bild.
--
-- Fix: manual_width/manual_length in der RPC-Antwort auf die tatsaechlich
-- genutzte Feldgroesse umstellen (area_sel_json, falls gesetzt, sonst
-- weiterhin manual_width/manual_length). Es werden bewusst NUR widthM/
-- heightM aus area_sel_json gelesen — centerLat/centerLng/rotationDeg (die
-- genaue Geoposition) bleiben wie zuvor unveroeffentlicht, siehe Kommentar
-- in 20260706000001_track_share_links.sql. Rueckgabetyp/-signatur bleiben
-- unveraendert (weiterhin "manual_width"/"manual_length" numeric) — kein
-- DROP FUNCTION noetig, nur der SELECT-Teil aendert sich.

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
     and p.is_deleted = false
   for update of t;

  if not found then
    raise exception 'token_invalid';
  end if;

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
    select
      t.id,
      t.name,
      t.state_json,
      coalesce((t.area_sel_json ->> 'widthM')::numeric, t.manual_width)   as manual_width,
      coalesce((t.area_sel_json ->> 'heightM')::numeric, t.manual_length) as manual_length,
      t.updated_at
      from public.tracks t
     where t.id = v_track_id;
end;
$$;

grant execute on function public.get_track_by_share_token(text) to anon, authenticated;
