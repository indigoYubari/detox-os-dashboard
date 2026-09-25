# CC-oppdrag · `priority` skal leses av dashbordet (kontraktsdrift)

> ⛔ **Dette er en ÅPEN JOBB for Claude Code i dette repoet.** Bygg i
> `src/app/(ny)/`, aldri `(main)` · ingen mock · les `SECURITY.md` +
> `skills/SECRETS-GUARD.md` + `skills/SKILL-SPECTRUM.md` før verktøybruk.
> Autoritativ versjon: `/opt/icm/claude/inbox/FRA-WHATSON-PRIORITY-KONTRAKT-2026-09-25.md`.

## Bakgrunn (verifisert 25.09)
`indigo-pilot/scripts/copilot_request.py` sender `priority` (`low|normal|high`) i
POST /request, men dette repoet (dashbordet) leser den ikke: `RequestRow` i
`src/lib/eiere.ts` mangler `priority` (verken kolonne eller fra `body`). →
informasjonstap. **Beslutning:** `priority` skal **inn** i kontrakten (i tråd med
«hva først»-retningen), ikke fjernes fra skriveren.

## Jobben (kun lesesiden i dette repoet)
1. `src/lib/eiere.ts`: legg `priority` til `REQUEST_ROW_COLUMNS`/`REQUEST_COLUMNS`
   og til `RequestRow`-typen.
   - Er `priority` en kolonne på `requests` i migrasjonene (`supabase/migrations/`)?
     - Ja → les den.
     - Nei → les fra `body`, og lag en tydelig linje om at feltet er i body.
     - **Endre aldri schema uten eksplisitt ja fra Adrian.**
2. Overflaten: la **Agentkøen** prioritere — høy/kritisk først — i `(ny)`-mønsteret
   (Svar/Hjelp/Detaljer/Knapper).
3. **Regresjonstest begge sider:** en test som bekrefter at `priority` fra en rad
   faktisk leses (mønster likt `src/lib/__tests__/ingen-oppdiktede-tall.test.ts`).

## Grenser
- Endre **IKKE** `indigo-pilot` (den er riktig). Kun dette repoet.
- `tsc` + `lint` + `npm test` grønne. Lever en PR. Ikke merge/deploy.

## Definition of done
- `priority` leses og er synlig/prioriterbar i Agentkøen.
- Regresjonstest på plass. PR levert, CI grønn, ikke merget.

— Whatson · 25.09 (cc Orion/Adrian)