-- 0009: koer — eiernes faktiske køer.
--
-- Bakgrunn: den nye forsiden (/ «Dagens») hadde en seksjon som het «Venter på
-- dere», men leste `requests`. Det er agentenes arbeidskø — oppdrag fra Kim og
-- fra detox-gpt til Anakin — ikke eiernes. Lede-setningen sa «N ting venter på
-- et ja eller nei» og telte feil ting. Det som faktisk venter på Kim og Anniken
-- er rundt 22 stemme-utkast (dommer) og 8 P0-helsetråder i kundeservice.
--
-- Kildene ligger utenfor databasen: `detox-voice` er et privat repo og tellingen
-- bor i STATUS.md, og Raphaels kundeservice-output bor i hans egen profil. Et
-- dashboard på Railway kan ikke lese filer på hub-en. Derfor:
--
--   hub-jobb (service_role)  →  public.koer  →  dashbordet (authenticated, SELECT)
--
-- Én skriver, én leser. Jobben TELLER IKKE selv — den projiserer tallet som
-- `stemme-laer` allerede eier. Det er poenget: én scheduler-eier per domene.
--
-- Additiv og idempotent. Ingen eksisterende tabell, kolonne eller policy endres.
-- Ingen grants til anon. Ingen INSERT/UPDATE/DELETE til authenticated — kun
-- service_role skriver, og service_role omgår RLS i Supabase.
--
-- Kjøres via Management API mot kwrjhyytvbcaiszbfria ETTER Adrians godkjenning
-- (samme prosess som 0008 — se README.md i denne mappen).

begin;

create table if not exists public.koer (
  id        text primary key,
  -- Kort, eier-lesbar etikett. Vises som seksjonsoverskrift i dashbordet.
  navn      text not null,
  -- Antall ting som venter. Aldri et anslag — teller eller er fraværende.
  antall    integer not null default 0 check (antall >= 0),
  -- Når den eldste ventende tingen kom inn. Grunnlag for «eldste har ventet».
  eldste    timestamptz,
  -- Én linje på eierspråk til detaljene bak «Se detaljer».
  detalj    text,
  -- Hvilken jobb som skriver raden. Skal alltid være en navngitt eier.
  kilde     text not null,
  oppdatert timestamptz not null default now()
);

comment on table public.koer is
  'Eiernes faktiske køer (stemme-utkast, P0-kundeservice). Skrives av hub-jobb '
  'med service_role, leses av dashbordet med brukerens session. Jobben '
  'projiserer tall eid av stemme-laer — den teller ikke selv.';

alter table public.koer enable row level security;

-- Lesing for innloggede eiere. Ingen skriving: RLS-policyen under dekker SELECT.
grant select on public.koer to authenticated;

drop policy if exists "koer owner read" on public.koer;
create policy "koer owner read"
  on public.koer for select to authenticated using (true);

-- Anonyme skal ikke se noe, selv ikke antall.
revoke all on public.koer from anon;

commit;
