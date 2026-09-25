# Sekret-guard — pre-tool-use (les FØR du kaller noe)

Dette er den operative garde mot hemmeligheter, for **Claude Code** som kjører på
dette repoet (også fra appen/mobilen). Policy-delen ligger i rot-`SECURITY.md` —
les den også. Denne filen sier *hvordan* du oppfører deg ved verktøybruk.

## Før du kaller et verktøy (pre-tool-use-sjekk)
Kjør denne tankedisponeringen før *hver* kommando som leser/viser/logger noe:

1. **Skriver kommandoen ut en hemmelighet?** Se kritiske kilder:
   `DETOX_ACTIONS_TOKEN` (Indigo-copilot), `GPT_COPILOT_SECRET`,
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`anon`, Shopify-token,
   Klaviyo-token, Google-OAuth, `.env*`-filer. Hvis ja → **ikke** echo/cat dem.
2. **Echo aldri env-variabler eller hele konfigfiler** til stdout, logger, PR-er,
   sess-oppsummeringer eller chat. Rediger ut temaet først.
3. **Commit aldri** `.env`, `.env.local`, `token*`, `*secret*`, `credentials*`,
   service-role-nøkler. Sjekk `git status` før commit; bruk `git ls-files` for å
   bekrefte at ingenting rørt er tracket (repoet skal holde seg tomt for `.env`).
4. **Verktøy som leser eksternt:** hvis en API-klient/mcp/skript feiler med en
   nøkkel, vis feiltypen — aldri nøkkelverdien. Rapportér, ikke avslør.
5. **Bevis i PR/commit:** aldri legg inn token/suspekte verdier selv som «bevis».
   Bruk `***` eller «[redigert]». Live-bevis = statuskode/antall rader/tidsstempel,
   ikke nøkkelverdier.
6. **Vær klar over at du jobber på produksjonsbasen `kwrj…`** — ikke `ifyf…`.
   Feil tenant = aldri skriv.

## Hvis du oppdager en lekkasje
- Ikke fortsett verktøykall som videreformidler den.
- Fjern den fra git-historien/arbeidskatalogen hvis den er din egen.
- Nevn det tydelig til Adrian (kort melding, tydelig tittel) — og rull nøkkelen
  dersom den har vært i en delt logg. Gi aldri villrådige detaljer i en offentlig
  kanal.

## Minimeringsregel
Behandle *alt* i dette repoet som internt/privat. Kundenavn, ordredata, RLS- og
auth-innstillinger er sensitive områder (`SECURITY.md` → «Sensitive areas»).

*Autoritativ policy: `SECURITY.md` (repo-rot). Denne filen er den operative
guard-en Claude Code kjører ved verktøybruk.*