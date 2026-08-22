-- 0002: P0-sikkerhetsfix - fjern anonym tilgang til klinisk klientdata.
--
-- Bakgrunn (sikkerhetsreview 2026-08-22, trussel T1): public.clients inneholder
-- særlige kategorier (helse) og hadde "anon full access"-RLS (dokumentert i
-- src/lib/supabase.ts sin TODO). Denne migrasjonen dropper ALLE eksisterende
-- policyer på clients (navnene ble laget ad hoc i SQL Editor og er ukjente)
-- og erstatter dem med authenticated-only.
--
-- Konsekvenser:
-- - /klinisk fungerer som før for innloggede brukere (browser-klienten sender
--   brukerens JWT etter innlogging).
-- - Skript som bruker ren anon-nøkkel uten innlogging (f.eks. npm run seed)
--   mister tilgang til clients; bruk SUPABASE_SERVICE_ROLE_KEY lokalt ved behov.
-- - obsidian_sync og øvrige tabeller røres IKKE her (egen slice; lokal
--   sync-agent med ukjent klientnøkkel må kartlegges først).
--
-- Verifisering etter kjøring (MÅ gjøres før T1 regnes som lukket):
--   curl -s -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     "https://<project>.supabase.co/rest/v1/clients?select=id&limit=1"
--   Forventet: tom liste/feil (permission denied), IKKE data.

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'clients'
  loop
    execute format('drop policy %I on public.clients', pol.policyname);
  end loop;
end $$;

alter table public.clients enable row level security;

create policy "clients authenticated all"
  on public.clients for all to authenticated
  using (true) with check (true);

revoke all on public.clients from anon;
