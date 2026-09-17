import { Detaljer } from "./Detaljer"
import { Linje, Liste } from "./Seksjon"
import type { Raad } from "./dagens"

// Raadene fra annonsemotoren, slik systemet har levert dem (recommendations,
// agent-ads, via post_ads_report.py). Ingen hooks — brukes inne i
// AnnonserISeg, og vises uansett om ad-backenden svarer: raadene bor i basen,
// tallene bor hos ad-backenden. Det er to kilder, og de kan feile hver for seg.

export function RaadBlokk({ raad, feil }: { raad: Raad[]; feil: string | null }) {
  if (feil) {
    return (
      <p className="ny-stille">
        <span className="varsel">Fikk ikke lest rådene.</span> {feil}
      </p>
    )
  }
  if (raad.length === 0) return null
  return (
    <Detaljer tekst={`Se ${raad.length === 1 ? "rådet" : `de ${raad.length} rådene`}`}>
      <Liste>
        {raad.map((r) => (
          <Linje key={r.id} n={r.kanal}>
            {r.alvor === "info" ? r.tittel : <b>{r.tittel}</b>}
          </Linje>
        ))}
      </Liste>
    </Detaljer>
  )
}
