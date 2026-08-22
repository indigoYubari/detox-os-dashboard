-- 0004: fjern anonym SKRIVE-tilgang til roadmap-tabellene, behold lesing.
--
-- Bakgrunn: roadmap og roadmap_comments er de eneste tabellene som fortsatt er
-- åpne for anon etter 0002/0003. Det er bevisst — en offentlig lesbar roadmap
-- er plausibelt tilsiktet, og roadmap_comments sin INSERT-policy tyder på at
-- hvem som helst skal kunne kommentere.
--
-- Problemet er ikke policyene, det er GRANTS. anon har i dag:
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
-- på begge tabellene.
--
-- DELETE og UPDATE er i praksis blokkert av RLS, siden det ikke finnes
-- policyer for dem. Men TRUNCATE gates IKKE av row-level security i
-- PostgreSQL — det er en tabell-operasjon som går utenom RLS helt. Med
-- TRUNCATE-grant kan hvem som helst med anon-nøkkelen (som ligger i
-- frontend-bundelen) tømme begge tabellene fullstendig.
--
-- Denne migrasjonen trekker tilbake alt og gir tilbake kun det som faktisk
-- trengs for den tilsiktede oppførselen:
--   roadmap           -> SELECT           (offentlig lesbar roadmap)
--   roadmap_comments  -> SELECT, INSERT   (offentlig lesing + kommentering)
--
-- Policyene røres IKKE — de uttrykker allerede riktig intensjon:
--   roadmap.public_read           SELECT til public
--   roadmap_comments.public_read  SELECT til public
--   roadmap_comments.auth_write   INSERT til public
--
-- Verifisering etter kjøring:
--   Anonym SELECT mot begge skal fortsatt VIRKE (det er poenget).
--   Anonym INSERT mot roadmap skal nektes.
--   Anonym INSERT mot roadmap_comments skal fortsatt virke.
--   TRUNCATE-grant skal være borte (sjekk role_table_grants, ikke test den).

revoke all on public.roadmap from anon;
revoke all on public.roadmap_comments from anon;

grant select on public.roadmap to anon;
grant select, insert on public.roadmap_comments to anon;
