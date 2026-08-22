-- 0006 — least privilege for rollen `authenticated`
--
-- Bakgrunn: 0002–0005 fjernet anon sin tilgang. Rollen `authenticated` beholdt
-- derimot DELETE, TRUNCATE, REFERENCES og TRIGGER paa samtlige tabeller, og
-- policyene paa clients/obsidian_sync/product_pipeline var `ALL … USING (true)`.
-- Enhver innlogget bruker kunne dermed tomme kliniske data — samme feilklasse
-- som TRUNCATE-funnet i 0005, ett lag inn. `authenticated` hadde ogsaa TRUNCATE
-- paa activity_events, som skal vaere append-only.
--
-- Rettighetene under er utledet fra hva koden faktisk gjor (statisk sveip over
-- src/ etter .from("<tabell>").<operasjon>), ikke fra hva som er tenkelig:
--
--   activity_events   insert            (+ select for audit-visning, policy finnes)
--   agents            select
--   batches           -                 (ingen kodetreff; policy gir kun select)
--   clients           select insert update
--   notes             select
--   obsidian_sync     -                 (ingen kodetreff; se trigger-merknad)
--   pipelines         select
--   product_pipeline  select update
--   roadmap           select insert update
--   roadmap_comments  select insert
--   sops              select
--   suppliers         select
--
-- TRIGGER-MERKNAD (viktig): `notify_obsidian_sync` paa clients er IKKE
-- SECURITY DEFINER og kjorer derfor som den innloggede brukeren. Den skriver
-- til obsidian_sync ved hver INSERT/UPDATE paa clients. `authenticated` maa
-- derfor beholde INSERT paa obsidian_sync, ellers slutter klientregistrering
-- aa virke. SELECT/UPDATE/DELETE/TRUNCATE fjernes. Koen er dod (agenten har
-- staatt siden 2026-06-19) og bor ryddes separat — se handoff.
--
-- Ingen data endres. Kun rettigheter og policyer.

begin;

-- ── 1. Fjern rettigheter ingen app-flyt trenger, paa alle tabeller ──────────
-- TRUNCATE gates ALDRI av RLS. REFERENCES/TRIGGER er DDL-naere og hoerer ikke
-- hjemme hos en klientrolle.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 2. Presise grants per tabell ────────────────────────────────────────────

-- Kliniske data. Ingen DELETE: sletting av en klient skal skje bevisst
-- server-side (service_role), ikke fra en nettleserklient.
revoke all on public.clients from authenticated;
grant select, insert, update on public.clients to authenticated;

-- Kopi av kliniske data i en dod ko. Kun INSERT, og kun fordi triggeren
-- over krever det. Ingen lesing.
revoke all on public.obsidian_sync from authenticated;
grant insert on public.obsidian_sync to authenticated;

-- Append-only audit. Ingen UPDATE, DELETE eller TRUNCATE — heller ikke for
-- innloggede brukere.
revoke all on public.activity_events from authenticated;
grant select, insert on public.activity_events to authenticated;

-- Forretningsdata. Koden leser og oppdaterer; den oppretter og sletter ikke.
revoke all on public.product_pipeline from authenticated;
grant select, update on public.product_pipeline to authenticated;

-- Roadmap: intern redigering, offentlig lesing (anon-grants roeres ikke her).
revoke all on public.roadmap from authenticated;
grant select, insert, update on public.roadmap to authenticated;

revoke all on public.roadmap_comments from authenticated;
grant select, insert on public.roadmap_comments to authenticated;

-- Operasjonelle oppslagstabeller. Policyene gir uansett kun lesing;
-- grants speiler det naa.
revoke all on public.agents    from authenticated;
revoke all on public.batches   from authenticated;
revoke all on public.notes     from authenticated;
revoke all on public.pipelines from authenticated;
revoke all on public.sops      from authenticated;
revoke all on public.suppliers from authenticated;
grant select on public.agents, public.batches, public.notes,
                public.pipelines, public.sops, public.suppliers
  to authenticated;

-- ── 3. Erstatt brede ALL-policyer med operasjonsspesifikke ──────────────────
-- Grants alene ville holdt, men et `ALL … USING (true)` gir feil svar paa
-- spoersmaalet "hva har denne rollen lov til?" ved neste gjennomgang.

drop policy if exists "clients authenticated all" on public.clients;
create policy "clients authenticated select" on public.clients
  for select to authenticated using (true);
create policy "clients authenticated insert" on public.clients
  for insert to authenticated with check (true);
create policy "clients authenticated update" on public.clients
  for update to authenticated using (true) with check (true);

drop policy if exists "obsidian_sync authenticated all" on public.obsidian_sync;
create policy "obsidian_sync trigger insert" on public.obsidian_sync
  for insert to authenticated with check (true);

drop policy if exists "product_pipeline authenticated all" on public.product_pipeline;
create policy "product_pipeline authenticated select" on public.product_pipeline
  for select to authenticated using (true);
create policy "product_pipeline authenticated update" on public.product_pipeline
  for update to authenticated using (true) with check (true);

commit;

-- ── Verifisering (kjores separat) ───────────────────────────────────────────
--
-- Forventet resultat for authenticated etter denne migrasjonen:
--   activity_events   INSERT,SELECT
--   agents            SELECT
--   batches           SELECT
--   clients           INSERT,SELECT,UPDATE
--   notes             SELECT
--   obsidian_sync     INSERT
--   pipelines         SELECT
--   product_pipeline  SELECT,UPDATE
--   roadmap           INSERT,SELECT,UPDATE
--   roadmap_comments  INSERT,SELECT
--   sops              SELECT
--   suppliers         SELECT
--
--   select grantee, table_name,
--          string_agg(privilege_type, ',' order by privilege_type)
--     from information_schema.role_table_grants
--    where table_schema = 'public' and grantee = 'authenticated'
--    group by 1, 2 order by 2;
--
-- Negativ runtime-test som innlogget bruker (skal alle feile):
--   delete from clients where id = '<finnes-ikke>';   -- permission denied
--   truncate activity_events;                          -- permission denied
--   select * from obsidian_sync limit 1;               -- permission denied
--
-- Positiv test (skal virke): opprett en klient via /klinisk — triggeren maa
-- fortsatt faa lov til aa skrive til obsidian_sync.
