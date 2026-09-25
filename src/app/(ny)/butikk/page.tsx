import Link from "next/link"

import { IKKE_KOBLET } from "@/lib/butikk"

import { Hjelp, Seksjon, Stille, Svar } from "../Seksjon"
import { ButikkDykk } from "./ButikkDykk"
import { DAGER } from "./butikk"

// «Butikken» — dypdykket i Shopify, i den nye flaten. Tallene hentes i
// klienten (ButikkDykk) fra ad-agenten via /api/detox, slik forsiden gjoer.
// Det som fortsatt ikke har en kilde staar her som stille linjer, aldri som
// et nulltall. Ingen mock.

export const dynamic = "force-dynamic"

export default function ButikkenSide() {
  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">Butikken, siste {DAGER} dager.</h1>
        <p className="ny-hjelp">
          Shopify-tallene slik ad-agenten synker dem hver natt: til og med i går, dagens tall finnes
          ikke før i morgen. Alle ordrestatuser er med i bruttotallet; netto står for seg.
        </p>
      </div>

      <ButikkDykk />

      <Seksjon merkelapp="Ikke koblet til">
        <Svar>Tre ting mangler fortsatt en kilde</Svar>
        <Hjelp>De står her så ingen tror tallet er null.</Hjelp>
        {IKKE_KOBLET.map((k) => (
          <Stille key={k.navn}>
            <b>{k.navn}:</b> {k.status}{" "}
            {k.krever === "beslutning" ? "Krever en beslutning." : "Krever bygging."}
          </Stille>
        ))}
      </Seksjon>
    </>
  )
}
