-- 0013: audit_* — datalaget for detox.no-auditten (spesifikasjon V1.1, §3.1–§3.4).
--
-- Bakgrunn: auditten skal slutte å bygge på manuelle eksporter og skjermbilder.
-- Hver rad er evidens: den vet hvilken kjøring den kom fra, når, og med hvilke
-- parametre. Ingen rad overskrives — en ny kjøring gir et nytt øyeblikksbilde.
--
--   hub-jobber i workers/audit (service_role)  →  audit_*  →  analyse (SQL, kun lesing)
--
-- Som sok-natt (0012) PROJISERER jobbene: tallene kommer fra kilden (GSC,
-- Merchant, Shopify). Jobben regner ikke ut egne, heller ikke CTR. Har en kilde
-- ikke svart, skrives ingen rad — og da er svaret «ukjent», aldri null.
--
-- KUN LESING mot kildene. Ingenting her forutsetter eller muliggjør skriving til
-- Shopify, Merchant Center, GSC eller Google Ads.
--
-- Avvik fra spesifikasjonen, alle godkjent av Kim 26.09:
--   1. Tabellene ligger i `public` med prefiks `audit_`, ikke i eget skjema
--      `audit` (V1.1 punkt 4). Følger repoets konvensjon og slipper å eksponere
--      et nytt skjema i Supabase.
--   2. Roller: service_role skriver, RLS på, som resten av detox-os. Ingen
--      `audit_writer`/`audit_reader` (V1.1 punkt 6). En egen leserolle vises
--      som separat SQL hvis den skal lages.
--   3. §3.2 og §3.3 mangler primærnøkler på fire tabeller. Uten dem skriver en
--      dag som avbrytes midtveis dubletter ved neste forsøk. Lagt til:
--      surrogatnøkkel + `unique nulls not distinct` på den naturlige nøkkelen
--      (samme grep som 0012, fordi `device` og `country` kan være null).
--   4. `snapshot_id` er `not null` med fremmednøkkel til audit_snapshots.
--      Spesifikasjonen har den uten begrensning; da kan faktarader bli
--      foreldreløse og evidenskjeden brytes.
--   5. Unik indeks som gjør backfill gjenopptakbar (se audit_snapshots).
--   6. CHECK-begrensninger der spesifikasjonen bare har kommentarer.
--   7. `job` er jobbnavnet fra §4 ('gsc_backfill'), ikke tabellnavnet som
--      §3.1-kommentaren eksemplifiserer. Granulariteten ligger i
--      `params->>'table'`. Dette er det Kims korrigering 26.09 krever for at
--      den unike indeksen skal treffe kun backfill.
--
-- Bevisst brudd med 0012: audit bruker `snapshot_id`, ikke `run_id` med CHECK.
-- Et øyeblikksbilde er uforanderlig evidens, ikke en daglig måling.
--
-- IKKE KJØRT. Repoets CLAUDE.md krever Adrians eksplisitte ja før noe i
-- supabase/migrations/ kjøres. Rollback nederst.
--
-- Additiv og idempotent. Ingen eksisterende tabell, kolonne, policy eller grant
-- endres.

begin;

-- ── §3.1 Felles: øyeblikksbilder og endringslogg ────────────────────────────

create table if not exists public.audit_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  -- Kilden øyeblikksbildet kommer fra.
  source      text not null
                check (source in ('gsc', 'merchant', 'shopify', 'crawl', 'reconciliation')),
  -- Jobbnavnet fra spesifikasjonen §4, f.eks. 'gsc_backfill', 'gsc_daily'.
  job         text not null check (btrim(job) <> ''),
  fetched_at  timestamptz not null default now(),
  api_version text,
  -- Hva som ble spurt om: for GSC minst {"date": "...", "table": "...",
  -- "dimensions": [...], "dataState": "final", "searchType": "web"}.
  params      jsonb,
  row_count   integer check (row_count >= 0),
  -- 'partial' settes når bildet opprettes og rader er underveis. Det blir 'ok'
  -- først når alle sider er skrevet, og 'failed' hvis kilden ikke svarte.
  -- Et bilde som står 'partial' er en avbrutt kjøring, ikke en sannhet.
  status      text not null check (status in ('ok', 'partial', 'failed')),
  error       text,
  -- Sti i Storage-bøtta `audit-raw`. Bøtta lages i en senere sprint; står null i 1a.
  raw_path    text
);

comment on table public.audit_snapshots is
  'Ett øyeblikksbilde = én kjøring av én jobb mot én kilde for én avgrensning. '
  'Alle audit_*-faktatabeller peker hit. Skrives av hub-jobbene i workers/audit '
  '(service_role). status=ok betyr komplett; partial betyr avbrutt. Migrasjon 0013.';

-- Gjør gsc_backfill gjenopptakbar: en dag+granularitet kan bare være godkjent
-- én gang, så «hopp over det som er hentet» blir et billig oppslag.
-- Begrenset til job='gsc_backfill' med vilje — gsc_daily (sprint 1b) henter de
-- siste tre dagene på nytt hver dag og skal kunne lage nye bilder for samme dato.
create unique index if not exists audit_snapshots_backfill_dag_uniq
  on public.audit_snapshots (job, (params ->> 'date'), (params ->> 'table'))
  where status = 'ok' and job = 'gsc_backfill';

create index if not exists audit_snapshots_job_idx
  on public.audit_snapshots (job, fetched_at desc);

create table if not exists public.audit_change_log (
  id          bigserial primary key,
  changed_at  timestamptz not null,
  system      text not null check (system in ('merchant', 'shopify', 'gsc', 'theme')),
  description text not null check (btrim(description) <> ''),
  by_whom     text
);

comment on table public.audit_change_log is
  'Endringer i kontoer, feed eller tema som auditten må kunne se tilbake på: '
  'dato, hva, hvem. Fylles for hånd eller av jobbene. Migrasjon 0013.';

-- ── §3.2 GSC ────────────────────────────────────────────────────────────────
-- Google anonymiserer sjeldne søk. Tabeller uten `query` gir derfor mer
-- komplette totaler enn tabeller med. Vi henter flere granulariteter og
-- dokumenterer avviket i stedet for å velge én sannhet.
--
-- `clicks`, `impressions`, `ctr` og `position` lagres nøyaktig som GSC oppgir
-- dem. `device` og `country` lagres rått (GSC svarer 'DESKTOP', 'nor') og har
-- derfor ingen CHECK — vi gjetter ikke på kildens formater.

create table if not exists public.audit_gsc_site_daily (
  snapshot_id uuid not null references public.audit_snapshots (snapshot_id),
  date        date not null,
  search_type text not null
                check (search_type in ('web', 'image', 'video', 'news', 'discover', 'googleNews')),
  clicks      integer check (clicks >= 0),
  impressions integer check (impressions >= 0),
  ctr         numeric check (ctr >= 0 and ctr <= 1),
  position    numeric check (position >= 1),
  primary key (snapshot_id, date, search_type)
);

create table if not exists public.audit_gsc_page_daily (
  id          bigserial primary key,
  snapshot_id uuid not null references public.audit_snapshots (snapshot_id),
  date        date not null,
  page        text not null,
  device      text,
  country     text,
  clicks      integer check (clicks >= 0),
  impressions integer check (impressions >= 0),
  ctr         numeric check (ctr >= 0 and ctr <= 1),
  position    numeric check (position >= 1),
  constraint audit_gsc_page_daily_naturlig_uniq unique nulls not distinct
    (snapshot_id, date, page, device, country)
);

create table if not exists public.audit_gsc_query_daily (
  id          bigserial primary key,
  snapshot_id uuid not null references public.audit_snapshots (snapshot_id),
  date        date not null,
  query       text not null,
  device      text,
  country     text,
  clicks      integer check (clicks >= 0),
  impressions integer check (impressions >= 0),
  ctr         numeric check (ctr >= 0 and ctr <= 1),
  position    numeric check (position >= 1),
  constraint audit_gsc_query_daily_naturlig_uniq unique nulls not distinct
    (snapshot_id, date, query, device, country)
);

create table if not exists public.audit_gsc_query_page_daily (
  id          bigserial primary key,
  snapshot_id uuid not null references public.audit_snapshots (snapshot_id),
  date        date not null,
  query       text not null,
  page        text not null,
  clicks      integer check (clicks >= 0),
  impressions integer check (impressions >= 0),
  ctr         numeric check (ctr >= 0 and ctr <= 1),
  position    numeric check (position >= 1),
  constraint audit_gsc_query_page_daily_naturlig_uniq unique nulls not distinct
    (snapshot_id, date, query, page)
);

comment on table public.audit_gsc_site_daily is
  'GSC på sidenivå (hele detox.no) per dag og søketype. Mest komplette totaler, '
  'fordi ingen query-dimensjon utløser Googles anonymisering. Migrasjon 0013.';
comment on table public.audit_gsc_page_daily is
  'GSC per side, dag, enhet og land. Totalen her er lavere enn site-totalen '
  'fordi Google anonymiserer — det er forventet, ikke en feil. Migrasjon 0013.';
comment on table public.audit_gsc_query_daily is
  'GSC per søk, dag, enhet og land. Mest anonymisering av alle. Migrasjon 0013.';
comment on table public.audit_gsc_query_page_daily is
  'GSC per søk og side per dag — koblingen mellom søk og landingsside. '
  'Dyreste spørringen hos Google. Migrasjon 0013.';

create index if not exists audit_gsc_site_daily_date_idx  on public.audit_gsc_site_daily (date);
create index if not exists audit_gsc_page_daily_date_idx  on public.audit_gsc_page_daily (date);
create index if not exists audit_gsc_page_daily_page_idx  on public.audit_gsc_page_daily (page);
create index if not exists audit_gsc_query_daily_date_idx on public.audit_gsc_query_daily (date);
create index if not exists audit_gsc_query_daily_query_idx on public.audit_gsc_query_daily (query);
create index if not exists audit_gsc_query_page_daily_date_idx  on public.audit_gsc_query_page_daily (date);
create index if not exists audit_gsc_query_page_daily_query_idx on public.audit_gsc_query_page_daily (query);
create index if not exists audit_gsc_query_page_daily_page_idx  on public.audit_gsc_query_page_daily (page);

-- ── §3.3 Merchant Center ────────────────────────────────────────────────────
-- Feltnavn i Merchant API kan avvike fra antakelsene i spesifikasjonen. Derfor
-- lagres HELE råsvaret i `attributes`/`raw` ved siden av de utpakkede feltene.
-- Stemmer ikke et felt, rapporteres avviket — ingenting gjettes, og ingenting
-- mistes på grunn av en feil mapping.

create table if not exists public.audit_merchant_products (
  snapshot_id          uuid not null references public.audit_snapshots (snapshot_id),
  -- Ressursnavnet fra API-et: accounts/{account}/products/{product}
  name                 text not null,
  offer_id             text,
  data_source          text,
  feed_label           text,
  content_language     text,
  title                text,
  link                 text,
  image_link           text,
  brand                text,
  gtin                 text[],
  mpn                  text,
  availability         text,
  price_micros         bigint,
  currency             text,
  condition            text,
  destination_statuses jsonb,
  item_level_issues    jsonb,
  -- Hele produktobjektet slik API-et ga det. Autoritativt ved uenighet.
  attributes           jsonb,
  primary key (snapshot_id, name)
);

create table if not exists public.audit_merchant_data_sources (
  snapshot_id  uuid not null references public.audit_snapshots (snapshot_id),
  name         text not null,
  display_name text,
  type         text,
  input        text,
  raw          jsonb,
  primary key (snapshot_id, name)
);

create table if not exists public.audit_merchant_account_issues (
  snapshot_id uuid not null references public.audit_snapshots (snapshot_id),
  raw         jsonb,
  primary key (snapshot_id)
);

comment on table public.audit_merchant_products is
  'Produkter i Merchant Center per øyeblikksbilde, med destinasjonsstatus og '
  'item-level issues. `attributes` holder hele råsvaret og er autoritativt hvis '
  'et utpakket felt ikke stemmer. Migrasjon 0013.';
comment on table public.audit_merchant_data_sources is
  'Datakildene i Merchant Center (primære, supplerende, automatiske). Brukes til '
  'å finne ut hvordan «Found by Google»-produktene faktisk kommer inn. Migrasjon 0013.';
comment on table public.audit_merchant_account_issues is
  'Kontonivå-varsler fra Merchant Center, lagret rått. Ett svar per øyeblikksbilde. '
  'Migrasjon 0013.';

create index if not exists audit_merchant_products_offer_idx on public.audit_merchant_products (offer_id);
create index if not exists audit_merchant_products_link_idx  on public.audit_merchant_products (link);

-- ── §3.4 Shopify ────────────────────────────────────────────────────────────

create table if not exists public.audit_shopify_products (
  snapshot_id            uuid not null references public.audit_snapshots (snapshot_id),
  product_id             bigint not null,
  handle                 text,
  title                  text,
  status                 text,
  vendor                 text,
  product_type           text,
  published_online_store boolean,
  published_google       boolean,
  publications           jsonb,
  primary key (snapshot_id, product_id)
);

create table if not exists public.audit_shopify_variants (
  snapshot_id        uuid not null references public.audit_snapshots (snapshot_id),
  variant_id         bigint not null,
  product_id         bigint not null,
  sku                text,
  barcode            text,
  price              numeric,
  available          boolean,
  inventory_quantity integer,
  inventory_policy   text,
  primary key (snapshot_id, variant_id)
);

comment on table public.audit_shopify_products is
  'Produkter i Shopify per øyeblikksbilde, med hvilke kanaler de er publisert i. '
  'Publiseringene er det som forklarer 309 i Merchant mot 301 i nettbutikken. '
  'Migrasjon 0013.';
comment on table public.audit_shopify_variants is
  'Varianter i Shopify per øyeblikksbilde: SKU, strekkode, pris, lager. Kobles '
  'mot Merchant via offer_id og mot schema på siden. Migrasjon 0013.';

create index if not exists audit_shopify_products_handle_idx on public.audit_shopify_products (handle);
create index if not exists audit_shopify_variants_sku_idx    on public.audit_shopify_variants (sku);
create index if not exists audit_shopify_variants_product_idx on public.audit_shopify_variants (product_id);

-- ── RLS og grants: som koer (0009) og sok (0012) ─────────────────────────────
-- authenticated kun SELECT, anon ingenting, skriving kun service_role (omgår RLS).

alter table public.audit_snapshots               enable row level security;
alter table public.audit_change_log              enable row level security;
alter table public.audit_gsc_site_daily          enable row level security;
alter table public.audit_gsc_page_daily          enable row level security;
alter table public.audit_gsc_query_daily         enable row level security;
alter table public.audit_gsc_query_page_daily    enable row level security;
alter table public.audit_merchant_products       enable row level security;
alter table public.audit_merchant_data_sources   enable row level security;
alter table public.audit_merchant_account_issues enable row level security;
alter table public.audit_shopify_products        enable row level security;
alter table public.audit_shopify_variants        enable row level security;

-- Eksplisitt, så fila er sann uavhengig av default privileges (se 0011 del 2).
revoke all on
  public.audit_snapshots, public.audit_change_log,
  public.audit_gsc_site_daily, public.audit_gsc_page_daily,
  public.audit_gsc_query_daily, public.audit_gsc_query_page_daily,
  public.audit_merchant_products, public.audit_merchant_data_sources,
  public.audit_merchant_account_issues,
  public.audit_shopify_products, public.audit_shopify_variants
  from anon;

revoke all on
  public.audit_snapshots, public.audit_change_log,
  public.audit_gsc_site_daily, public.audit_gsc_page_daily,
  public.audit_gsc_query_daily, public.audit_gsc_query_page_daily,
  public.audit_merchant_products, public.audit_merchant_data_sources,
  public.audit_merchant_account_issues,
  public.audit_shopify_products, public.audit_shopify_variants
  from authenticated;

grant select on
  public.audit_snapshots, public.audit_change_log,
  public.audit_gsc_site_daily, public.audit_gsc_page_daily,
  public.audit_gsc_query_daily, public.audit_gsc_query_page_daily,
  public.audit_merchant_products, public.audit_merchant_data_sources,
  public.audit_merchant_account_issues,
  public.audit_shopify_products, public.audit_shopify_variants
  to authenticated;

-- Skriveren. service_role har dette via default privileges også; det står her
-- så skriveren ikke hviler på dem. Ingen DELETE og ingen TRUNCATE: et
-- øyeblikksbilde er evidens og skal ikke kunne fjernes av en jobb.
grant select, insert, update on
  public.audit_snapshots, public.audit_change_log,
  public.audit_gsc_site_daily, public.audit_gsc_page_daily,
  public.audit_gsc_query_daily, public.audit_gsc_query_page_daily,
  public.audit_merchant_products, public.audit_merchant_data_sources,
  public.audit_merchant_account_issues,
  public.audit_shopify_products, public.audit_shopify_variants
  to service_role;

-- bigserial-kolonnene trenger sekvenstilgang for skriveren.
grant usage, select on sequence public.audit_change_log_id_seq              to service_role;
grant usage, select on sequence public.audit_gsc_page_daily_id_seq          to service_role;
grant usage, select on sequence public.audit_gsc_query_daily_id_seq         to service_role;
grant usage, select on sequence public.audit_gsc_query_page_daily_id_seq    to service_role;

drop policy if exists "audit_snapshots read" on public.audit_snapshots;
create policy "audit_snapshots read"
  on public.audit_snapshots for select to authenticated using (true);

drop policy if exists "audit_change_log read" on public.audit_change_log;
create policy "audit_change_log read"
  on public.audit_change_log for select to authenticated using (true);

drop policy if exists "audit_gsc_site_daily read" on public.audit_gsc_site_daily;
create policy "audit_gsc_site_daily read"
  on public.audit_gsc_site_daily for select to authenticated using (true);

drop policy if exists "audit_gsc_page_daily read" on public.audit_gsc_page_daily;
create policy "audit_gsc_page_daily read"
  on public.audit_gsc_page_daily for select to authenticated using (true);

drop policy if exists "audit_gsc_query_daily read" on public.audit_gsc_query_daily;
create policy "audit_gsc_query_daily read"
  on public.audit_gsc_query_daily for select to authenticated using (true);

drop policy if exists "audit_gsc_query_page_daily read" on public.audit_gsc_query_page_daily;
create policy "audit_gsc_query_page_daily read"
  on public.audit_gsc_query_page_daily for select to authenticated using (true);

drop policy if exists "audit_merchant_products read" on public.audit_merchant_products;
create policy "audit_merchant_products read"
  on public.audit_merchant_products for select to authenticated using (true);

drop policy if exists "audit_merchant_data_sources read" on public.audit_merchant_data_sources;
create policy "audit_merchant_data_sources read"
  on public.audit_merchant_data_sources for select to authenticated using (true);

drop policy if exists "audit_merchant_account_issues read" on public.audit_merchant_account_issues;
create policy "audit_merchant_account_issues read"
  on public.audit_merchant_account_issues for select to authenticated using (true);

drop policy if exists "audit_shopify_products read" on public.audit_shopify_products;
create policy "audit_shopify_products read"
  on public.audit_shopify_products for select to authenticated using (true);

drop policy if exists "audit_shopify_variants read" on public.audit_shopify_variants;
create policy "audit_shopify_variants read"
  on public.audit_shopify_variants for select to authenticated using (true);

commit;

-- ── Rollback (for hånd, ikke som del av fila) ─────────────────────────────────
-- Faktatabellene først, de peker på audit_snapshots.
-- drop table if exists public.audit_shopify_variants;
-- drop table if exists public.audit_shopify_products;
-- drop table if exists public.audit_merchant_account_issues;
-- drop table if exists public.audit_merchant_data_sources;
-- drop table if exists public.audit_merchant_products;
-- drop table if exists public.audit_gsc_query_page_daily;
-- drop table if exists public.audit_gsc_query_daily;
-- drop table if exists public.audit_gsc_page_daily;
-- drop table if exists public.audit_gsc_site_daily;
-- drop table if exists public.audit_change_log;
-- drop table if exists public.audit_snapshots;
