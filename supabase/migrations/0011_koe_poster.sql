-- 0011: koe_poster — postene bak tallene i koer, og avgjørelsen eierne tar på dem.
--
-- Bakgrunn (Whatson 17.09 «TO FLATER, ÉN»; Adrians ja 17.09 kveld): forsiden «/»
-- summerer eiernes køer fra `koer`, men alt Indigo og Anniken kunne bestemme noe
-- om lå i den gamle, fryste flaten. Denne tabellen gjør den nye flaten komplett:
--
--   hub-jobb (service_role)  →  koe_poster (status 'venter')   →  /koe i den nye flaten
--   eier (authenticated)     →  status 'ja' | 'nei' | 'gjort'  →  hub-jobb UTFØRER og kvitterer
--
-- Dashbordet skriver bare avgjørelsen (status + hvem/når). Hub-jobbene utfører
-- den — setter kortet aktivt, sender status til ad-agenten, markerer tråden
-- ferdig — og kvitterer i utfort_*. Derfor trenger dashbordet ingen skriverett på
-- fagtabellene, og ingen agent (detox_role = service) kan avgjøre en post:
-- policyen krever admin/founder/operator, og service får aldri action:approve.
--
-- Én skriver per kø (koe_id = koer.id): raphael → kundeservice, stemme-laer →
-- stemme-utkast, sync-kim-cards → kim-kort, post_ads_report → annonse-raad.
-- (koe_id, ekstern_id) er unik, så en skriver kan kjøre igjen uten dubletter.
--
-- Del 2 retter rotårsaken bak grants-problemet fra 0009 og 0010: default
-- privileges i public gir anon og authenticated ALLE rettigheter på hver ny
-- tabell rollen postgres lager. Herfra får nye tabeller kun SELECT for
-- authenticated og ingenting for anon. service_role beholder alt. Eksisterende
-- tabeller røres ikke (ryddet i 0002–0010), unntatt to leftover-grants på koer.
--
-- Additiv og idempotent. Kjøres via Management API mot kwrjhyytvbcaiszbfria
-- ETTER Adrians godkjenning (samme prosess som 0008–0010, se README.md).
-- Rollback nederst.

begin;

create table if not exists public.koe_poster (
  id          uuid primary key default gen_random_uuid(),
  -- Hvilken kø posten hører til. Samme id som i koer.
  koe_id      text not null,
  -- Skriverens egen id på tingen: Gmail-tråd, Notion-side, kim_cards.id, recommendations.id.
  ekstern_id  text not null,
  tittel      text not null,
  detalj      text,
  -- Der jobben faktisk gjøres når den ikke gjøres her: Gmail-tråden, Notion-siden.
  lenke       text,
  -- 0 = haster (P0), 1 = viktig, 2 = normalt, 3 = kan vente.
  prioritet   smallint not null default 2 check (prioritet between 0 and 3),
  eier        text not null check (eier in ('indigo', 'anniken', 'begge')),
  -- 'ja-nei': eieren sier ja eller nei. 'gjort': eieren gjør noe et annet sted og kvitterer her.
  handling    text not null default 'ja-nei' check (handling in ('ja-nei', 'gjort')),
  status      text not null default 'venter'
                check (status in ('venter', 'ja', 'nei', 'gjort', 'utgatt')),
  avgjort_av  text,
  avgjort_at  timestamptz,
  -- Hub-jobben kvitterer når avgjørelsen er utført. null = avgjort, ikke utført ennå.
  utfort_av   text,
  utfort_at   timestamptz,
  -- Hvilken jobb som skrev posten. Alltid en navngitt eier.
  kilde       text not null,
  opprettet   timestamptz not null default now(),
  oppdatert   timestamptz not null default now(),
  constraint koe_poster_koe_ekstern_uniq unique (koe_id, ekstern_id)
);

comment on table public.koe_poster is
  'Postene bak eiernes køer (koer) og avgjørelsen eierne tar. Skrives av hub-jobber '
  '(service_role); eierne setter kun status/avgjort_* via dashbordet; hub-jobbene '
  'utfører og kvitterer i utfort_*. Ingen agent avgjør: policyen krever '
  'admin/founder/operator.';

create index if not exists koe_poster_venter_idx
  on public.koe_poster (koe_id, status, prioritet, opprettet);
create index if not exists koe_poster_utfor_idx
  on public.koe_poster (koe_id, status) where utfort_at is null;

alter table public.koe_poster enable row level security;

-- Lesing: alle innloggede eiere. Skriving: kun kolonnene en avgjørelse består av.
grant select on public.koe_poster to authenticated;
grant update (status, avgjort_av, avgjort_at, oppdatert) on public.koe_poster to authenticated;
revoke all on public.koe_poster from anon;

drop policy if exists "koe_poster owner read" on public.koe_poster;
create policy "koe_poster owner read"
  on public.koe_poster for select to authenticated using (true);

-- Bare en post som venter kan avgjøres, bare til en avgjørelse, og bare av et
-- menneske med rollen. En maskinprinsipal (detox_role = service) treffer aldri denne.
drop policy if exists "koe_poster owner decide" on public.koe_poster;
create policy "koe_poster owner decide"
  on public.koe_poster for update to authenticated
  using (
    status = 'venter'
    and (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  )
  with check (
    status in ('ja', 'nei', 'gjort')
    and (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  );

-- Leftover fra 0009 (default privileges): koer skal være ren lesing for eierne.
revoke references, trigger on public.koer from authenticated;

-- Tabellen over ble laget FØR default-endringen under, i samme transaksjon, og
-- arvet derfor de gamle default-grantene (authenticated: alt). Trekk dem tilbake
-- og gi kolonne-granten på nytt. (Oppdaget ved kjøring 17.09 og rettet samme
-- kveld; ligger her så fila er sann og idempotent.)
revoke insert, update, delete, truncate, references, trigger, maintain on public.koe_poster from authenticated;
grant update (status, avgjort_av, avgjort_at, oppdatert) on public.koe_poster to authenticated;

-- ── Del 2: rotårsaken ─────────────────────────────────────────────────────────
-- Nye tabeller i public laget av rollen postgres (Management API, SQL Editor):
-- kun SELECT til authenticated, ingenting til anon. service_role beholder alt.
-- Funksjoner og sekvenser røres ikke (RPC-er er ment å kunne kalles).
-- Merk: kun for role postgres — den kjørende rollen kan ikke endre default
-- privileges for supabase_admin, og det er postgres som lager tabellene våre.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke maintain on tables from authenticated;

commit;

-- ── Rollback (for hånd, ikke som del av fila) ─────────────────────────────────
-- alter default privileges for role postgres in schema public
--   grant all on tables to anon, authenticated;
-- drop table if exists public.koe_poster;
