import Link from "next/link"

import {
  eierFilter,
  eierNavn,
  forEier,
  grupper,
  KOE_HJELP,
  KOE_NAVN,
  kvittering,
  lesLenke,
  prioritetTekst,
  UTEN_POSTER,
  venterLenge,
  ventetTekst,
  type EierFilter,
  type KoePost,
} from "@/lib/koe-poster"
import { fetchPoster, POSTER_IKKE_KOBLET, UTGAATT_DAGER } from "@/lib/koe-poster-server"
import { fetchKoer, type Koe } from "@/lib/koer-server"

import { Hjelp, Knapper, Seksjon, Stille, Svar } from "../Seksjon"
import { varighet } from "../dagens"
import { PostKnapper } from "./PostKnapper"

// «Gå gjennom køen». Server-komponent i den nye flaten: leser postene og
// køene med eierens session, viser dem per kø, og lar eieren si ja, nei
// eller gjort. Skriver ingenting selv — se actions.ts. Aldri 500: hver del
// sier selv naar den ikke fikk svar.

export const dynamic = "force-dynamic"

const FILTRE: { verdi: EierFilter; tekst: string }[] = [
  { verdi: "alle", tekst: "Alle" },
  { verdi: "indigo", tekst: "Indigo" },
  { verdi: "anniken", tekst: "Anniken" },
]

function lede(antall: number, filter: EierFilter): string {
  const hvem = filter === "alle" ? "dere" : eierNavn(filter)
  if (antall === 0) return `Ingenting venter på ${hvem}.`
  return `${antall} ${antall === 1 ? "ting venter" : "ting venter"} på ${hvem}.`
}

function Post({ post, naa }: { post: KoePost; naa: Date }) {
  const lapp = prioritetTekst(post.prioritet)
  const lenge = venterLenge(post, naa)
  const ventet = ventetTekst(post, naa)
  return (
    <div className="ny-post">
      <div className="ny-post-topp">
        {lapp ? (
          <span className={post.prioritet <= 0 ? "ny-lapp haster" : "ny-lapp"}>{lapp}</span>
        ) : null}
        <span className="ny-lapp">{eierNavn(post.eier)}</span>
        {lenge && ventet ? (
          <span className="ny-lapp haster">{ventet}</span>
        ) : (
          <span>{ventet ?? `kom for ${varighet(post.opprettet, naa)} siden`}</span>
        )}
      </div>
      <p className="ny-post-tittel">{post.tittel}</p>
      {post.detalj ? <p className="ny-post-detalj">{post.detalj}</p> : null}
      {lesLenke(post) ? (
        <p className="ny-post-les">
          <Link href={lesLenke(post) ?? "#"}>Les hele kortet før du svarer →</Link>
        </p>
      ) : null}
      <PostKnapper post={post} />
    </div>
  )
}

export default async function KoeSide({
  searchParams,
}: {
  searchParams?: { eier?: string }
}) {
  const naa = new Date()
  const filter = eierFilter(searchParams?.eier)
  const [poster, koer] = await Promise.all([fetchPoster(naa), fetchKoer()])

  const venter = poster.ok ? forEier(poster.venter, filter) : []
  const grupper_ = grupper(venter)
  // «Uten poster» maales mot ALLE ventende poster, ikke de filtrerte: en koe som
  // bare har poster til den andre eieren har poster, den er bare ikke dennes.
  const medPoster = new Set((poster.ok ? poster.venter : []).map((p) => p.koe_id))
  const koerUtenPoster: Koe[] = koer.ok
    ? koer.koer.filter((k) => !medPoster.has(k.id) && k.antall > 0)
    : []
  const ikkeUtfort = poster.ok ? poster.avgjortIkkeUtfort.length : 0
  const lenge = venter.filter((p) => venterLenge(p, naa)).length
  const utgaatt = poster.ok ? poster.utgaatt : {}
  const avgjorte = poster.ok ? [...poster.avgjortIkkeUtfort, ...poster.avgjortUtfort] : []

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">
          {poster.ok ? lede(venter.length, filter) : "Køen"}
        </h1>
        <nav className="ny-filter" aria-label="Eier">
          {FILTRE.map((f) => (
            <Link
              key={f.verdi}
              href={f.verdi === "alle" ? "/koe" : `/koe?eier=${f.verdi}`}
              className={f.verdi === filter ? "valgt" : undefined}
            >
              {f.tekst}
            </Link>
          ))}
        </nav>
        {lenge > 0 ? (
          <p className="ny-hjelp">
            <span className="varsel">
              {lenge} {lenge === 1 ? "har ventet" : "har ventet"} over en uke.
            </span>{" "}
            Det som venter lengst står øverst i sin kø.
          </p>
        ) : null}
        {ikkeUtfort > 0 ? (
          <p className="ny-hjelp">
            {ikkeUtfort} {ikkeUtfort === 1 ? "avgjørelse" : "avgjørelser"} venter
            på at huben utfører dem. Se «Avgjort» nederst.
          </p>
        ) : null}
      </div>

      {!poster.ok ? (
        <Seksjon merkelapp="Postene">
          {poster.code === "ikke_koblet_til" ? (
            <Stille>{POSTER_IKKE_KOBLET}</Stille>
          ) : (
            <Stille>
              <span className="varsel">Fikk ikke lest postene.</span> {poster.error}
            </Stille>
          )}
        </Seksjon>
      ) : null}

      {grupper_.map((g) => (
        <Seksjon key={g.koe_id} merkelapp={g.navn}>
          <Svar>
            <strong>{g.poster.length}</strong>{" "}
            {g.poster.length === 1 ? "venter" : "venter"}
          </Svar>
          {KOE_HJELP[g.koe_id] || utgaatt[g.koe_id] ? (
            <Hjelp>
              {KOE_HJELP[g.koe_id] ?? ""}
              {utgaatt[g.koe_id] ? (
                <>
                  {" "}
                  <span className="varsel">
                    {utgaatt[g.koe_id]} {utgaatt[g.koe_id] === 1 ? "utgikk" : "utgikk"} ubesvart
                    siste {UTGAATT_DAGER} dager.
                  </span>
                </>
              ) : null}
            </Hjelp>
          ) : null}
          {g.poster.map((p) => (
            <Post key={p.id} post={p} naa={naa} />
          ))}
        </Seksjon>
      ))}

      {koerUtenPoster.map((k) => {
        const hvor = UTEN_POSTER[k.id]
        return (
          <Seksjon key={k.id} merkelapp={KOE_NAVN[k.id] ?? k.navn}>
            <Svar>
              <strong>{k.antall}</strong> i køen
            </Svar>
            <Stille>
              {hvor?.tekst ?? "Ingen poster er skrevet for denne køen ennå."}
              {k.detalj ? ` ${k.detalj}` : ""}
            </Stille>
            {hvor?.lenke ? (
              <Knapper>
                <a className="ny-knapp" href={hvor.lenke} target="_blank" rel="noreferrer">
                  {hvor.knapp}
                </a>
              </Knapper>
            ) : null}
          </Seksjon>
        )
      })}

      {poster.ok && grupper_.length === 0 && koerUtenPoster.length === 0 ? (
        <Seksjon merkelapp="Køen">
          <Svar>Ingenting venter</Svar>
        </Seksjon>
      ) : null}

      {poster.ok ? (
        <Seksjon merkelapp="Avgjort">
          {avgjorte.length === 0 ? (
            <Stille>Ingen avgjørelser ennå. Det du sier ja eller nei til, får kvittering her.</Stille>
          ) : (
            <>
              <Svar>
                <strong>{avgjorte.length}</strong>{" "}
                {avgjorte.length === 1 ? "avgjørelse" : "avgjørelser"}
                {ikkeUtfort > 0 ? (
                  <>
                    , <span className="varsel">{ikkeUtfort} ikke utført ennå</span>
                  </>
                ) : null}
              </Svar>
              <Hjelp>
                Hva huben faktisk gjorde med det dere sa. Kvitteringen leses fra basen, ikke antatt.
              </Hjelp>
              {avgjorte.map((p) => {
                const k = kvittering(p, naa)
                return (
                  <div key={p.id} className="ny-post">
                    <div className="ny-post-topp">
                      <span className="ny-lapp">{KOE_NAVN[p.koe_id] ?? p.koe_id}</span>
                      <span className="ny-lapp">{eierNavn(p.eier)}</span>
                      {k.sent ? <span className="ny-lapp haster">ikke utført</span> : null}
                    </div>
                    <p className="ny-post-tittel">{p.tittel}</p>
                    <p className="ny-post-detalj">
                      {k.avgjort} {k.sent ? <span className="varsel">{k.utfort}</span> : k.utfort}
                    </p>
                  </div>
                )
              })}
            </>
          )}
        </Seksjon>
      ) : null}
    </>
  )
}
