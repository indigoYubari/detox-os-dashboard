-- 0012: sok_rangering + sok_ai_sitering — Detox' eget søke- og AI-synlighetslag.
--
-- Bakgrunn (CC-JOBB 8, research 18.09; Adrians seks beslutninger 18.09; ja til
-- apply 19.09 18:03, Grok BOARD A25): Detox skal vite hvem som eier svaret når
-- kundene søker — i Google/Bing (sok_rangering) og i AI-svar (sok_ai_sitering).
-- Gratislagene bygges nå. DataForSEO, OpenAI og GSC kobles inn i de samme
-- tabellene tirsdag 22.09 — det trengs ingen ny migrasjon for det.
--
--   hub-jobb sok-natt (service_role)  →  sok_*  →  dashbordet (authenticated, SELECT)
--
-- Jobben PROJISERER: tallene kommer fra kilden (GSC, Bing, DataForSEO, AI-
-- motoren), jobben regner ikke ut egne. Mangler en måling, finnes ingen rad —
-- og da er svaret «ukjent», aldri et anslag.
--
-- Radtyper (data_mode):
--   'seed' — det vi følger med på: søk og spørsmål fra aggregerte kundeservice-
--            temaer, de mest spurte spørsmålene og hvordan Detox svarer.
--            Ingen måletall. Aldri kunde-ID, meldingstekst, sitat eller e-post.
--   'live' — én måling fra én kilde, for én dato.
-- Ferskhet leses av synced_at, ikke ved å mutere data_mode (Adrian 2026-08-23, 0007).
--
-- run_id er fryst (Fase 2, 19.09) og håndheves her: '<type>-ÅÅÅÅ-MM-DD', ev. med
-- '-<suffiks>', der type er seed | baseline | natt | manuell. run_id er del av
-- den unike nøkkelen, så hver kjøring skriver bare egne rader: en baseline
-- overskrives aldri av en senere natt, og samme run_id kjørt på nytt er en upsert
-- uten dubletter.
--
-- RLS som koer (0009): authenticated kun SELECT, anon ingenting, skriving kun
-- service_role (omgår RLS). Additiv og idempotent. Ingen eksisterende tabell,
-- kolonne, policy eller grant endres.
--
-- Kjøres via Management API mot kwrjhyytvbcaiszbfria ETTER Adrians godkjenning
-- (samme prosess som 0008–0011, se README.md). Rollback nederst.

begin;

-- ── sok_rangering: søkemotorene (lag A: GSC/Bing, lag B: DataForSEO) ─────────
create table if not exists public.sok_rangering (
  id         uuid primary key default gen_random_uuid(),
  run_id     text not null
               check (run_id ~ '^(seed|baseline|natt|manuell)-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9]+)?$'),
  -- Hvor raden kommer fra. 'kundeservice' = seed fra aggregerte temaer, aldri en måling.
  kilde      text not null check (kilde in ('kundeservice', 'gsc', 'bing', 'dataforseo')),
  data_mode  text not null check (data_mode in ('seed', 'live')),
  -- Søkefrasen, normalisert av skriveren (små bokstaver, enkle mellomrom).
  query      text not null check (btrim(query) <> '' and length(query) <= 200),
  -- Seed: tema (skrevet av et menneske) og register. 'menneskelig' blir aldri
  -- innhold eller avskjæring — det er et stoppsignal, ikke en målgruppe.
  tema       text,
  register   text check (register in ('praktisk', 'faglig', 'menneskelig')),
  -- Måling: dagen tallene gjelder. null for seed.
  dato       date,
  -- Lag A: vår side. Lag B: URL-en på plass `rang`.
  side       text,
  -- Lag A: 'detox.no'. Lag B: domenet på plass `rang`.
  domene     text,
  -- Lag B: plass i organisk SERP (1 = øverst).
  rang       smallint check (rang >= 1),
  -- Lag A: snittposisjon slik kilden oppgir den.
  posisjon   numeric(7, 2) check (posisjon >= 1),
  klikk      integer check (klikk >= 0),
  visninger  integer check (visninger >= 0),
  -- Bare når kilden selv oppgir den (GSC). Jobben regner den ikke ut.
  ctr        numeric(6, 5) check (ctr >= 0 and ctr <= 1),
  -- ISO 3166-1 alfa-3 som GSC ('nor'). null = kilden oppgir ikke land.
  land       text,
  enhet      text check (enhet in ('desktop', 'mobile', 'tablet')),
  synced_at  timestamptz not null default now(),
  -- Seed har ingen måletall. En måling har alltid dato. Kundeservice er aldri en måling.
  constraint sok_rangering_seed_uten_tall check (
    data_mode <> 'seed' or (dato is null and rang is null and posisjon is null
                            and klikk is null and visninger is null and ctr is null)),
  constraint sok_rangering_live_har_dato check (data_mode <> 'live' or dato is not null),
  constraint sok_rangering_kundeservice_er_seed check (kilde <> 'kundeservice' or data_mode = 'seed'),
  constraint sok_rangering_naturlig_uniq unique nulls not distinct
    (run_id, kilde, query, side, land, enhet, dato, rang)
);

comment on table public.sok_rangering is
  'Søkesynlighet for detox.no og konkurrentene. Skrives av hub-jobben sok-natt '
  '(service_role) fra GSC, Bing og DataForSEO; seed-rader (data_mode=seed) er '
  'søkene vi følger med på. Ingen rad = ukjent, aldri et anslag. Migrasjon 0012.';

create index if not exists sok_rangering_query_idx
  on public.sok_rangering (query, data_mode, dato desc);

-- ── sok_ai_sitering: AI-svarene (lag C: Perplexity, Gemini, Claude, ev. OpenAI) ─
create table if not exists public.sok_ai_sitering (
  id              uuid primary key default gen_random_uuid(),
  run_id          text not null
                    check (run_id ~ '^(seed|baseline|natt|manuell)-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9]+)?$'),
  -- 'kundeservice' = seed-spørsmål. Ellers motoren som svarte.
  kilde           text not null
                    check (kilde in ('kundeservice', 'perplexity', 'gemini', 'anthropic', 'openai')),
  data_mode       text not null check (data_mode in ('seed', 'live')),
  -- Spørsmålet slik en kunde ville stilt det, med egne ord — aldri kundens tekst.
  sporsmal        text not null check (btrim(sporsmal) <> '' and length(sporsmal) <= 500),
  tema            text,
  register        text check (register in ('praktisk', 'faglig', 'menneskelig')),
  -- Hvordan Detox svarer: svar-mønsteret fra kundeservice, beskrevet — aldri rå
  -- kundetekst eller sitat. Inngang til avskjærings-innhold (via claims-gate).
  detox_svar      text check (length(detox_svar) <= 1000),
  dato            date,
  modell          text,
  -- null = ikke målt. true/false kommer bare fra en faktisk måling.
  sitert_detox    boolean,
  -- detox.no-siden motoren siterte, og plassen den hadde blant siteringene.
  detox_url       text,
  rang            smallint check (rang >= 1),
  siterte_domener text[],
  -- sha256 av svarteksten. Selve svaret lagres ikke.
  svar_hash       text,
  synced_at       timestamptz not null default now(),
  constraint sok_ai_sitering_seed_uten_tall check (
    data_mode <> 'seed' or (dato is null and modell is null and sitert_detox is null
                            and detox_url is null and rang is null
                            and siterte_domener is null and svar_hash is null)),
  constraint sok_ai_sitering_live_har_maaling check (
    data_mode <> 'live' or (dato is not null and sitert_detox is not null)),
  constraint sok_ai_sitering_rang_krever_sitering check (rang is null or sitert_detox is true),
  constraint sok_ai_sitering_kundeservice_er_seed check (kilde <> 'kundeservice' or data_mode = 'seed'),
  constraint sok_ai_sitering_naturlig_uniq unique nulls not distinct
    (run_id, kilde, modell, sporsmal, dato)
);

comment on table public.sok_ai_sitering is
  'AI-synlighet: siterer motoren detox.no når kundenes spørsmål stilles? Skrives '
  'av hub-jobben sok-natt (service_role); seed-rader er spørsmålene og hvordan '
  'Detox svarer. Svarteksten lagres ikke, bare hash. Migrasjon 0012.';

create index if not exists sok_ai_sitering_sporsmal_idx
  on public.sok_ai_sitering (sporsmal, data_mode, dato desc);

-- ── RLS og grants: som koer ──────────────────────────────────────────────────
alter table public.sok_rangering enable row level security;
alter table public.sok_ai_sitering enable row level security;

-- Eksplisitt, så fila er sann uavhengig av default privileges (se 0011 del 2).
revoke all on public.sok_rangering, public.sok_ai_sitering from anon;
revoke all on public.sok_rangering, public.sok_ai_sitering from authenticated;
grant select on public.sok_rangering, public.sok_ai_sitering to authenticated;
-- Skriveren. service_role har dette via default privileges også; det står her
-- så skriveren ikke hviler på dem.
grant select, insert, update on public.sok_rangering, public.sok_ai_sitering to service_role;

drop policy if exists "sok_rangering read" on public.sok_rangering;
create policy "sok_rangering read"
  on public.sok_rangering for select to authenticated using (true);

drop policy if exists "sok_ai_sitering read" on public.sok_ai_sitering;
create policy "sok_ai_sitering read"
  on public.sok_ai_sitering for select to authenticated using (true);

commit;

-- ── Rollback (for hånd, ikke som del av fila) ─────────────────────────────────
-- drop table if exists public.sok_ai_sitering;
-- drop table if exists public.sok_rangering;
