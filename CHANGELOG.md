# Changelog

All notable changes to Detox OS Dashboard should be documented here.

## Unreleased

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