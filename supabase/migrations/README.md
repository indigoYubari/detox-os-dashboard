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
| 0004_roadmap_remove_anon_write.sql | Fjerner anon sine skrive-grants (inkl. TRUNCATE, som RLS ikke gater) på roadmap + roadmap_comments, beholder tilsiktet offentlig lesing/kommentering | KJØRT i prod 2026-08-22 |
| 0005_revoke_anon_grants_remaining_tables.sql | Fjerner anon sine grants (inkl. TRUNCATE) på agents, batches, notes, pipelines, sops, suppliers — RLS blokkerte lesing/skriving, men ikke TRUNCATE | KJØRT i prod 2026-08-22 |
| 0006_authenticated_least_privilege.sql | Fjerner DELETE/TRUNCATE fra `authenticated` på alle tabeller; grants utledet fra faktisk kodebruk | KJØRT i prod 2026-08-22 |
| 0007_content_items.sql | Ny tabell `content_items` — vedvarende state for content-workflowen i detox-vault. RLS på, lesing for `authenticated`, skriving kun for `detox_role` admin/founder/operator, ingen grants til anon, ingen DELETE-grant | KJØRT i prod 2026-08-23 |

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

## 0007 — verifisering 2026-08-23

Kjørt via Management API mot `kwrjhyytvbcaiszbfria` (bekreftet `name: detox-os`,
org `hmtbxbbdbvqvqrtlduxk`, `ACTIVE_HEALTHY`). Additiv: 15 setninger, alle mot
`public.content_items`. Ingen andre tabeller nevnt i filen.

Verifisert etter apply, med SQL mot prod:

- tabell + alle 13 kolonner, `UNIQUE (source_repo, source_path)`, tre CHECK-constraints
- `relrowsecurity = true`
- `has_table_privilege('anon', 'public.content_items', ...)` → false for SELECT, INSERT,
  UPDATE, DELETE og TRUNCATE. `authenticated` har SELECT/INSERT/UPDATE, ikke DELETE/TRUNCATE.
- policyer: lesing for `authenticated`, INSERT/UPDATE gated på
  `app_metadata.detox_role ∈ (admin, founder, operator)`

`service_role` har full tilgang (inkl. TRUNCATE) på tabellen. Det kommer ikke fra denne
filen — den gir ingen grants til `service_role` — men fra Supabase' `ALTER DEFAULT
PRIVILEGES`, som treffer enhver ny tabell i `public`. Samme situasjon som de tolv
tabellene fra før.

Ingen påvirkning på eksisterende data: md5-fingerprint av alle grants (190) og policyer
(17) for de øvrige tabellene var identisk før og etter, og alle radtall var uendret.
