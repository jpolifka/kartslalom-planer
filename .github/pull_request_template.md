## Zusammenfassung

<!-- Was ändert sich und warum? -->

## Checkliste

- [ ] **Dokumentation geprüft und überarbeitet** (gegen den Code abgeglichen, nicht nur ergänzt): `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/` (v. a. `architektur.md` und das betroffene Fachdokument), `supabase/migrations/README.md`, bei geänderter Bedienung `docs/user/`. Falls nichts zu ändern war: hier kurz vermerken.
- [ ] Unit-Tests grün (`docker compose -f docker/docker-compose.unit.yml up --build --exit-code-from unit-test`)
- [ ] Bei Änderungen an Migrationen, RLS, GRANT/REVOKE oder SECURITY-DEFINER-RPCs: Integrationstests und Security-Smoke lokal grün (siehe `CONTRIBUTING.md`)
- [ ] Neue Tarif-Checks auf beiden Seiten getestet (Free lehnt ab, Pro erlaubt)

## Hinweise für Reviewer:innen

<!-- Risiken, offene Punkte, Reihenfolge beim Deployment (z. B. Migration vor App-Build) -->
