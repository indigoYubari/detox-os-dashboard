-- 0008: eier-lesing av shared state + eier-skriving til requests (/eiere v1).
--
-- Bakgrunn: reports/findings/recommendations/requests/run_state ble opprettet i
-- shared-state 0001 (2026-08-30) med RLS paa og NULL policyer — kun
-- service_role slipper inn. Det var riktig for nattjobbene. Eier-oversikten
-- (/eiere) leser med brukerens egen session (arkitektur A: RSC + brukersesjon,
-- aldri service_role i appen), og trenger derfor:
--
--   reports, findings, recommendations, run_state   SELECT for authenticated
--   requests                                        SELECT + INSERT + UPDATE,
--                                                   skriving gated paa detox_role
--
-- Samme moenster som 0007 (content_items). Ingen DELETE, ingen TRUNCATE, ingen
-- grants til anon, ingen endring paa agent_events, feedback eller
-- activity_events (frosset). Ingen kolonner, tabeller eller constraints endres.
--
-- Additiv og idempotent. Kjoeres via Management API mot kwrjhyytvbcaiszbfria
-- etter Adrians godkjenning. Testet i en transaksjon med ROLLBACK 2026-09-08
-- (se rapport fra-claude-eiere-v1-2026-09-08.md): policyene gir en
-- authenticated-JWT med detox_role=founder lesing av Anakins rapporter og
-- insert/update i requests; uten detox_role avvises skriving.

begin;

-- ── Lesing ──────────────────────────────────────────────────────────────────
grant select on public.reports, public.findings, public.recommendations,
                public.run_state
  to authenticated;

drop policy if exists "reports owner read" on public.reports;
create policy "reports owner read"
  on public.reports for select to authenticated using (true);

drop policy if exists "findings owner read" on public.findings;
create policy "findings owner read"
  on public.findings for select to authenticated using (true);

drop policy if exists "recommendations owner read" on public.recommendations;
create policy "recommendations owner read"
  on public.recommendations for select to authenticated using (true);

drop policy if exists "run_state owner read" on public.run_state;
create policy "run_state owner read"
  on public.run_state for select to authenticated using (true);

-- ── requests: lesing for alle innloggede, skriving for eier-roller ──────────
grant select, insert, update on public.requests to authenticated;

drop policy if exists "requests owner read" on public.requests;
create policy "requests owner read"
  on public.requests for select to authenticated using (true);

drop policy if exists "requests owner insert" on public.requests;
create policy "requests owner insert"
  on public.requests for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  );

drop policy if exists "requests owner update" on public.requests;
create policy "requests owner update"
  on public.requests for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'detox_role') in ('admin', 'founder', 'operator')
  );

-- anon skal fortsatt ikke ha noe. RLS gater ikke TRUNCATE; grants maa vaere
-- eksplisitt fravaerende.
revoke all on public.reports, public.findings, public.recommendations,
              public.run_state, public.requests
  from anon;

commit;

-- ── Rollback (kjoeres separat ved behov) ────────────────────────────────────
-- begin;
-- drop policy if exists "reports owner read"          on public.reports;
-- drop policy if exists "findings owner read"         on public.findings;
-- drop policy if exists "recommendations owner read"  on public.recommendations;
-- drop policy if exists "run_state owner read"        on public.run_state;
-- drop policy if exists "requests owner read"         on public.requests;
-- drop policy if exists "requests owner insert"       on public.requests;
-- drop policy if exists "requests owner update"       on public.requests;
-- revoke all on public.reports, public.findings, public.recommendations,
--               public.run_state, public.requests
--   from authenticated;
-- commit;

-- ── Verifisering (etter apply) ──────────────────────────────────────────────
--   select grantee, table_name, string_agg(privilege_type, ',' order by 1)
--     from information_schema.role_table_grants
--    where table_schema='public' and grantee in ('anon','authenticated')
--      and table_name in ('reports','findings','recommendations','run_state','requests')
--    group by 1,2 order by 2,1;
--   -- forventet: authenticated: reports/findings/recommendations/run_state SELECT,
--   --            requests INSERT,SELECT,UPDATE. anon: ingen rader.
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('reports','findings','recommendations','run_state','requests');
--   -- forventet: 7 policyer, ingen for DELETE.
