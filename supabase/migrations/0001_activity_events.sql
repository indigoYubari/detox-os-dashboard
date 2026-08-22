-- 0001: activity_events - append-only audit for Detox OS (Mission 01, ADR-010).
--
-- Kjøres i Supabase SQL Editor på Dashboard-DB (kwrjhyytvbcaiszbfria) inntil
-- CLI-migrasjonsflyt er satt opp. Additiv og trygg: oppretter kun ny tabell.
--
-- Append-only-garantien: authenticated kan KUN inserte egne events
-- (actor_id = auth.uid()) og lese. Ingen update/delete-policyer finnes, og
-- rettighetene revokes eksplisitt. service_role omgår RLS (kun server-side bruk).

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid not null,
  actor_type text not null default 'human' check (actor_type in ('human', 'service')),
  event_type text not null,
  object_type text,
  object_id text,
  source text not null default 'detox-os-dashboard',
  correlation_id text,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists activity_events_occurred_at_idx
  on public.activity_events (occurred_at desc);
create index if not exists activity_events_object_idx
  on public.activity_events (object_type, object_id);
create index if not exists activity_events_correlation_idx
  on public.activity_events (correlation_id);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events insert own" on public.activity_events;
create policy "activity_events insert own"
  on public.activity_events for insert to authenticated
  with check (actor_id = auth.uid());

drop policy if exists "activity_events read" on public.activity_events;
create policy "activity_events read"
  on public.activity_events for select to authenticated
  using (true);

-- Ingen update/delete-policyer: append-only for alle ikke-service-roller.
revoke update, delete on public.activity_events from anon, authenticated;
revoke all on public.activity_events from anon;
