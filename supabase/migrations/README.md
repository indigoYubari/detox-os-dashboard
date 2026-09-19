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
| 0008_shared_state_owner_access.sql | Eier-oversikt (/eiere): SELECT for `authenticated` på `reports`, `findings`, `recommendations`, `run_state`; SELECT/INSERT/UPDATE på `requests` med skriving gated på `detox_role` admin/founder/operator. Kun grants + policyer, ingen kolonner. Rollback nederst i fila | KJØRT i prod 2026-09-08 (Management API, godkjent av Adrian i chat). Verifisert: 7 policyer, `authenticated` SELECT på fire lesetabeller + INSERT/SELECT/UPDATE på `requests`, anon ingen, `activity_events` bit-identisk før/etter |
| 0009_koer.sql | Ny tabell `koer` — eiernes faktiske køer (stemme-utkast, kundeservice). RLS, `authenticated` kun SELECT, `anon` ingenting. | KJØRT i prod 2026-09-17 14:07Z via Management API (Claude Code, Adrians godkjenning i MASTER-CC §4.2) |
| 0010_kim_cards.sql | Ny tabell `kim_cards` + view `v_kim_cards` (Indigos Kim-kort). RLS: `authenticated` SELECT; maskinprinsipal (`detox_role=service`) ser kun `active`. Skriver: `scripts/sync-kim-cards.py` (service_role). | KJØRT i prod 2026-09-17 ~15:00Z via Management API (Claude Code, Adrians ja i chat). Default-grants til `authenticated` revoked etterpå (som 0009). 10 kort synket samme dag |
| 0011_koe_poster.sql | Ny tabell `koe_poster` — postene bak `koer` og eiernes avgjørelse (ja/nei/gjort). Hub-jobber skriver (service_role), eierne oppdaterer kun status/avgjort_* (kolonne-grant + policy på admin/founder/operator), hub-jobbene utfører og kvitterer. Del 2: default privileges for rollen postgres i public — nye tabeller får kun SELECT for `authenticated`, ingenting for `anon`. Leftover REFERENCES/TRIGGER på `koer` revoked | KJØRT i prod 2026-09-17 ~19:47Z via Management API (Claude Code, Adrians ja i chat). Verifisert: `authenticated` har SELECT + UPDATE på nøyaktig status/avgjort_av/avgjort_at/oppdatert, ingen INSERT/DELETE, `anon` ingenting; default-ACL for postgres i public er nå `authenticated=r`. 9 kort-poster skrevet samme kveld |
| 0012_sok.sql | To nye tabeller for søke- og AI-synlighet: `sok_rangering` (GSC/Bing/DataForSEO + seed-søk) og `sok_ai_sitering` (AI-motorer + seed-spørsmål med hvordan Detox svarer). `data_mode` seed/live, `synced_at`, fryst `run_id` (CHECK), unik nøkkel per kjøring (`nulls not distinct`). RLS som koer: `authenticated` kun SELECT, `anon` ingenting, skriver = `sok-natt` (service_role) | KJØRT i prod 2026-09-19 16:23Z via Management API (Claude Code, Adrians ja 19.09 18:03, Grok BOARD A25). Bevist i rollback-transaksjon mot prod først (8 prøver). Verifisert: RLS på, `anon` alt false, `authenticated` kun SELECT, fingerprint av alle andre tabeller identisk. Seed v1 skrevet samme kveld: 18 søk + 6 spørsmål |

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

## 0009 — verifisering 2026-09-17

Kjørt via Management API mot `kwrjhyytvbcaiszbfria` kl. 14:07Z. Additiv: kun `public.koer`.

- `select count(*) from public.koer` → 0 rett etter apply
- `has_table_privilege('anon','public.koer','select')` → false · `authenticated` SELECT → true
- `relrowsecurity = true`, én policy `koer owner read` (SELECT, authenticated)
- md5-fingerprint av alle andre tabellers grants (338 rader) identisk før og etter

**Tillegg samme dag:** Supabase' `ALTER DEFAULT PRIVILEGES` ga `authenticated` INSERT/UPDATE/DELETE/TRUNCATE
på den nye tabellen (RLS uten skrivepolicy blokkerte uansett, men grantet lå der). Kjørt:
`revoke insert, update, delete, truncate on public.koer from authenticated;` → alle fire false etterpå.
Samme situasjon gjelder trolig `content_items` (se 0007-notatet) — ikke rørt her.

Skrivere: `/root/detox-os-verify/koe_projeksjon.py` (stemme-utkast, timer `koe-projeksjon.timer` hver
halvtime :20/:50) og Raphaels `kundeservice-natt` (rad `kundeservice`, via `detox_update`/`detox_insert`
i supabase-detox — lagt til 17.09). Første `kundeservice`-rad er en engangs-projeksjon av passet 17.09
03:10Z, merket `claude-code` i `kilde`.

## 0012 — verifisering 2026-09-19

Kjørt via Management API mot `kwrjhyytvbcaiszbfria` kl. 16:23Z med Detox-kontoens PAT
(`~/.supabase-detox-token` på Adrians maskin). Hub-tokenet `SUPABASE_ACCESS_TOKEN` er MindMatter-scopet
og gir HTTP 403 mot dette prosjektet — bruk ikke det.

**Før apply:** hele fila kjørt i `begin … rollback` mot prod, 8 prøver (samme teknikk som 0008):

- `authenticated` leser (0 rader) · `authenticated` INSERT → `42501` · `anon` SELECT → `42501`
- `service_role` skriver en seed-rad og upserter på den unike nøkkelen (`nulls not distinct`) → 1 rad, oppdatert
- CHECK: seed med måletall, `kundeservice` som måling, ugyldig `run_id`, AI-måling uten `sitert_detox` → alle `23514`
- fingerprint etterpå identisk og `sok_*` fantes ikke → ingenting ble lagret

**Etter apply (SQL):**

- `relrowsecurity = true` på begge
- `anon`: SELECT/INSERT/UPDATE/DELETE/TRUNCATE og kolonnerettigheter → false
- `authenticated`: SELECT → true. INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN og kolonneskriving → false
- `service_role`: SELECT/INSERT/UPDATE → true. Én policy per tabell (`… read`, SELECT, authenticated)
- md5-fingerprint av ACL/RLS (27 relasjoner), grants (412), kolonnegrants (2539), policyer (31) og default ACL (24)
  for alle andre tabeller: identisk før og etter. Radtall i koer/koe_poster/kim_cards/content_items/findings uendret

**Etter apply (REST, røyktest-kontoen):** `anon` GET på begge tabeller → 401 `42501`. Innlogget GET → 200
(18 + 6 seed-rader). Innlogget POST og PATCH → 403 `42501`, også med `detox_role = admin`.

**Skriver:** `scripts/sok-natt.py` → `/opt/detox/tools/sok-natt.py` på huben (service_role). Seed v1
(`scripts/sok-seed-2026-09-19.json`, `run_id = seed-2026-09-19`): 18 søk + 6 spørsmål, PII-skann 0 treff, kjørt to
ganger → fortsatt 18 + 6 (upsert). Negativ prøve: `sok-natt.py --status "binder dosering"` → `ukjent — ingen måling`
på gsc/bing/dataforseo. Timer `sok-natt.timer` (04:40Z) ligger i `scripts/systemd/` og er ikke installert.
