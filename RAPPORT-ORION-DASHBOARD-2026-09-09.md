# Rapport — Detox OS Dashboard: levende + sannhet (2026-09-09)

**Fra:** Orion (hub-en) | **Til:** Adrian + Claude Code (Mac Studio)
**Repo:** `indigoYubari/detox-os-dashboard` | **Branch:** `main` @ `9426fda`

---

## Hva som ER gjort fra hub-en (verifisert)

### 1. MOCK-fallback fjernet (sannhet i stedet for frosne tall)
- Kims WIP-branch `fix/no-silent-mock-fallback` var ferdig skrevet + testet — **merget til main** med konfliktløsning (main hadde endret auth-navnene `requireDetoxUser`/`requireDetoxPrincipal`; begge finnes, WIP-loggikken beholdt).
- Nå: hvis Shopify/Klaviyo/Gmail-nøkler feiler → siden viser **ekte feil**, ikke hardkodede MOCK-tall (7 ordrer/8420 kr, 41% open osv.).
- Ny `src/lib/source-state.ts` med `liveMeta`/`sourceErrorResponse`/`NotConfiguredError`.
- **Evidens:** 158 tester + `tsc --noEmit` ren.

### 2. Ferskhets-markør på /eiere (ny, lagt til i dag)
- `BriefingBand` viser nå **Badge med ferskhet**: 🟢 Fersk (<24t) · 🟡 Eldre enn 24t · 🔴 STALE (>48t) + «Rapport kom [dato] · N t siden».
- Dette gjør at Kim/Anniken umiddelbart ser om data er fersk eller gammel — i stedet for å lure på hvorfor det ser likt ut.
- **Evidens:** 131 tester + tsc ren, push `9426fda`.

### 3. Bekreftet at data flyter inn (live)
- `reports` = 69 rader, siste Anakin Content Radar **09.08 20:37** + Indigo natt-jobber 06:16.
- `v_anakin_content_radar` (65 rader) + `v_indigo_findings` (112 rader) lesbare.
- **Migrasjon 0008 er kjørt** — authenticated har SELECT på reports/findings/requests (verifisert live). Så /eiere-siden har RLS-tilgang.

### 4. /eiere-siden (Radar) finnes allerede — ingen ny side nødvendig
- PR #11 merget: `fetchLatestRadar`, `PulsBand` (salgspuls), `BriefingBand` (Content Radar + funn + spor A/B), `Godkjenningskoe` (med `QueueActions` + Telegram-lenke), `Uken-innhold`, `RequestButtons`.
- Dette ER Radar-siden Claude-prompten ba om — bygget, testet, bare ikke deployet ennå.

---

## Det som GJENSTÅR — deploy til Vercel (krever din terminal / Claude Code)

**Eneste grunn:** Vercel krever interaktiv login + env-variabler som ligger i Vercel-dashboardet (ikke på hub-en). Alt annet er gjort.

Claude Code-prompten ligger i neste fil: `CLAUDE-DEPLOY-DASHBOARD-2026-09-09.md` (lim inn i Claude Code på Mac Studio).

---

## Status per side

| Side | Før | Nå (etter deploy) |
|---|---|---|
| `/eiere` | — (ikke deployet) | Radar + Puls + Godkjenningskoe + **ferskhet-markør** |
| `/i-dag` | MOCK hvis token feiler | Ekte tall eller tydelig feil |
| `/kundeservice` | MOCK hvis token feiler | Ekte uleste eller tydelig feil |
| `/innhold` | Statisk | Ekte state (PR #8) |
| `/butikk` | Statisk | Fortsatt statisk (hardkodet — neste runde) |

## Hva som KAN gjøres i neste runde (ikke kritisk nå)
- `/butikk` + `/innhold` helt ekte (hardkodede arrays → Supabase)
- «Klikk → handling»: godkjenn/avvis direkte fra Godkjenningskoe (QueueActions finnes — verifiser at de virker mot requests-tabellen)
- Live Gmail-kundeservice-triagen (Indigo-jobben → kontakt@)
