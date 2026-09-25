# Skill-spectrum — dette repoets evner (plukk opp når du trenger dem)

Ikke alle deler av repoet er like viktige. Dette er spekteret: hvilke «skills»
(evner/byggeklosser) du kan bruke, og *når*. Bruk den aktive når oppgaven treffer
den; ikke les alt hver gang.

## 1 · Komponentmønsteret for den nye flaten  — «Seksjon»
Filsti: `src/app/(ny)/Seksjon.tsx` (+ `Detaljer.tsx`)
Bruk når du bygger/endrer UI i `(ny)`. Mønsteret er:
`Seksjon` → `Svar` (én linje, hook før tall) → `Hjelp` (én utfyllende linje) →
`Detaljer` (liste bak «Se …») → `Knapper` (handling) · `Stille` for tom/feil.
**Aldri** et falskt nulltall: tom/feil ser tomt/feil ut.

## 2 · Lesedata (live kilder)  — `src/lib/*`
- `detox-api.ts` → `getMetrics`/`getTrend`/`getInventory` (Shopify/annonser) til klientseksjoner.
- `radar.ts` + `radar-server.ts` → funn (`findings`⋈`reports`), `storyOf`, `sinceDate`, `freshnessOf`, `kindLabel`.
- `koer-server.ts` / `koe-poster.ts` / `eier-server.ts` / `kunnskap-server.ts` / `raad-server.ts` / `system-server.ts` → eierkøer, godkjenning, kort, råd, agentstatus.
- `butikk.ts` / `ad-format.ts` → tall-omforming og ROAS-lesing.

## 3 · Godkjenningsflaten  — `src/app/(ny)/koe/`
`koe/actions.ts` + `PostKnapper.tsx`. Eiernes «ja/nei/gjort» for `koe_poster`.
Skriver KUN til `koe_poster`-status — aldri fagtabellene. Bruk når oppgaven
handler om godkjenning/«Sett avgjort».

## 4 · Kort og ideer  — `src/app/(ny)/kort/` + `ideer/`
Kort (`kes kort` i `(ny)`: `/kort`, `/kort/<id>`, `/ideer`) — les `kim_cards`/
`notes.type=ide`. «Ta i bruk» i stedet for «aktiver». Bruk når oppgaven handler
om Kims kort eller idébanken.

## 5 · Logikk-hjelpere  — `src/app/(ny)/dagens.ts`
Formatering og regler uten React: `kr`, `tall`, `varighet`, `timerSiden`, `klipp`,
`nattensFunn`, `lede`, `raadTopp`, `kortStatus`, `systemStatus`. Testes i
`src/app/(ny)/__tests__/dagens.test.ts`.

## 6 · Skriptverktøy  — `scripts/`
`sync-kim-cards.py` (kort-sync fra vault), `sok-natt.py` + `sok-seed` (søk-natt),
`sync-content-from-vault.mjs`, `seed.mjs`, `google-oauth.mjs`. Bruk når oppgaven
gjelder import/seed/søk — aldri seed som «live»-bevis.

## 7 · Verifikasjon  — alltid før du leverer
- `npm test` (vitest) · `npx tsc --noEmit` · `npm run lint` · `npm run build`
- Regresjonstesten som vokter mot mock: `src/lib/__tests__/ingen-oppdiktede-tall.test.ts`.

## 8 · Sikkerhet  — alltid aktiv
- **`SECURITY.md`** (policy, repo-rot) + **`skills/SECRETS-GUARD.md`** (operativ
  pre-tool-use-guard). Les begge FØR du kaller noe verktøy som leser/logger.
- `src/lib/auth-server.ts` / `auth-policy.ts` / `source-state.ts` (RLS/sesjon/
  mock-vakt). Aldri service_role i frontend. Tenant `kwrj…`, aldri `ifyf…`.

## Hvordan du bruker spekteret
- **Matcher oppgaven en evne?** → les den aktive filen, så bygg.
- **Usikker på kilde/tilstand?** → les den relevante `src/lib/*` før du antar.
- **Berører du schema/migrasjoner?** → `supabase/migrations/` — **ikke** endre
  schema uten Adrians eksplisitte ja.
- **Leverer du?** → kjør verifikasjonen i #7, rydd en PR, IKKE merge/deploy.

*Indeks vedlikeholdt av Whatson (24.09). Hold denne nøyaktig — legg til en evne når
du introduserer en ny byggekloss.*