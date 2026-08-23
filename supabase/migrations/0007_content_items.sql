-- 0007: content_items — vedvarende state for Content Engine (State Integration v1).
--
-- Bakgrunn (discovery 2026-08-23): /innhold var 100 % hardkodet mock. Den ekte
-- content-workflowen ligger i detox-vault (`workflows/content/stages/*/output/`)
-- og har ingen state utenfor filsystemet — CLAUDE.md-triggeren "filer utover
-- .gitkeep = COMPLETE" var hele state-modellen. Denne tabellen er broen.
--
-- Ingen eksisterende tabell kunne gjenbrukes uten aa forvrenge betydningen:
-- `notes` er beslutninger/ideer, `pipelines` er automatiseringer, `roadmap` er
-- produktkort. Ny tabell godkjent av Adrian 2026-08-23.
--
-- Schema-et modellerer workflowen som FAKTISK finnes (fire stages), ikke en
-- publiseringskalender vi ikke har. approval_status/published_at/external_url er
-- bevisst utelatt til workflowen produserer dem.
--
-- Kjores via Management API (`POST /v1/projects/{ref}/database/query`) mot
-- Dashboard-DB (kwrjhyytvbcaiszbfria). Additiv: oppretter kun ny tabell.

begin;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text,
  -- Workflowens fire stages, i rekkefolge. Ingen andre verdier er ekte i dag.
  stage text not null check (stage in ('brief', 'draft', 'claim_check', 'voice_channel')),
  stage_status text not null default 'pending'
    check (stage_status in ('pending', 'complete', 'blocked', 'needs_research')),
  channels text[] not null default '{}',
  requested_by text,
  -- Provenance: hvor i vaultet raden kom fra. Sammen med source_repo er dette
  -- radens naturlige identitet — syncen trenger ikke gjette.
  source_repo text not null default 'detox-vault',
  source_path text not null,
  -- live | stale | seed | mock. Rader fra syncen er 'live'; ferskhet leses av
  -- synced_at, ikke ved aa mutere data_mode paa alle rader (Adrian 2026-08-23).
  data_mode text not null default 'live'
    check (data_mode in ('live', 'stale', 'seed', 'mock')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz,
  constraint content_items_source_unique unique (source_repo, source_path)
);

create index if not exists content_items_stage_idx on public.content_items (stage);
create index if not exists content_items_updated_at_idx on public.content_items (updated_at desc);

alter table public.content_items enable row level security;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Lesing: enhver innlogget bruker. Innholdsarbeid er ikke sensitivt paa linje
-- med klinisk data, og hele poenget er at flaten skal vaere synlig.
drop policy if exists "content_items read" on public.content_items;
create policy "content_items read"
  on public.content_items for select to authenticated
  using (true);

-- Skriving: kun roller som faktisk driver innholdsarbeid. Rollen leses fra
-- app_metadata.detox_role i JWT-en — samme kilde som scopesForRole() i
-- src/lib/auth-policy.ts, og settes kun av admin. `service` (GPT-klienter) har
-- bevisst IKKE skrivetilgang: GPT-capabilities kommer etter ekte state, aldri
-- som skriveflate. Se handoff 2026-08-22.
drop policy if exists "content_items write" on public.content_items;
create policy "content_items write"
  on public.content_items for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  );

drop policy if exists "content_items update" on public.content_items;
create policy "content_items update"
  on public.content_items for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Least privilege per 0006. anon faar ingenting: RLS gater ikke TRUNCATE, saa
-- grants maa fjernes eksplisitt og ikke bare overlates til policyene.
revoke all on public.content_items from anon;
revoke all on public.content_items from authenticated;
grant select, insert, update on public.content_items to authenticated;

-- Ingen DELETE-policy og ingen DELETE-grant: innholdsstate slettes ikke fra
-- appen. Rader som forsvinner fra vaultet blir staaende med gammel synced_at.

commit;
