# Supabase-migrasjoner (Dashboard-DB)

Fra Mission 01 (2026-08-22) skal ALLE skjemaendringer i Dashboard-DB ligge her som
committede, nummererte SQL-filer. Ingen manuelle produksjonsendringer uten fil.

Kjøring (inntil CLI-flyt er satt opp): Supabase SQL Editor på prosjektet
`kwrjhyytvbcaiszbfria`, i nummerrekkefølge. Hver fil er idempotent der det er mulig.

| Fil | Innhold | Status |
|---|---|---|
| 0001_activity_events.sql | Append-only audit-tabell + RLS | KJØRT i prod 2026-08-22 |
| 0002_clients_rls_lockdown.sql | P0: fjerner anon-tilgang til klinisk data | KJØRT i prod 2026-08-22 |
| 0003_obsidian_sync_pipeline_lockdown.sql | P0 del 2: obsidian_sync speilet de samme kliniske feltene og var fortsatt anonymt lesbar etter 0002. Låser den + product_pipeline | KJØRT i prod 2026-08-22 |

Etter kjøring: oppdater status-kolonnen her + CURRENT_STATE i detox-os-architecture,
og verifiser med det nektede anon-kallet beskrevet i 0002.

**Kjørt 2026-08-22 via Management API** (`POST /v1/projects/{ref}/database/query`),
ikke SQL Editor. Verifisert med anonyme REST-kall før og etter: `clients` gikk fra
2 rader helsedata lesbar uten innlogging til HTTP 401, det samme for
`obsidian_sync`, `product_pipeline` og `activity_events`. `roadmap` ble brukt som
kontrolltest og er bevisst fortsatt åpen — den viser at endringene traff målrettet
og ikke er en global utestengelse.

Merk: `api.supabase.com` svarer HTTP 403 `error code: 1010` på requests med
`python-urllib` som User-Agent. Det er Cloudflare, ikke manglende rettigheter.

Historikk: tabellene før 0001 (clients, roadmap, notes, pipelines, suppliers, sops,
agents, batches, product_pipeline, obsidian_sync m.fl.) ble opprettet ad hoc i SQL
Editor uten migrasjonsfiler (sesjonslogger juni 2026). De er udokumentert skjema-gjeld;
nye endringer på dem skal skje via filer her.
