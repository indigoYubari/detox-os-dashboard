import Link from "next/link"

import { fetchQueue } from "@/lib/eiere-server"
import { DEFAULT_FILTERS, type FindingRow } from "@/lib/radar"
import { fetchFindings } from "@/lib/radar-server"

import { ButikkISeg } from "./ButikkISeg"
import { Detaljer } from "./Detaljer"
import { KundeserviceISeg } from "./KundeserviceISeg"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import { datoLang, koen, lede, nattensFunn, varighet, type Koen, type NattensFunn } from "./dagens"

// Server-komponent. To av de fire seksjonene leses her (koeen og natten — de
// ligger i Supabase og leses med eierens egen session), de to andre hentes av
// klient-oyer mot de eksisterende API-rutene (Shopify og Gmail). Formen er den
// samme i alle fire; se Seksjon.tsx.
//
// Ingen mock, ingen fallback: hver seksjon sier selv naar den ikke fikk svar.

const TOM_KOE: Koen = { antall: 0, eldste: null, eldsteAlder: null }
const TOM_NATT: NattensFunn = { funn: [], perAgent: { anakin: 0, indigo: 0 }, siste: null }

/**
 * «/» er forsiden. Den skal aldri svare 500. Mangler en grant, eller svarer
 * basen ikke, skal den ene seksjonen si det paa én linje — ikke hele siden bli
 * en feilskjerm. Derfor fanger vi baade det Supabase returnerer som feil og
 * det som kastes.
 */
function feilTekst(e: unknown): string {
  return e instanceof Error && e.message
    ? e.message
    : "Klarte ikke lese fra basen."
}

async function lesKoe(): Promise<{ koe: Koen; feil: string | null }> {
  try {
    const res = await fetchQueue()
    if (!res.ok) return { koe: TOM_KOE, feil: res.error }
    return { koe: koen(res.rows, new Date()), feil: null }
  } catch (e) {
    return { koe: TOM_KOE, feil: feilTekst(e) }
  }
}

async function lesNatt(): Promise<{ natt: NattensFunn; feil: string | null }> {
  try {
    const res = await fetchFindings(DEFAULT_FILTERS, 60)
    const feil = Object.values(res).find((r) => !r.ok)
    if (feil && !feil.ok) return { natt: TOM_NATT, feil: feil.error }
    const rows: FindingRow[] = Object.values(res).flatMap((r) =>
      r.ok ? r.rows : [],
    )
    return { natt: nattensFunn(rows, new Date()), feil: null }
  } catch (e) {
    return { natt: TOM_NATT, feil: feilTekst(e) }
  }
}

export default async function DagensSide() {
  const naa = new Date()
  const [{ koe, feil: koeFeil }, { natt, feil: nattFeil }] = await Promise.all([
    lesKoe(),
    lesNatt(),
  ])

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">{datoLang(naa)}</div>
        <h1 className="ny-lede">{lede(koe, natt)}</h1>
      </div>

      <ButikkISeg />

      <Seksjon merkelapp="Venter på dere">
        {koeFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest køen.</span> {koeFeil}
          </Stille>
        ) : koe.antall === 0 ? (
          <Svar>Ingenting venter</Svar>
        ) : (
          <>
            <Svar>
              <strong>{koe.antall}</strong> forslag fra agentene
            </Svar>
            <Hjelp>
              {koe.eldsteAlder
                ? `Eldste har ventet ${koe.eldsteAlder}. `
                : ""}
              Alt er skrevet, ingenting er sendt.
            </Hjelp>
            <Knapper>
              <Link className="ny-knapp primaer" href="/eiere">
                Gå gjennom køen
              </Link>
            </Knapper>
          </>
        )}
      </Seksjon>

      <Seksjon merkelapp="I natt">
        {nattFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest natten.</span> {nattFeil}
          </Stille>
        ) : natt.funn.length === 0 ? (
          <Svar>Ingen funn i natt</Svar>
        ) : (
          <>
            <Svar>
              Anakin fant <strong>{natt.perAgent.anakin}</strong> ting, Indigo{" "}
              <strong>{natt.perAgent.indigo}</strong>
            </Svar>
            <Hjelp>
              {natt.siste
                ? `Siste funn kom for ${varighet(natt.siste, naa)} siden.`
                : ""}
            </Hjelp>
            <Detaljer tekst="Se funnene">
              <Liste>
                {natt.funn.slice(0, 5).map((f) => (
                  <Linje
                    key={f.id}
                    n={
                      f.report.agent_id === "agent-anakinbot"
                        ? "anakin"
                        : "indigo"
                    }
                  >
                    {f.claim}
                  </Linje>
                ))}
              </Liste>
            </Detaljer>
            <Knapper>
              <Link className="ny-knapp" href="/radar">
                Åpne radar
              </Link>
            </Knapper>
          </>
        )}
      </Seksjon>

      <KundeserviceISeg />
    </>
  )
}
