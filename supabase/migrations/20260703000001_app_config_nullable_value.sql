-- app_config.value: NOT NULL-Constraint entfernen
-- 'null'::jsonb als Sentinel ist umständlich; SQL NULL ist der sauberere Weg
-- für "Feature deaktiviert". Der create_custom_formation RPC prüft bereits
-- beides korrekt: `is not null` (SQL NULL) und `<> 'null'::jsonb` (JSONB-Null).
alter table public.app_config alter column value drop not null;
