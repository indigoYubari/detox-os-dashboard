import Link from "next/link"

import { kortSti, statusTekst, JA_BETYR } from "@/lib/kort"
import { fetchKort } from "@/lib/kunnskap-server"

import { Hjelp, Knapper, Seksjon, Stille, Svar } from "../Seksjon"
import { kortStatus, varighet, type KortVisning } from "../dagens"

// «Kortene». Alle Indigos kort på ett sted, i vanlig språk: først de som venter
// på et ja fra eieren, så de som er i bruk. Hvert kort kan åpnes og leses i sin
// helhet. Ingenting skrives her — ja/nei skjer på kortets egen side.

export const dynamic = "force-dynamic"

function Rad({ k, naa }: { k: KortVisning; naa: Date }) {
  return (
    <Link href={kortSti(k.id)} className="ny-kortrad">
      <span className="ny-kortrad-story">{k.story}</span>
      <span className="ny-kortrad-tittel">{k.title}</span>
      {k.utdrag ? <span className="ny-kortrad-utdrag">{k.utdrag}</span> : null}
      <span className="ny-kortrad-meta">
        {statusTekst(k.status)} · oppdatert for {varighet(k.updated_at, naa)} siden · Les kortet →
      </span>
    </Link>
  )
}

export default async function KortSide() {
  const naa = new Date()
  const res = await fetchKort()
  const kort = res.ok ? kortStatus(res.rows) : null
  const venter = kort ? kort.kort.filter((k) => k.status === "draft") : []
  const iBruk = kort ? kort.kort.filter((k) => k.status === "active") : []

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">
          {!kort
            ? "Kortene"
            : venter.length === 0
              ? kort.kort.length === 0
                ? "Ingen kort ennå."
                : `Alle ${iBruk.length} kortene er i bruk.`
              : `${venter.length} ${venter.length === 1 ? "kort venter" : "kort venter"} på ja fra deg.`}
        </h1>
        <p className="ny-hjelp">
          Et kort er Indigos oppsummering av én story: hva dette betyr for Detox, hva vi kan si, og
          hva vi aldri sier. Åpne et kort for å lese det og gjøre noe med det.
        </p>
      </div>

      {!res.ok ? (
        <Seksjon merkelapp="Kortene">
          <Stille>
            <span className="varsel">Fikk ikke lest kortene.</span> {res.error}
          </Stille>
        </Seksjon>
      ) : null}

      {kort ? (
        <Seksjon merkelapp="Venter på deg">
          {venter.length === 0 ? (
            <Svar>Ingen kort venter på ja</Svar>
          ) : (
            <>
              <Svar>
                <strong>{venter.length}</strong> {venter.length === 1 ? "kort venter" : "kort venter"} på ja
              </Svar>
              <Hjelp>{JA_BETYR}</Hjelp>
              {venter.map((k) => (
                <Rad key={k.id} k={k} naa={naa} />
              ))}
            </>
          )}
        </Seksjon>
      ) : null}

      {kort ? (
        <Seksjon merkelapp="I bruk">
          {iBruk.length === 0 ? (
            <Stille>Ingen kort er i bruk ennå. DetoxGPT svarer bare fra kort som er i bruk.</Stille>
          ) : (
            <>
              <Svar>
                <strong>{iBruk.length}</strong> {iBruk.length === 1 ? "kort er i bruk" : "kort er i bruk"}
              </Svar>
              <Hjelp>
                DetoxGPT og agentene svarer fra disse.
                {kort.nyeste ? ` Sist synket for ${varighet(kort.nyeste, naa)} siden.` : ""}
              </Hjelp>
              {iBruk.map((k) => (
                <Rad key={k.id} k={k} naa={naa} />
              ))}
            </>
          )}
        </Seksjon>
      ) : null}

      <Seksjon merkelapp="Idéer">
        <Svar>Idéene fra Indigo ligger for seg</Svar>
        <Hjelp>Et kort er kunnskapen. En idé er én konkret vinkel du kan be Anakin lage noe av.</Hjelp>
        <Knapper>
          <Link className="ny-knapp" href="/ideer">
            Se idéene
          </Link>
        </Knapper>
      </Seksjon>
    </>
  )
}
