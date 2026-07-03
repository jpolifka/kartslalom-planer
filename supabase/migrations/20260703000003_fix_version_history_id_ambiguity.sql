-- Bugfix: get_track_versions und get_track_version_detail als language sql neu schreiben.
-- plpgsql RETURNS TABLE erzeugt OUT-Parameter "id" / "version_number" etc., die
-- mit der Spalte aus der Query kollidieren → "column reference 'id' is ambiguous" (SQLSTATE 42702).
-- language sql hat keinen plpgsql-Variablen-Scope — keine Ambiguität.
-- Ownership-Check via EXISTS-Subquery (kein RAISE EXCEPTION in language sql möglich;
-- fehlendes Match liefert einfach ein leeres Resultset).

drop function if exists public.get_track_versions(uuid);
drop function if exists public.get_track_version_detail(uuid);

create function public.get_track_versions(p_track_id uuid)
returns table (
  id             uuid,
  version_number integer,
  created_at     timestamptz
) language sql security definer set search_path = public as $$
  select v.id, v.version_number, v.created_at
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    where v.track_id = p_track_id
      and t.owner_id = auth.uid()
    order by v.version_number desc;
$$;

grant execute on function public.get_track_versions(uuid) to authenticated;

create function public.get_track_version_detail(p_version_id uuid)
returns table (
  version_number integer,
  state_json     jsonb,
  area_sel_json  jsonb,
  created_at     timestamptz
) language sql security definer set search_path = public as $$
  select v.version_number, v.state_json, v.area_sel_json, v.created_at
    from public.track_versions v
    join public.tracks t on t.id = v.track_id
    where v.id = p_version_id
      and t.owner_id = auth.uid();
$$;

grant execute on function public.get_track_version_detail(uuid) to authenticated;
