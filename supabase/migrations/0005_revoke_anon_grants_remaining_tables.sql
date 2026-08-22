-- 0005: fjern anon sine gjenstående grants på de siste seks tabellene.
--
-- Bakgrunn: agents, batches, notes, pipelines, sops og suppliers har RLS på
-- uten en eneste policy. Det ble tidligere vurdert som "stengt, ingen handling
-- nødvendig" (sesjonslogg 2026-08-22, siden rettet). Den vurderingen holder for
-- SELECT/INSERT/UPDATE/DELETE, som RLS faktisk blokkerer når ingen policy
-- finnes — men den er feil for TRUNCATE.
--
-- TRUNCATE gates IKKE av row-level security i PostgreSQL. Den styres kun av
-- table-grants. Alle seks tabellene har i dag DELETE, INSERT, REFERENCES,
-- SELECT, TRIGGER, TRUNCATE og UPDATE gitt til anon. Konsekvensen er at hvem
-- som helst med anon-nøkkelen fra frontend-bundelen kan TØMME dem, selv om de
-- ikke kan lese en eneste rad.
--
-- Omfang ved kjøring: 24 rader til sammen (batches 5, agents 4, notes 4,
-- sops 4, suppliers 4, pipelines 3). Ingen personopplysninger.
--
-- Ingenting gis tilbake: RLS nekter allerede all lesing og skriving for anon,
-- så det finnes ingen legitim anon-bruk å bevare. Innloggede brukere og
-- service_role er upåvirket.
--
-- Verifisering etter kjøring:
--   select table_name, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and grantee='anon';
--   Forventet: kun roadmap (SELECT) og roadmap_comments (SELECT, INSERT).
--   Radtellingene skal være uendret — dette er en ren rettighetsendring.

revoke all on public.agents     from anon;
revoke all on public.batches    from anon;
revoke all on public.notes      from anon;
revoke all on public.pipelines  from anon;
revoke all on public.sops       from anon;
revoke all on public.suppliers  from anon;
