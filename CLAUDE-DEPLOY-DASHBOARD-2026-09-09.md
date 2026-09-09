# CLAUDE CODE — Deploy Detox OS Dashboard til Vercel (2026-09-09)

**Fra:** Orion (hub-en) · **Til:** Claude Code på Mac Studio
**Repo:** `/root/detox-os-dashboard` (eller der du har klonet `indigoYubari/detox-os-dashboard`)
**Branch:** `main` @ `9426fda` — ALT KODE-ARBEID ER GJORT. Du skal bare deploye.

---

## Lim inn i Claude Code:

```
Du skal deploye detox-os-dashboard til Vercel. Alt kode-arbeid er ferdig og pushet
(main @ 9426fda — MOCK-fallback fjernet, /eiere-side med ferskhets-markør, innhold-state).
Din jobb er utelukkende: koble Vercel-prosjektet, sett env-variabler, deploy, verifiser.

## Steg 0 — Bekreft koden (2 min)
1. cd /root/detox-os-dashboard && git fetch origin && git checkout main && git pull --ff-only
2. git log --oneline -3 → skal vise 9426fda (ferskhets-markor) som nyeste.
3. npm test → skal være grønt (131+ tester). Kjør kun hvis du tviler.

## Steg 1 — Vercel-kobling
1. `vercel login` (interaktiv, Adrians konto — os.detox.no-prosjektet eies der)
   Hvis CLI ber om token: https://vercel.com/account/tokens → opprett, lim inn.
2. `vercel link` → velg eksisterende prosjekt «detox-os-dashboard» (eller det prosjektet
   som allerede server os.detox.no). Hvis ingen finnes: `vercel` (nytt prosjekt, navn
   detox-os-dashboard, framework: Next.js, root: .).

## Steg 2 — Sett env-variabler (KRITISK — dette avgjør om det viser ekte tall)
Sett i Vercel-dashboard (Project → Settings → Environment Variables) ELLER:
`vercel env add <NAVN> production`

Disse finnes allerede i Vercel hvis prosjektet er det gamle (sjekk først!):
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- SHOPIFY_ADMIN_TOKEN, SHOPIFY_SHOP_DOMAIN
- KLAVIYO_API_KEY, KLAVIYO_PLACED_ORDER_METRIC_ID
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_REFRESH_TOKEN_KONTAKT
- DETOX_BACKEND_URL, DETOX_DASHBOARD_USER, DETOX_DASHBOARD_PASS
- NEXT_PUBLIC_DETOX_TELEGRAM_BOT
- KIM_GPT_* / ANNIKEN_GPT_* (supabase-email/password + credential-sha)

Hvis de IKKE finnes: verdiene ligger på Kims Mac (.env i repoet hennes) og/eller i
/root/.env.secrets på hub-en (be Adrian om å lime inn det som mangler — IKKE finn på verdier).

VIKTIG: MOCK-fallback er nå fjernet. Uten gyldige nøkler viser /i-dag og /kundeservice
TYKDELIG FEIL i stedet for frosne tall. Det er riktig oppførsel — men sørg for at alle
nøkler er satt så sidene viser EKTE data.

## Steg 3 — Deploy
1. `vercel build --prod` (lokal produksjonsbuild som sjekk)
2. `vercel deploy --prod` (eller `vercel --prod` etter link)
3. Noter deploy-URL-en (os.detox.no eller *.vercel.app).

## Steg 4 — Verifiser (viktigst)
1. Åpne /eiere på produksjon → skal vise:
   - Briefing med Content Radar (siste periode 09.09) + funn
   - Ferskhets-badge: «Fersk» (grønn) hvis rapporten er <24t gammel
   - Puls-band + Godkjenningskoe (kan være tom — ok)
2. Åpne /i-dag → skal vise EKTE ordrer/omsetning (IKKE 7 ordrer/8420 kr mock-tall).
   Hvis feil: viser rød feilmelding med hvilken kilde som feiler → rapporter nøyaktig.
3. Åpne /kundeservice → ekte uleste-antall (ikke «8» fast).
4. Sjekk at ingen secrets lekker (NEXT_PUBLIC_* er ment å være public; SHOPIFY/KLAVIYO/
   GOOGLE/REFRESH må ALDRI dukke opp i client-bundelen — sjekk nettverksfanen).

## Rapport tilbake
- Deploy-URL, Vercel-prosjekt-navn
- Verifiseringsresultat for /eiere, /i-dag, /kundeservice (ekte tall eller nøyaktig feil)
- Hvilke env-variabler som manglet og ble lagt til
- Hva Adrian må gjøre videre (hvis noe)

## HARD STOPS
- Aldri hardkod data. Aldri sett dummy-nøkler. Aldri committ .env.
- Aldri endre kode uten å si fra (dette er deploy-only).
- Hvis Vercel-login ikke lar seg gjøre (mangler konto/tilgang): stopp og si fra — ikke omgå.
```

---

## Bakgrunn for deg (Claude Code)

- **MOCK-fallbacken er fjernet** (`source-state.ts`): tidligere returnerte API-rutene
  hardkodede tall (7 ordrer/8420 kr, 41% open, 8 uleste) med status 200 ved enhver feil —
  Kim så «stabile» tall som faktisk var falske. Nå vises ekte feil.
- **/eiere-siden** (Radar for eiere) er bygget: PulsBand + BriefingBand (Content Radar-funn)
  + Godkjenningskoe (QueueActions + RequestButtons) + ferskhets-badge (Fersk/<24t/STALE).
- **Migrasjon 0008 er kjørt** — authenticated har SELECT på reports/findings/requests,
  så /eiere fungerer med innlogget eier-session.
- Data flyter inn daglig: Anakin Content Radar (09.08 20:37) + Indigo natt-jobber.
