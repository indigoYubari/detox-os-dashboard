import Link from "next/link"

import { fetchAnnonseRaad } from "@/lib/raad-server"

import { Detaljer } from "../Detaljer"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "../Seksjon"
import { raadTopp, varighet, type Raad } from "../dagens"
import { AnnonserDykk } from "./AnnonserDykk"
import { DAGER } from "./annonser"

// «Annonsene» — dypdykket i betalt media, i den nye flaten. To kilder som kan
// feile hver for seg: tallene (ad-agenten via /api/detox, lest i klienten) og
// raadene (basen, recommendations fra agent-ads, lest her med eierens
// session). Kun lesing paa denne siden: ja/nei paa raad skjer i koeen
// (/koe, annonse-raad), aldri her. Ingen mock.

export const dynamic = "force-dynamic"

/** Alle ventende raad, ikke bare forsidens tre. */
const RAAD_ALLE = 60

async function lesRaad(): Promise<{ raad: Raad[]; feil: string | null }> {
  try {
    const res = await fetchAnnonseRaad()
    if (!res.ok) return { raad: [], feil: res.error }
    return { raad: raadTopp(res.rows, RAAD_ALLE), feil: null }
  } catch (e) {
    return { raad: [], feil: e instanceof Error && e.message ? e.message : "Klarte ikke lese fra basen." }
  }
}

export default async function AnnonseneSide() {
  const naa = new Date()
  const { raad, feil } = await lesRaad()
  const alvorlige = raad.filter((r) => r.alvor !== "info")

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">Annonsene, siste {DAGER} dager.</h1>
        <p className="ny-hjelp">
          Google og Meta slik ad-agenten leser dem, og rådene annonsemotoren har lagt i basen. Et ja
          eller nei på et råd gis i køen, ikke her.
        </p>
      </div>

      <AnnonserDykk />

      <Seksjon merkelapp="Rådene">
        {feil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest rådene.</span> {feil}
          </Stille>
        ) : raad.length === 0 ? (
          <Svar>Ingen råd venter</Svar>
        ) : (
          <>
            <Svar>
              {alvorlige.length > 0 ? (
                <>
                  <span className="varsel">
                    {alvorlige.length} {alvorlige.length === 1 ? "råd krever" : "råd krever"} et svar
                  </span>{" "}
                  av <strong>{raad.length}</strong>
                </>
              ) : (
                <>
                  <strong>{raad.length}</strong> {raad.length === 1 ? "råd venter" : "råd venter"}
                </>
              )}
            </Svar>
            <Hjelp>
              Nyeste for {varighet(raad[0].created_at, naa)} siden. Alvorligst først. Rådene bor i
              basen, tallene over hos ad-agenten; de kan feile hver for seg.
            </Hjelp>
            <Detaljer tekst="Se rådene">
              <Liste>
                {raad.map((r) => (
                  <Linje key={r.id} n={r.kanal}>
                    {r.alvor === "info" ? r.tittel : <b>{r.tittel}</b>}
                    {r.alvor === "critical" ? <span className="varsel"> · kritisk</span> : ""}
                  </Linje>
                ))}
              </Liste>
            </Detaljer>
            <Knapper>
              <Link className="ny-knapp primaer" href="/koe">
                Svar på rådene i køen
              </Link>
            </Knapper>
          </>
        )}
      </Seksjon>
    </>
  )
}
