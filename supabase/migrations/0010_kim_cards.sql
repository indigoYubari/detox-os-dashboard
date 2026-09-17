-- 0010: kim_cards — Indigos Kim-kort (én skjerm per research-story) som lesbar tabell.
--
-- Bakgrunn (Indigo 09.09 + 16.09): kortene ligger i git som markdown
-- (`mindmatter-icm/detox/indigo/jobs/topics/<story>/kim-kort.md`). Kortet er den
-- menneskelesbare syntesen; `findings` er forskningsfunnene. GPT-en (Kim GPT) og
-- dashbordet skal kunne hente kortene uten å lese filer på hub-en.
--
--   sync-skript (service_role) → public.kim_cards → GET /api/v1/cards (RLS)
--
-- Én skriver (scripts/sync-kim-cards.py, kjøres når kortene endres), lesing via
-- brukerens/maskinens egen JWT. Drafts vises KUN for mennesker: maskinprinsipalen
-- (app_metadata.detox_role = 'service') ser bare status = 'active'. Det er RLS,
-- ikke rutekoden, som håndhever det — så en feil i ruten kan ikke lekke et draft.
--
-- Additiv og idempotent. Ingen grants til anon. Ingen INSERT/UPDATE/DELETE til
-- authenticated — service_role omgår RLS og er den eneste skriveren.
--
-- Kjøres via Management API mot kwrjhyytvbcaiszbfria ETTER Adrians godkjenning
-- (samme prosess som 0008/0009 — se README.md).

begin;

create table if not exists public.kim_cards (
  id              uuid primary key default gen_random_uuid(),
  story           text not null,                  -- 'berberine-glucose' | ... (samme slug som reports.report_type etter kolon)
  version         date not null,                  -- «Versjon:» i kortet, f.eks. 2026-09-09
  title           text not null,                  -- H1 i kortet
  anchors         jsonb not null default '[]'::jsonb,  -- [{"type":"pmid","id":"36467075"}, {"type":"doi","id":"..."}]
  body            jsonb not null,                 -- seksjonene som felt (betydning_for_detox, kan_si{portal,reels,mail}, aldri_si[], produkt, gjor_i_dag, dor_naar, kilde[])
  source_repo     text not null,                  -- 'MindMatter1444/mindmatter-icm'
  source_path     text not null,                  -- 'detox/indigo/jobs/topics/<story>/kim-kort.md'
  source_commit   text,                           -- commit kortet ble lest fra
  status          text not null default 'draft'
                    check (status in ('draft','active','superseded')),
  requires_review boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint kim_cards_story_version_uniq unique (story, version)
);

comment on table public.kim_cards is
  'Indigos Kim-kort per research-story. Skrives av sync-skript (service_role) fra '
  'mindmatter-icm; leses av Kim GPT (kun active) og dashbordet (alle). QA-status '
  'eies av topics/README.md i ICM — tabellen speiler den, bestemmer den ikke.';

create index if not exists kim_cards_story_idx on public.kim_cards (story, version desc);

alter table public.kim_cards enable row level security;

grant select on public.kim_cards to authenticated;
revoke all on public.kim_cards from anon;

drop policy if exists "kim_cards read" on public.kim_cards;
create policy "kim_cards read"
  on public.kim_cards for select to authenticated
  using (
    status = 'active'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'detox_role', '') <> 'service'
  );

-- Lesevisning. security_invoker: RLS-policyen over gjelder også gjennom viewet.
create or replace view public.v_kim_cards
  with (security_invoker = true) as
  select id, story, version, title, anchors, body, status, requires_review,
         source_repo, source_path, source_commit, updated_at
  from public.kim_cards;

grant select on public.v_kim_cards to authenticated;
revoke all on public.v_kim_cards from anon;

commit;
