-- Schreibzugriff auf profiles für Client-Rollen explizit sperren.
-- Bisher nur durch fehlende UPDATE-Policy via RLS "blockiert" — das gibt
-- keinen Fehler zurück, sondern still 0 Rows. REVOKE erzwingt einen echten
-- Permission-Denied-Fehler, konsistent mit tracks/track_versions.
--
-- Alle Schreiboperationen (last_active_at, is_deleted, tier) laufen
-- ausschließlich über SECURITY DEFINER-Funktionen (laufen als Table-Owner,
-- nicht als authenticated — REVOKE hat darauf keinen Einfluss).
revoke insert, update, delete on public.profiles from anon, authenticated;
