# Plan — virkelighetsbevis og køen som avgjørelsesflate

Én autoritativ plan (Detox OS Foundation 007, «Én autoritativ plan»), for de to
veiene Adrian valgte 25.09 etter gjennomgangen av bygget. Lav risiko: kun
lesing, tester og tekst; ingen skjema, ingen nye skrivestier.

## Forankring

- 007 Byggemodell, steg 6 «Verifisere mot virkeligheten» og «Den røde stien må
  også virke»: grønn CI er ikke det samme som at Kim ser riktige tall.
- 007 steg 8 «Lære fra faktisk bruk»: basen viser at avgjørelsesløkken lekker
  (25 annonse-råd utgått ubesvart, 8 kort ventet siden 17.09, en kø uten navn).
- 005 prinsipp 7 «Usikkerhet skal være synlig»: siden skal si når noe utgår,
  hvor lenge det har ventet, og om huben faktisk utførte det eierne sa ja til.
- 010 «Kodeagenter og Claude Code»: test ønsket flyt og feil-/misbruksflyt,
  aldri hemmeligheter i kode, logg eller rapport.

## Del 1 — Virkelighetsbevis (PR: røyktest)

**Hva:** `e2e/roeyktest.spec.ts` (Playwright) mot en bygget server.
Rød sti uten innlogging: hver side → `/login`, API → 401 JSON. Grønn sti med
testbruker: logg inn, åpne hver side, krev overskrift, ingen «Fikk ikke lest»,
ingen JS-feil, ett skjermbilde per side. Testen skriver aldri.

**CI:** ny jobb `roeyktest` etter byggejobben. Kjører rød sti alltid. Grønn sti
bare når hemmelighetene `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`DETOX_SMOKE_EMAIL` og `DETOX_SMOKE_PASSWORD` finnes i repoet. Skjermbildene
lastes opp som artefakt.

**Adrian må:** opprette én testbruker i Supabase Auth (kwrj) **uten**
`detox_role` (da får den bare `detox:read` og kan ikke skrive), og legge de fire
hemmelighetene inn under GitHub → Settings → Secrets. Ingen av verdiene skal i
chat, commit eller logg.

**Akseptanse:** rød sti grønn i CI uten hemmeligheter. Grønn sti grønn i CI med
hemmeligheter, og skjermbildene viser sidene med ekte tall.

**Stopp:** hvis grønn sti finner «Fikk ikke lest» eller JS-feil, er det en feil i
dashbordet eller en grant som mangler; da stopper vi og fikser før noe annet.

## Del 2 — Køen som avgjørelsesflate (PR: koen)

**Hva, kun lesing og tekst i `/koe` og `src/lib/koe-poster*.ts`:**

1. Køen `produkt-kandidater` får navn og forklaring. Basen sier: kilde
   `demandscan`, eier Anniken, prioritet 1, titler som «Guide: tudca — 112 funn»,
   og et ja utføres av `demandscan-draft`. Navn: «Guider som venter på ja».
   Hjelpelinje: hva et ja gjør, lest fra `utfort_av`, ikke antatt.
2. Alder synlig på hver post: «har ventet 8 dager», varsel når over 7 dager.
3. Annonse-råd: hjelpelinje om at rådene byttes ut hver natt (post_ads_report:
   ventende poster utenfor toppen settes til `utgatt`), og hvor mange som
   utgikk ubesvart siste 7 dager.
4. Ny seksjon «Avgjort»: de siste avgjørelsene med kvittering fra huben
   («du sa ja for 3 dager siden, utført av demandscan-draft dagen etter»), og
   varsel på det som er avgjort men ikke utført etter 24 timer.

**Ikke i denne PR-en:** utløpsdato per post (basen har ingen slik kolonne, og
vi lager ikke en), poster for stemme-utkast/kundeservice (hub-jobb i
mindmatter-brain), endringer i hva et ja gjør.

**Akseptanse:** tester på reglene (alder, utgått-telling, kvitteringstekst,
navn på alle fem køene); render-test av `/koe`; `tsc`/`lint`/`vitest`/`build`
grønne; ingen skjemaendring.

**Stopp:** hvis en kø trenger en regel basen ikke bærer (utløp, hvem som
utfører), sier siden «ukjent» og vi spør, i stedet for å anta.

## Rekkefølge

Del 1 først (den beviser del 2 når den er inne), så del 2. Én PR hver. Merge og
deploy er Adrians.
