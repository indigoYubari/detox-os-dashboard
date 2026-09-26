# Changelog

All notable changes to Detox OS Dashboard should be documented here.

## Unreleased

### 2026-09-26 — «Glemt passord» virker

PR #51 la inn innloggingsrettelser og en passordflyt som ikke virket.

#### Added

- **Innlogging** (PR #51): WCAG-rettelser, sidetittel «Logg inn – detox.OS»
  og lenken «Glemt passord?».
- **`/auth/callback`**: lenken i e-posten lander her. Koden (PKCE) veksles
  inn i en sesjon-cookie, og brukeren sendes til `/oppdater-passord`. Utløpt,
  brukt eller ugyldig lenke sender tilbake til `/glemt-passord` med en
  forklaring. `next` godtar bare interne stier.
- Tester for hele kjeden (`passord.test.ts`).

#### Fixed

- `/glemt-passord` og `/auth/callback` er offentlige stier. Før sendte
  middleware den som hadde glemt passordet, rett tilbake til `/login`.
- `/oppdater-passord` lette etter `access_token` i adressen, som
  `@supabase/ssr` aldri sender, og viste derfor alltid «Ugyldig lenke». Siden
  bruker nå sesjonen fra callback-ruten og krever innlogging som alle andre
  sider. Nytt passord må ha minst 8 tegn.
- Meldinger på passordsidene leses opp av skjermlesere (`role="status"`/`"alert"`).

#### Depends on

- Supabase Auth → URL Configuration må tillate
  `https://os.detox.no/auth/callback**` som redirect URL. Ellers sender
  Supabase lenken til Site URL i stedet.

### 2026-09-25 — Køen som avgjørelsesflate, og en røyktest mot virkeligheten

Plan: `docs/plan-2026-09-25-virkelighetsbevis-og-koen.md`.

#### Added

- **`/koe`**: køen «Guider som venter på ja» (produkt-kandidater) har navn,
  forklaring og egne knappetekster. Hver post viser hvor lenge den har ventet,
  med varsel etter en uke. Annonse-råd sier at rådene byttes ut hver natt, og
  hvor mange som utgikk ubesvart siste 7 dager. Ny seksjon «Avgjort» med
  kvittering fra huben (hvem som utførte, når), og varsel når en avgjørelse
  ikke er utført etter et døgn. Kun lesing; ingen skjemaendring.
- **Røyktest** (`e2e/roeyktest.spec.ts`, Playwright) med rød sti (uinnlogget)
  og grønn sti (testbruker), og CI-jobben `røyktest`.

### 2026-09-25 — Én flate: (main) pensjonert, nye sider på de gamle stiene

Retning A (Adrian 24.09, ja til hele (main) 25.09): den nye lyse flaten er det
ene dashbordet.

#### Added

- **`/eiere`** («Anakin»): pulsen, planen, briefingen, samtalene, køen og uken
  fra Anakins Content Radar. Alt som skrives går til `requests`.
- **`/radar`** («Funnene»): funn-utforsker, 7/30 dager, agent og type.
- **`/butikk`** («Butikken»): Shopify-dykket, live fra ad-agenten.
- **`/annonser`** («Annonsene»): betalt media, kampanjer, søkeord, forslag og
  rådene i basen. Kun lesing; ja/nei gis i køen.
- Agentkøen på forsiden leser `priority` fra body-hodet og setter høy/kritisk
  først.

#### Removed

- **`src/app/(main)/`** med alle sidene (overview, oversikt, i-dag, status,
  agenter, innhold, quiz, anmeldelser, klinisk, leverandorer, pipelines, sops,
  notater, roadmap, claude, kundeservice, okonomi, innstillinger, og de gamle
  eiere/radar/butikk/annonser). Komponentene og `src/data/` som bare den
  brukte, `npm run generate`, og «Gammelt dashbord»-lenken.

### 2026-09-16 — «Dagens»: ny, lys forside for Kim og Anniken

En ny flate for eierne, bygget ved siden av den gamle. Det gamle dashbordet er
uendret og ligger fortsatt på `/overview` med sin egen meny.

#### Added

- **`/` — «Dagens».** Fire seksjoner, ett klart svar hver, detaljer bak et
  klikk: butikken i går, hva som venter på et ja/nei, hva agentene fant i
  natt, og kundeservice. Én lede-setning øverst som peker på det som faktisk
  krever et menneske — køen går foran omsetningen.
- **Nytt lyst designsystem** (`src/app/(ny)/lys.css`), scopet til `.lys`.
  Kremhvitt, mørk tekst, én aksentfarge, mye luft. Ingen Tailwind-klasser i
  den nye flaten — den skal kunne leses som ett dokument.
- **Rene hjelpere med tester** (`src/app/(ny)/dagens.ts`): dato på norsk,
  kroner og tall, varighet, nattens funn, køen, og lede-setningen. 17 nye
  tester (281 totalt).

#### Changed

- **Rot-layouten er nå et nakent skall** (`html`, fonter, tema). Den gamle
  rammen — sidebar, topbar, partikkelbakgrunn — er flyttet til
  `(main)/layout.tsx`. Før la rot-layouten på en sidebar også på `/login` og
  på 404-siden, og alle sider lå inne i `<main className="lg:pl-[200px]">`,
  også de som ikke har en sidebar å lene seg på.
- **`/` omdirigerer ikke lenger til `/overview`.** Den nye flaten eier `/`.
  Nettlesere som har cachet den permanente omdirigeringen kan trenge én
  omlasting.
- **Metadata var fortsatt Tremor-malen**: `metadataBase` pekte på
  `yoururl.com`, forfatter var `yourname`, `twitter.creator` var
  `@tremorlabs` og tittelen var «Tremor OSS Dashboard». Nå `os.detox.no`,
  `detox.OS`, `nb_NO` og `lang="no"`.

#### Depends on

- Køen leses fra `requests` (migrasjon 0008) og natten fra `findings ⋈
  reports`. Én seksjon viser en navngitt feil hvis en av dem mangler grants.
- `/butikk`-tallene på `/` kommer fra ad-agentens `GET /api/metrics` for i går
  og `GET /api/metrics/inventory`; kundeservice fra `/api/gmail/kundeservice`.
  Ingen av dem faller tilbake til mock.

### 2026-09-15 — eier-flaten presentabel igjen (Orion CC-DASHBOARD-15-09)

#### Changed

- `/butikk`: bygget om i den etablerte kort-stilen (`KpiCard`/`OsCard`). Fem av de
  åtte «ikke tilgjengelig»-kortene er koblet til ekte data: topprodukter med navn,
  antall ulike produkter, netto omsetning (uten refunderte/annullerte), nye vs.
  returnerende kunder, lagerstatus/lav beholdning. De tre som gjenstår
  (refusjoner, konvertering/besøkende, siste ordrer) står på én linje hver, med
  intern forklaring bak «Vis detaljer» — ingen tabell- eller endepunktsnavn i
  eier-flaten.
- `/i-dag`: én KPI-rad med deltaer i stedet for to rader med samme tall i ulik
  stil. Dato rendres etter mount (aldri en frosset deploy-dato), «…» mens tall
  laster (aldri `n/a` før kilden faktisk har feilet). Kildefeil viser rutens
  `hint`.
- `(main)/layout.tsx`: `dynamic = "force-dynamic"` — ti sider ble
  forhåndsrendret ved bygg og serverte øyeblikksbildet fra deploy-dagen.
- Sidebar: identitetskortet påsto «Kim / Daglig leder» for alle. Viser nå den
  felles etiketten «Detox · eiere» + sesjonens e-post (én delt konto er et
  vedtak; ingen ny auth-kode).
- `/status`: «Ventende forslag» viser rutens `hint` i stedet for «Kunne ikke
  hente».
- `/oversikt`: «Listestørrelse» forklarer hvorfor den mangler (Klaviyo-nøkkelen
  mangler tilgang til lister).

#### Fixed

- `/api/detox/[...path]`: et ikke-JSON-svar fra ad-agenten (Express' 404-side
  for en rute som ikke finnes) ble rapportert som `backend_unavailable`. Nå
  `backend_route_missing` (404) / `backend_bad_response` (annet), med
  `backend_status`, `code` og `hint`. Rotårsak for proposals-502: ruta finnes
  ikke i ad-agentens `main` (ligger i umerget gren).
- `/api/klaviyo/siste-kampanje`: 401/403 fra Klaviyo gir `klaviyo_forbidden` +
  hint i stedet for `klaviyo_unavailable`. Alle kilde-feilsvar bærer nå
  `code` + `hint`, og ved annen feil `upstream_status` + `upstream_error`
  (`src/lib/source-state.ts`).
- **Klaviyo-502 — faktisk rotårsak (live-diagnostisert samme dag):** ikke
  scope. Klaviyo svarte 400 fordi (1) campaigns-kallet sendte `page[size]`,
  som endepunktet ikke støtter, og (2) `profile_count` ble bedt om på
  Get Lists (samlingen) der det ikke finnes — det finnes kun på Get List
  (én liste). Begge rettet: campaigns uten `page[size]`, listestørrelse
  hentes per liste.

#### Depends on

- ad-automation-agent: `GET /api/metrics/shopify` og `GET /api/metrics/inventory`
  (gren `feat/metrics-shopify-detail`). Uten dem viser de nye kortene på
  `/butikk` en navngitt feil, ikke tall.

### Added

- Added `/docs` folder with architecture, Supabase, agents, pipelines, deployment and troubleshooting documentation.
- Added contribution guidelines.

### Changed

- Documentation now better explains the operating model and development expectations.

## Notes

Use this file to summarize changes that affect dashboard modules, Supabase tables, authentication, deployment or internal workflows.