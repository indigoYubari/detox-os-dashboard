-- 0003: lukk resten av den kliniske eksponeringen + forretningsdata.
--
-- Bakgrunn: 0002 låste public.clients, men obsidian_sync.payload speiler de
-- samme kliniske feltene (ai_analysis, tests_received, zoom_summary, notes,
-- first_name, last_name_initial, meeting_date, status) og var fortsatt
-- anonymt lesbar. Klinisk P0 var derfor kun halvveis lukket.
--
-- obsidian_sync er en kø-tabell: trigger clients_obsidian_sync på clients
-- fyller den, og en lokal agent (~/Desktop/obsidian-sync-agent,
-- launchd no.detox.obsidian-sync) skulle konsumere den. Agenten har stått
-- siden 2026-06-19 (17 rader synket 06-18, 6 rader fra 06-19 aldri plukket
-- opp). Ingen referanser i dashboard-koden på noen branch. Ingenting
-- kjørende brytes derfor av denne migrasjonen.
--
-- Gjenopplives agenten skal den bruke SUPABASE_SERVICE_ROLE_KEY — den kjører
-- server-side og skal aldri bruke anon-nøkkel mot klinisk data.
--
-- product_pipeline (387 rader forretningsdata) låses etter samme mønster.
-- roadmap og roadmap_comments røres IKKE: kun SELECT på 12 roadmap-elementer,
-- plausibelt tilsiktet offentlig. Egen beslutning hvis det skal endres.
--
-- Samme framgangsmåte som 0002: policynavnene ble laget ad hoc i SQL Editor,
-- så alle eksisterende policyer droppes dynamisk framfor å gjettes på navn.
--
-- Verifisering etter kjøring (MÅ gjøres før P0 regnes som lukket):
--   curl -s -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     "https://<project>.supabase.co/rest/v1/obsidian_sync?select=id&limit=1"
--   Forventet: permission denied / 401, IKKE data.

do $$
declare pol record;
begin
  for pol in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('obsidian_sync', 'product_pipeline')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table public.obsidian_sync enable row level security;
alter table public.product_pipeline enable row level security;

create policy "obsidian_sync authenticated all"
  on public.obsidian_sync for all to authenticated
  using (true) with check (true);

create policy "product_pipeline authenticated all"
  on public.product_pipeline for all to authenticated
  using (true) with check (true);

revoke all on public.obsidian_sync from anon;
revoke all on public.product_pipeline from anon;
