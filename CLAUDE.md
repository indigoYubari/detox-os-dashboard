# Detox-dashboard — byggeoppdrag for Claude Code

> **Din rolle:** du er byggeren av Detox-dashboardet i *dette* repoet. Din eneste
> jobb nå er å gjøre den **nye flaten** komplett etter planen under. Bygg, verifisér,
> lever en PR. **Du merger/deployer aldri selv** — det gjør Adrian etter godkjenning.

---

## Steg 0 — FØR du rører noe: les «Mind Matter-måten» (obligatorisk)

Du skal jobbe *slik Mind Matter jobber*. Hent og les dette FØR du bygger noe:

1. **Hvordan agenter arbeider hos Mind Matter:**
   `https://github.com/MindMatter1444/mindmatter-brain/blob/main/AGENTS.md`
2. **Merkevare/produkt/sannhetskilde (MMOS)** — samme repo, mappen `MMOS/`:
   les minst `00-foundation/` og `02-brand/` (f.eks.
   `.../mindmatter-brain/blob/main/MMOS/00-foundation/...`).

Først når du har lest begge, går du videre til oppgaven. Hvis du ikke kan hente
dem, si det tydelig i stedet for å gå videre uten.

---

## ⛔ BYGG PÅ DEN NYE FLATEN — ALDRI PÅ DEN GAMLE

- **Byggemålet er `src/app/(ny)/` — DEN NYE FLATEN. BARE DEN.**
- **`src/app/(main)/` (den gamle) er avviklet.** Den er kun en referanse du kan
  lese datakilder/konsept fra — **aldri** et byggemål, **aldri** noe du «fikser»,
  **aldri** noe du gjenoppliver, **aldri** merket «live».
- Alt du lager havner i `(ny)`. Hvis du vil «reparere» eller «fullføre» en side i
  `(main)`, gjør du det FEIL — bygg den i `(ny)` i stedet.
- **Korteste regel: ny = bygge · gammel = les som referanse, ikke rør.**

---

## Faste regler (grunnloven)

- **Aldri mock/seed som live.** Alle sider leser levende data. Statisk/mock
  ryddes FØR noe går live.
- Bruk det nye mønsteret: `Seksjon` → `Svar` (én linje, hook før tall) → `Hjelp`
  (én utfyllende linje) → `Detaljer` (liste bak «Se …») → `Knapper` (handling).
  `Stille` for tom/feil — aldri et falskt nulltall.
- Levende kilder: `koer`/`koe_poster`, `kim_cards`/`v_kim_cards`,
  `notes.type=ide`, `findings`⋈`reports`, Shopify/annonser/Klaviyo via detox-api.
- **Tenant er `kwrj…` (Detox).** Aldri `ifyf…`.
- For hver PR må `tsc`, `lint` og `npm test` gå grønt. Lever en PR; ikke merge/deploy.

---

## Oppgaven: gjør den nye flaten komplett

Retning **A** (Adrians beslutning 24.09): den nye `(ny)`-flaten blir det **ene**
dashboardet. Bygg de rike manglende sidene inn i `(ny)`, null mock, og pensjonér
`(main)` helt. Inventar + rekkefølge (fra Whatson 24.09):

### Port inn i `(ny)` (i rekkefølge)
| # | Side | Hva | Kilde | Merk |
|---|---|---|---|---|
| **1** | `/eiere` (owners) | Eiernes flate: PULS · Plan · Briefing · Svar og samtaler · Kø · Uken — hver med «Åpne» + «Snakk om dette» (skriver kun til `requests`) | requests/RLS, findings | Les `(main)/eiere` som referanse for konsept/kilder — bygg i `(ny)` |
| **2** | `/radar` | Funn-utforsker: 7d/30d + agent/kind-filter, nyeste først | findings⋈reports | Les `(main)/radar` som referanse |
| **3** | `/annonser`-dykk | Kanaler/kampanjer/råd | anbefalinger i base + ad-backend | Gammel er statisk — **bygg live**, ikke port statisk |
| **4** | `/butikk`-dykk | Ordre-/produktdypdykk | Shopify via detox-api + product_pipeline | Samme: bygg live |
| **5** | `/kundeservice`, `/okonomi` | Kun hvis live-koblet; ellers slipp | Raphael-koe / order+Klaviyo+ad | — |

### Kill (portes IKKE — mock/statisk/dekket)
`anmeldelser` · `quiz` · `innhold` (100% statisk) · `claude` · `innstillinger` ·
`roadmap` · `pipelines` · `sops` · `notater` · `klinisk` · `leverandorer` ·
`i-dag` (dekkes av Dagens/Butikk) · `oversikt`/`overview` (dekkes av Lønnsomhet)
· `agenter`/`status` (dekkes av Systemet).

### Viktig om `/eiere`
`/eiere` i `(main)` er allerede live og god (seks bånd, RLS, skriver kun til
`requests`). Ikke la den gå tapt — **port datakildene/konseptet inn i `(ny)/eiere`**
med det nye designspråket. Ikke erstatt den med noe tynnere.

### Allerede på plass i `(ny)` (kompletter, ikke dupliser)
`/kort`, `/kort/<id>`, `/ideer` (PR #39). `(ny)/page.tsx` (Dagens) dekker allerede
Butikk, Lønnsomhet, Annonser+råd, Epost, Kundeservice, Agentkøen, I natt,
Kunnskapen, Systemet.

### Mål
Paritet → **skru av `(main)` helt** (fjern «Gammelt dashbord»-lenken).

---

## Definition of done
- Alt ligger i `src/app/(ny)/` — ingenting i `(main)` endret.
- Ingen mock/statisk presentert som live; tom/feil ser tomt/feil ut.
- `tsc` + `lint` + `npm test` grønne.
- En PR per side (eller en samlet, hvis ryddigere), med klare filendringer.
- Ikke merge/deploy — det er Adrians.

---
*Kilde til dette oppdraget: `FRA-WHATSON-INVENTAR-PLAN-NY-FLATE-2026-09-24.md` i
ICM / claude/inbox. Spørsmål → still dem, ikke gjett.*