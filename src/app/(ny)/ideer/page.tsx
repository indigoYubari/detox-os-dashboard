import Link from "next/link"

import { ideDeler, lysAv, lysTekst, merkeAv, temaAv, type IdeRad } from "@/lib/kort"
import { fetchIdeer } from "@/lib/kort-server"

import { Hjelp, Knapper, Seksjon, Stille, Svar } from "../Seksjon"
import { varighet } from "../dagens"
import { Bestill } from "../kort/Bestill"

// «Idéene». Indigos idékort (notes, type=ide) med claims-lys, vinkel og
// Notion-lenke. Fra hver idé kan eieren be Anakin lage utkast — én knapp.
// Lyset er forklart med ord, ikke bare en farge.

export const dynamic = "force-dynamic"

function Ide({ r, naa }: { r: IdeRad; naa: Date }) {
  const d = ideDeler(r.excerpt)
  const lys = lysAv(r.tags)
  const merke = merkeAv(r.tags)
  const tema = temaAv(r.tags)
  return (
    <div className="ny-post">
      <div className="ny-post-topp">
        {merke ? <span className="ny-lapp">{merke}</span> : null}
        {tema ? <span className="ny-lapp">{tema}</span> : null}
        <span>kom {r.updated ? `for ${varighet(r.updated, naa)} siden` : ""}</span>
      </div>
      <p className="ny-post-tittel">{r.title}</p>
      {d.setning ? <p className="ny-post-detalj">{d.setning}</p> : null}
      <p className={lys === "rod" ? "ny-lys rod" : lys === "gul" ? "ny-lys gul" : "ny-lys"}>
        {lysTekst(lys)}
        {d.claims ? ` · ${d.claims}` : ""}
      </p>
      {d.rode.length > 0 ? (
        <ul className="ny-punkter aldri">
          {d.rode.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : null}
      <div className="ny-knapper">
        <Bestill slag="ide" id={r.id} />
        {d.notion ? (
          <a className="ny-knapp" href={d.notion} target="_blank" rel="noreferrer">
            Åpne i Notion
          </a>
        ) : null}
      </div>
    </div>
  )
}

export default async function IdeerSide() {
  const naa = new Date()
  const res = await fetchIdeer()
  const rows = res.ok ? res.rows : []

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">
          {!res.ok
            ? "Idéene"
            : rows.length === 0
              ? "Ingen idéer fra Indigo ennå."
              : `${rows.length} ${rows.length === 1 ? "idé" : "idéer"} fra Indigo.`}
        </h1>
        <p className="ny-hjelp">
          En idé er én vinkel med claims-lys. Grønt kan brukes som det står, gult må omformuleres,
          rødt har noe vi ikke kan si. Be Anakin lage utkast, eller åpne idéen i Notion.
        </p>
      </div>

      {!res.ok ? (
        <Seksjon merkelapp="Idéene">
          <Stille>
            <span className="varsel">Fikk ikke lest idéene.</span> {res.error}
          </Stille>
        </Seksjon>
      ) : rows.length === 0 ? (
        <Seksjon merkelapp="Idéene">
          <Svar>Ingenting her ennå</Svar>
          <Hjelp>Indigo legger idéer her når Kim ber om en vinkel i Telegram.</Hjelp>
          <Knapper>
            <Link className="ny-knapp" href="/kort">
              Se kortene i stedet
            </Link>
          </Knapper>
        </Seksjon>
      ) : (
        <Seksjon merkelapp="Idéene">
          <Svar>
            <strong>{rows.length}</strong> {rows.length === 1 ? "idé" : "idéer"} å velge fra
          </Svar>
          {rows.map((r) => (
            <Ide key={r.id} r={r} naa={naa} />
          ))}
        </Seksjon>
      )}
    </>
  )
}
