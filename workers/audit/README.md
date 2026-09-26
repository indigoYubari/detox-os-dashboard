# workers/audit — datalaget for detox.no-auditten

Daterte øyeblikksbilder fra GSC, Merchant Center og Shopify inn i Supabase, så
auditten kan bygge på evidens i stedet for eksporter og skjermbilder.

**Kun lesing mot kildene.** Ingen skriving til Shopify, Merchant Center, GSC eller
Google Ads. Det ene unntaket er `skript/register-gcp.mjs`, se nederst.

Spesifikasjon: `DETOX-NO-AUDIT-DATA-LAYER-SPEC-V1.md` (V1.1). Sprint 1a dekker
§3.1–§3.4, klientmodulene med read-only-vakter, og `gsc_backfill`.

## Prinsippene (samme som `scripts/sok-natt.py`)

- **Jobben projiserer.** Klikk, visninger, CTR og posisjon lagres slik kilden
  oppgir dem. Ingenting regnes ut — heller ikke CTR.
- **Ingen rad = ukjent.** Svarer ikke kilden, skrives ingen rad. Aldri et anslag,
  aldri en nullrad som ser ut som en måling.
- **Ingenting overskrives.** En ny kjøring gir et nytt øyeblikksbilde.
- **Nøkler printes aldri.** `masker()` brukes på alt som går til skjerm eller logg.

## Oppsett

```bash
cd workers/audit
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt   # kun google-auth
```

`google-auth` er eneste tredjepartspakke, og brukes bare til å signere
service-konto-JWT (RS256 — standardbiblioteket kan ikke det). Alt HTTP går via
`urllib`, som sok-natt.

### Miljøvariabler

Leses i denne rekkefølgen, første treff vinner:

1. **Miljøet** — systemd på huben, eller `export` i skallet.
2. **`~/.config/detox-audit/supabase.env`** — lokalt (chmod 600).
3. **`/root/.env.secrets`** — hubens hemmeligheter.

Bare navnene i `TRENGS` leses inn. En env-fil kan inneholde nøkler til andre
systemer, og de skal ikke inn i prosessen i det hele tatt.

`felles.hemmelig.kilder()` sier hvilke kilder som finnes på maskinen — sti og
«finnes»/«finnes ikke», aldri en verdi.

| Navn | Hva |
|---|---|
| `DETOX_SUPABASE_URL` | samme som sok-natt bruker |
| `DETOX_SUPABASE_SERVICE_ROLE_KEY` | samme som sok-natt bruker |
| `GOOGLE_SA_JSON` | base64 av service-konto-JSON (huben) |
| `GOOGLE_SA_JSON_PATH` | filsti i stedet for base64 (lokalt) |
| `GSC_SITE_URL` | `sc-domain:detox.no` |
| `MERCHANT_ACCOUNT_ID` | `5365874444` |
| `SHOPIFY_SHOP_DOMAIN` | samme som `src/app/api/shopify/i-dag/route.ts` |
| `SHOPIFY_ADMIN_TOKEN` | samme som over |

Er verken `GOOGLE_SA_JSON` eller `GOOGLE_SA_JSON_PATH` satt, faller koden tilbake
på `~/.config/detox-audit/sa.json` (chmod 600). Nøkkelen skal aldri i repoet.

## Kjøring

```bash
cd workers/audit

# Tørrkjøring: hent én dag, vis tall, skriv ingenting.
GSC_SITE_URL="sc-domain:detox.no" .venv/bin/python -m jobber.gsc_backfill \
  --torrkjor --dag 2026-09-22

# Full backfill: 16 måneder, dag for dag. Kan avbrytes og fortsettes.
.venv/bin/python -m jobber.gsc_backfill

# Et utsnitt.
.venv/bin/python -m jobber.gsc_backfill --fra 2025-06-01 --til 2025-06-30
```

`gsc_backfill` er **avbrytbar**. Neste kjøring leser `audit_snapshots` og hopper
over de (dag, granularitet)-parene som allerede står `ok`. Den unike indeksen i
migrering 0013 sørger for at et par ikke kan stå `ok` to ganger.

Ved kvotefeil (429) venter jobben 15 minutter og prøver opptil tre ganger. Gir den
opp, merkes dagen `failed`, jobben går videre, og dagene listes til slutt — én
vanskelig dag skal ikke stoppe seksten måneder.

Backfill kan ta timer til et par dager. Det er forventet.

## Tester

```bash
cd workers/audit
.venv/bin/python -m unittest discover -s tester -t . -v
```

33 tester, alle offline. `tester/test_read_only.py` er mutasjonstestene: hver av
dem prøver en skriving og **forventer at den feiler**. De erstatter `http()` med
en funksjon som kaster hvis den blir kalt — treffer en test nettet, er vakten feil
bygget.

## Read-only-sikringen (§6)

| Kilde | Scope | Vakt |
|---|---|---|
| GSC | `webmasters.readonly` | tillatelsesliste med nøyaktig ett endepunkt |
| Merchant | `content` | avviser alt som ikke er GET, og skrivende metodenavn i stien |
| Shopify | admin-token | avviser `mutation` og `subscription`, krever at dokumentet starter med `query` |

**GSC gates ikke på «bare GET», og det er med vilje.** Search Analytics er
`POST .../searchAnalytics/query` — en POST som leser. En GET-regel ville gjort
klienten ubrukelig uten å gjøre den tryggere. Sikringen er scopet (som teknisk
ikke kan skrive) pluss tillatelseslisten.

**Merchant gates på GET,** fordi scopet `content` også tillater skriving. Der er
brukerrollen og vakten det eneste som står mellom koden og en skriving.

## Merchant API v1 — v1beta er stengt

**v1beta ble slått av 28.02.2026.** All Merchant-kode her bruker v1. Vakten
avviser `/v1beta/` og `/v1alpha/` eksplisitt, så versjonen ikke kan gli tilbake.

### Verifiserte v1-endepunkter

Verifisert mot Googles dokumentasjon 26.09.2026, og stiene er bekreftet av et
ekte kall (se «Hva som mangler» under).

| Metode | Sti | Maks `pageSize` |
|---|---|---|
| `products.list` | `GET /products/v1/accounts/{konto}/products` | 1000 |
| `products.get` | `GET /products/v1/accounts/{konto}/products/{id}` | — |
| `dataSources.list` | `GET /datasources/v1/accounts/{konto}/dataSources` | 1000 |
| `accounts.issues.list` | `GET /accounts/v1/accounts/{konto}/issues` | **100** (std. 50) |

`pageSize` er ikke valgfri pynt: å be om mer enn Googles maks gir 400. Merk at
varsler har 100 som tak, ikke 1000.

### Vakten: tillatelsesliste, ikke bare svarteliste

Lag 1 er en tillatelsesliste med de fire stiene over. Alt annet avvises —
inkludert endepunkter Google legger til senere. Lag 2 er svartelista
(`insert`, `patch`, `update`, `delete`, `create`, `register`, `fetch`) og
`productInputs`, som er skriveressursen i Merchant API.

Svartelista kjøres på stien **uten** produkt-ID-en. En produkt-ID som inneholder
«update» er kundedata, ikke en skriving, og skal ikke gi falsk avvisning.
`GET /products/v1/accounts/1/products/create` er derfor lov: det er `products.get`
av et produkt som heter «create». Google bruker `:metode` for skriving, så den
URL-en kan ikke skrive noe — og `products:insert` avvises.

### Rådata lagres før tolkning

`felles/raa.py` skriver hvert rå sidesvar uendret til `raadata/` (gitignorert,
gzip) **før** noe mappes. Spesifikasjonen §3.3 krever at hele råsvaret bevares,
fordi feltnavnene kan avvike fra antakelsene. `raa.relativ()` gir en sti som kan
gjenbrukes som `raw_path` når Storage-bøtta `audit-raw` kommer.

### Feilhåndtering

`felles/nett.py` parser Googles AIP-193-format og bruker `metadata.REASON`, som
Google eksplisitt ber om — ikke meldingsteksten.

| Status | Type | Handling |
|---|---|---|
| 401, 403 | `Nektet` | ikke prøv igjen — nøkkel, scope eller rolle |
| 404 | `Mangler` | sti eller konto-ID feil |
| 429, 500, 502, 503, 504 | `Rate` | prøv igjen med økende pause |
| annet | `KildeFeil` | statuskode og REASON bevart |

## Engangsregistrering av Cloud-prosjektet

**Det eneste skrivende kallet i hele datalaget**, bevisst unntatt vakten i
`klienter/merchant.py`. Merchant API krever at Cloud-prosjektet registreres mot
Merchant Center-kontoen én gang før noe kan leses.

Det avgjørende: `registerGcp` tar **ingen prosjekt-parameter**. Kroppen er bare
`{"developerEmail": ...}`, og Google utleder prosjektet fra legitimasjonen som
gjør kallet. Legitimasjonen må derfor høre til **`detox-audit`** (nr. 231263225804)
— det prosjektet Googles feilmelding ba om. Repoets eksisterende
`GOOGLE_CLIENT_ID` hører til et annet prosjekt (Gmail, `kontakt@detox.no`) og ville
registrert feil prosjekt. Ett Cloud-prosjekt kan bare registreres mot én
Merchant Center-konto, så en feilregistrering er ikke trivielt å angre.

### Hovedvei: service-kontoen

`skript/register_gcp_sa.py`. Service-kontoen ligger i `detox-audit`, så prosjektet
blir riktig automatisk.

```bash
cd workers/audit
.venv/bin/python skript/register_gcp_sa.py
```

1. Sett `audit-reader` **midlertidig til Admin** i Merchant Center — Google krever
   ADMIN for dette kallet.
2. Kjør skriptet. Det printer nøyaktig hva det sender og **venter på at du skriver
   `JA`**. Alt annet avbryter, og porten krever store bokstaver.
3. Vent 5 minutter. Google sier det selv.
4. Sett `audit-reader` **tilbake til Standard**.
5. Før endringen inn i `audit_change_log` — dato, hva, hvem.

`developerEmail` er `b2b@detox.no`, ikke service-kontoen: Google krever en vanlig
Google-konto der.

**Uverifisert:** om Google godtar en *service-konto* som kaller på denne metoden
står ikke eksplisitt i dokumentasjonen. Svarer den 403, er det svaret — skriptet
skriver ut hva Google faktisk sa, og forklarer at 403 har to mulige årsaker
(manglende ADMIN, eller at service-kontoer ikke godtas).

### Reserveveien: OAuth-klient i detox-audit

`skript/register-gcp.mjs` (Node, lokal callback på port 3999). Brukes **bare** hvis
service-kontoen avvises med 403.

Den krever en OAuth-klient opprettet i prosjektet `detox-audit` — ikke repoets
eksisterende. Google Cloud Console → Credentials → Create OAuth client ID → Desktop
app, eller Web med `http://localhost:3999/callback`.

```bash
export GOOGLE_CLIENT_ID='<fra detox-audit>'
export GOOGLE_CLIENT_SECRET='<fra detox-audit>'
node skript/register-gcp.mjs
```

Logg inn med `b2b@detox.no`. Samme JA-port.

### Begge kjøres én gang, manuelt, av et menneske

Ikke i jobbene, ikke i en cron, ikke i en timer. `tester/test_register_gcp_sa.py`
vokter porten: uten et eksplisitt `JA` erstattes `urlopen` med en funksjon som
kaster, så en port som svikter gir en rød test og ikke en registrering.

Etter kjøring: vent 5 minutter (Google sier det selv), og før det inn i
`audit_change_log` — dato, hva, hvem.

### Hva som mangler før første ekte Merchant-read

Ett skritt. Verifisert ved et ekte read-only-kall 26.09.2026:

```
GET /datasources/v1/accounts/5365874444/dataSources?pageSize=1
→ 401 UNAUTHENTICATED
  REASON: GCP_NOT_REGISTERED
  "GCP project with id detox-audit and number 231263225804 is not registered
   with the merchant account. ... then try calling the API again in 5 minutes."
```

Det svaret er gode nyheter forkledd som en feil:

- **v1-stien er riktig.** Et galt endepunkt ville gitt 404, ikke en
  registreringsfeil.
- **Service-konto-nøkkelen og `content`-scopet virker.** Tokenet ble hentet og
  godtatt.
- **Det eneste som mangler er registreringen.** Kjør `register-gcp.mjs` én gang.

Merk: Merchant API svarer **401**, ikke 403, når registreringen mangler. Koden
sjekker derfor `REASON`, ikke statuskoden alene.

### Kontrollprodukt: MegaSporeBiotic

`jobber/merchant_kontroll.py` er klar til å kjøre i det registreringen er gjort.
Den leser, lagrer rådata, og rapporterer hvor hvert felt fra §3.3 faktisk ligger
— uten å skrive noe noe sted.

```bash
.venv/bin/python -m jobber.merchant_kontroll --tilganger   # svarer kallene?
.venv/bin/python -m jobber.merchant_kontroll               # full feltrapport
```

Kontrollproduktet er `megasporebiotic-sporebiotika`, samme produkt auditens
schema-funn ble gjort på. Det kobles via `productAttributes.link`, **ikke** via
`offer_id` — mønsteret `shopify_NO_<produktId>_<variantId>` er uverifisert, og
spesifikasjonen §3.6 sier selv at det skal sjekkes mot faktiske data.

Jobben sammenligner også antallet mot de ca. 334 §7 forventer (309 fra
Shopify-feeden + 25 «Found by Google») og rapporterer avviket som ikke forklart.

## Uverifisert mot ekte API

Dette er skrevet ut fra spesifikasjonen og **ikke bekreftet mot et ekte svar**:

- **Merchant produktfelter.** Stiene er verifiserte (se under), men feltnavnene
  inne i et produkt er bare lest ut av dokumentasjonstekst — referansesidene
  rendres med JavaScript og kunne ikke leses. `feltrapport()` sier hvilke som
  faktisk finnes, og `attributes`-kolonnen holder hele råsvaret.
- **Endepunktet i `register-gcp.mjs`**. Svarer Google 404, er stien feil —
  skriptet sier det, og sier hva du skal gjøre.
- **Shopify API-versjon `2026-07`**. Ingen Shopify-nøkkel var tilgjengelig lokalt,
  så versjonen er ikke prøvd. `klienter/shopify.api_versjon_svarer()` sjekker den
  uten å skrive noe.

GSC er derimot verifisert: tørrkjøring mot `sc-domain:detox.no` for 2026-09-22 ga
svar fra alle fire granulariteter.

## Merknad om Shopify-versjon i resten av repoet

`src/app/api/shopify/i-dag/route.ts` står på Admin API `2024-01`, som er utgått.
Denne sprinten bruker `2026-07` i sin egen klient og har **bevisst ikke endret**
den eksisterende ruten. Det er en egen avgjørelse, ikke en del av auditten.

## Avvik mot referansetotalen — rapporteres, men ikke forklart

`gsc_site_daily` er referansetotalen: den har ingen `query`-dimensjon og er den
mest komplette. De andre granularitetene ligger under den. Jobben skriver ut
avviket som et tall og en integritetsstatus, med auditens egne merker. **Den
påstår ikke årsaken** — et avvik er 🟢 for hva kilden rapporterer, aldri for hvorfor.

Målt for 2026-09-22 (tørrkjøring, ingenting skrevet):

| Granularitet | Rader | Klikk | Visninger | Avvik (visninger) | Integritet |
|---|---:|---:|---:|---|---|
| `gsc_site_daily` | 1 | 101 | 3 458 | — | referansetotal |
| `gsc_page_daily` | 486 | 47 | 2 409 | 1 049 (30,3 %) | 🔵 avvik observert, årsak ikke fastslått |
| `gsc_query_daily` | 966 | 46 | 2 175 | 1 283 (37,1 %) | 🟡 delvis/primært forventet: query-anonymisering |
| `gsc_query_page_daily` | 861 | 47 | 2 409 | 1 049 (30,3 %) | 🟡 delvis/primært forventet: query-anonymisering |

For `query`-granularitetene er mekanismen kjent: Google anonymiserer sjeldne søk.
Andelen er ikke målt, derfor 🟡 og ikke 🟢.

For `gsc_page_daily` holder ikke den forklaringen: tabellen har **ingen
`query`-dimensjon**. Google aggregerer dessuten property og side ulikt, og Search
Analytics API garanterer ikke at alle datarader returneres. Avviket er observert;
årsaken er et **åpent spørsmål**, ikke en kjent mekanisme.

Klikk-avviket er verdt en egen merknad: referansen har 101 klikk, de tre andre
46–47. Over halvparten av klikkene faller bort så snart en dimensjon legges på.
Det er kildens tall — jobben regner ingenting ut — men det er ikke forklart.

## Status og hva som gjenstår

Sprint 1a er kode + migrering. **Migrering `0013_audit.sql` er ikke kjørt.**
Repoets `CLAUDE.md` krever Adrians eksplisitte ja før noe i `supabase/migrations/`
kjøres. Før den er kjørt kan `gsc_backfill` bare tørrkjøres.

Sprint 1b: `gsc_daily`, `merchant_snapshot`, `shopify_snapshot`, systemd-timer på
huben.

### Åpent punkt til Adrian: Python-pakker på huben

`scripts/sok-natt.py` er standardbibliotek nettopp for å slippe pakkehåndtering,
og systemd-unitet kjører `/usr/bin/python3` direkte. `google-auth` krever et venv
på huben (f.eks. `/opt/detox/venv`) eller en systemomfattende installasjon. Det er
ikke verifisert hva som finnes der. Avgjøres før systemd-unitet i sprint 1b.

### `gsc_daily` og samme dato to ganger (sprint 1b)

`gsc_daily` henter de siste tre dagene på nytt hver dag, fordi Google justerer
ferske tall. Den unike indeksen i 0013 er derfor begrenset til
`job = 'gsc_backfill'` — `gsc_daily` skal kunne lage nye øyeblikksbilder for en
dato som alt finnes.

Da trengs en regel for hvilket bilde som gjelder. Forslaget er et
`superseded`-flagg eller en `v_gsc_siste`-visning som velger nyeste `ok`-bilde per
(dato, granularitet), slik at analysen ikke dobbelteller. **Bygges i 1b, ikke nå** —
og det er en beslutning som bør tas sammen med Adrian, siden den avgjør hva
«dagens tall» betyr i alle senere views.
