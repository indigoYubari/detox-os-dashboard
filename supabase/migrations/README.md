# Supabase-migrasjoner (Dashboard-DB)

Fra Mission 01 (2026-08-22) skal ALLE skjemaendringer i Dashboard-DB ligge her som
committede, nummererte SQL-filer. Ingen manuelle produksjonsendringer uten fil.

Kjøring (inntil CLI-flyt er satt opp): Supabase SQL Editor på prosjektet
`kwrjhyytvbcaiszbfria`, i nummerrekkefølge. Hver fil er idempotent der det er mulig.

| Fil | Innhold | Status |
|---|---|---|
| 0001_activity_events.sql | Append-only audit-tabell + RLS | IKKE kjørt i prod |
| 0002_clients_rls_lockdown.sql | P0: fjerner anon-tilgang til klinisk data | IKKE kjørt i prod |

Etter kjøring: oppdater status-kolonnen her + CURRENT_STATE i detox-os-architecture,
og verifiser med det nektede anon-kallet beskrevet i 0002.

Historikk: tabellene før 0001 (clients, roadmap, notes, pipelines, suppliers, sops,
agents, batches, product_pipeline, obsidian_sync m.fl.) ble opprettet ad hoc i SQL
Editor uten migrasjonsfiler (sesjonslogger juni 2026). De er udokumentert skjema-gjeld;
nye endringer på dem skal skje via filer her.
