# Detox-dashboard — CLAUDE.md for Claude Code

> **Din rolle:** du er byggeren av Detox-dashboardet i *dette* repoet. Bygg,
> verifisér, lever en PR. **Du merger/deployer ikke selv** uten at Adrian sier det
> eksplisitt i chatten.

---

## Steg 0 — les «Mind Matter-måten» først (obligatorisk)

1. `https://github.com/MindMatter1444/mindmatter-brain/blob/main/AGENTS.md`
2. MMOS i samme repo: minst `MMOS/00-foundation/` (001, 002, 005; 010 for agenter)
   og `MMOS/02-brand/` (003 voice, 004 language).

Kan du ikke hente dem, si det tydelig i stedet for å gå videre uten.

## Steg 1 — les dette repoet

- `SECURITY.md` + `skills/SECRETS-GUARD.md` FØR du kaller verktøy som leser/logger.
- `skills/SKILL-SPECTRUM.md`: hvilke evner repoet har, og når du bruker hver.
- `CHANGELOG.md` for hva som sist skjedde.

---

## Tilstanden (oppdatert 2026-09-25)

**Det er én flate: `src/app/(ny)/`.** Den gamle `(main)`-flaten er pensjonert og
slettet 25.09 (Retning A, Adrian 24.09; ja til hele slettingen 25.09). Det finnes
ingen «gammel side» å lese som referanse lenger; kildene og reglene ligger i
`src/lib/*` og i sidene selv.

| Sti | Side | Kilde | Skriver |
|---|---|---|---|
| `/` | Dagens | koer, requests, findings⋈reports, recommendations (agent-ads), kim_cards, notes, run_state; Shopify/annonser/Klaviyo via detox-api | ingenting |
| `/koe` | Venter på deg | koe_poster, koer | kun `koe_poster`-status |
| `/kort`, `/kort/[id]`, `/ideer` | Kortene, Idéer | kim_cards, notes.type=ide | `koe_poster`-status, `requests` |
| `/eiere` | Anakin: pulsen, planen, briefingen, samtalene, køen, uken | reports/findings/recommendations, requests, content_items | kun `requests` (`(ny)/eiere/actions.ts`) |
| `/radar` | Funnene | findings⋈reports | ingenting |
| `/butikk` | Butikken | ad-agenten via `/api/detox` (metrics, shopify, inventory) | ingenting |
| `/annonser` | Annonsene | ad-agenten via `/api/detox` + recommendations (agent-ads) | ingenting |

Prioritet i Agentkøen: `priorityOf` i `src/lib/eiere.ts` leser `[prio:…]` fra
body-hodet i `requests`. Basen har ingen `priority`-kolonne (verifisert 25.09).
Legg den aldri i selecten før kolonnen finnes.

---

## Faste regler (grunnloven)

- **Aldri mock/seed som live.** Alle sider leser levende data. Tomt/feil ser
  tomt/feil ut (`Stille`), aldri et falskt nulltall. `ingen-oppdiktede-tall.test.ts`
  vokter dette.
- Mønsteret: `Seksjon` → `Svar` (én linje, hook før tall) → `Hjelp` (én linje) →
  `Detaljer` (liste bak «Se …») → `Knapper` (handling). Rene hjelpere per side
  (`<side>/<side>.ts`) med tester i `src/app/(ny)/__tests__/`.
- Alt leses med eierens egen session (RLS). Aldri service_role i frontend.
- **Tenant er `kwrj…` (Detox).** Aldri `ifyf…`.
- Endre aldri `supabase/migrations/` uten Adrians eksplisitte ja. Rør aldri
  `indigo-pilot` herfra.
- Avslør aldri hemmeligheter, heller ikke anon-nøkkelen, i output, commits, PR-er
  eller chat. Bevis = statuskode/antall/tidsstempel.
- For hver PR: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`
  grønne. Etter sletting/flytting av ruter: `rm -rf .next` før `tsc`, ellers gir
  stale `.next/types` falske feil.
- En PR per oppdrag. Stabler du PR-er, kan den øverste retargetes til `main` så
  ett merge tar alt (gjort 25.09 med #46).

---

## Åpne punkter (25.09)

- Redirects fra gamle stier (`/overview → /`) er ikke lagt inn.
- `/butikk`: refusjoner, konvertering/besøkende og siste ordrer mangler kilde
  (`IKKE_KOBLET` i `src/lib/butikk.ts`); to av dem venter på Adrians beslutning.
- `/kundeservice` og `/okonomi` ble sluppet: kundeservice dekkes av forsiden via
  Raphaels kø, økonomi har ingen live kilde.
- `CLAUDE-DEPLOY-DASHBOARD-2026-09-09.md` er historisk og nevner sider som er borte.

*Spørsmål → still dem, ikke gjett. Øktlogger: `mindmatter-brain/Sessions/`.*
