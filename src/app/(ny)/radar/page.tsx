import Link from "next/link"

import { requiresApproval, stripApprovalMark } from "@/lib/eiere"
import {
  AGENTS,
  agentsFor,
  confidenceLabel,
  freshnessOf,
  kindLabel,
  parseFilters,
  storyOf,
  type AgentId,
  type FindingRow,
  type RadarFilters,
} from "@/lib/radar"
import {
  fetchFindings,
  fetchLatestReportHead,
  FINDINGS_PER_AGENT,
  type FindingsResult,
  type LatestReportResult,
} from "@/lib/radar-server"

import { Hjelp, Knapper, Seksjon, Stille, Svar } from "../Seksjon"
import { varighet } from "../dagens"
import { agentValg, funnLede, nyesteForst, periodeValg, typeValg, type FilterValg } from "./radar"

// «Funnene» (/radar) — funn-utforskeren i den nye flaten. Alt agentene fant
// i natt og de siste dagene: Anakins content-radar (marked) og Indigos
// forskningsfunn (research), rett fra findings ⋈ reports med eierens session.
// Kun lesing. Bestillinger og samtaler skjer paa /anakin. Ingen mock; tomt og
// feil ser tomt og feil ut.

export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

function Filter({ navn, valg }: { navn: string; valg: FilterValg[] }) {
  return (
    <nav className="ny-filter" aria-label={navn}>
      {valg.map((v) => (
        <Link key={v.href + v.tekst} href={v.href} className={v.valgt ? "valgt" : undefined}>
          {v.tekst}
        </Link>
      ))}
    </nav>
  )
}

function Funn({ f, naa }: { f: FindingRow; naa: Date }) {
  const story = storyOf(f.report.report_type)
  const conf = confidenceLabel(f.confidence)
  const godkjenning = requiresApproval(f.claim)
  return (
    <div className="ny-post">
      <div className="ny-post-topp">
        <span className={godkjenning ? "ny-lapp haster" : "ny-lapp"}>{kindLabel(f.kind)}</span>
        {story ? <span>{story}</span> : null}
        <span>for {varighet(f.created_at, naa)} siden</span>
        {conf ? <span>sikkerhet {conf}</span> : null}
        {f.report.requires_review ? <span>ikke gjennomgått</span> : null}
      </div>
      <p className="ny-post-tittel">
        {godkjenning ? <span className="varsel">Krever godkjenning · </span> : null}
        {stripApprovalMark(f.claim)}
      </p>
      {f.evidence ? <p className="ny-post-detalj">{f.evidence}</p> : null}
      {f.source_url ? (
        <p className="ny-post-les">
          <a href={f.source_url} target="_blank" rel="noreferrer">
            Åpne kilden →
          </a>
        </p>
      ) : null}
    </div>
  )
}

function Agenten({
  agentId,
  res,
  siste,
  filters,
  naa,
}: {
  agentId: AgentId
  res: FindingsResult
  siste: LatestReportResult
  filters: RadarFilters
  naa: Date
}) {
  const meta = AGENTS[agentId]
  const merkelapp = meta.label
  if (!res.ok) {
    return (
      <Seksjon merkelapp={merkelapp}>
        <Stille>
          <span className="varsel">Fikk ikke lest funnene.</span> {res.error}
          {res.code === "no_access" ? " Innlogget bruker mangler lesetilgang (migrasjon 0008)." : ""}
        </Stille>
      </Seksjon>
    )
  }
  const rows = nyesteForst(res.rows)
  const fersk = siste.ok ? freshnessOf(siste.report?.created_at ?? null, naa.getTime()) : null
  const sisteLinje = !siste.ok
    ? `Siste rapport kunne ikke leses: ${siste.error}`
    : !siste.report
      ? `${meta.label} har ikke levert noen rapport ennå.`
      : `Siste rapport for ${varighet(siste.report.created_at, naa)} siden.`

  if (rows.length === 0) {
    return (
      <Seksjon merkelapp={merkelapp}>
        <Stille>
          Ingen funn fra {meta.label} i dette vinduet.{" "}
          {fersk && fersk.variant === "error" ? <span className="varsel">{sisteLinje}</span> : sisteLinje}
        </Stille>
      </Seksjon>
    )
  }
  const topp = rows[0]
  return (
    <Seksjon merkelapp={merkelapp}>
      <Svar>
        <strong>{rows.length}</strong> {rows.length === 1 ? "funn" : "funn"}
        {rows.length >= FINDINGS_PER_AGENT ? ` (de ${FINDINGS_PER_AGENT} nyeste)` : ""}
      </Svar>
      <Hjelp>
        Nyeste for {varighet(topp.created_at, naa)} siden.{" "}
        {fersk && fersk.variant === "error" ? (
          <span className="varsel">{sisteLinje}</span>
        ) : (
          sisteLinje
        )}{" "}
        {meta.role === "marked" ? "Markedet, sett fra Anakin." : "Forskningen, sett fra Indigo."}
        {filters.kind ? ` Bare «${kindLabel(filters.kind)}».` : ""}
      </Hjelp>
      {rows.map((f) => (
        <Funn key={f.id} f={f} naa={naa} />
      ))}
    </Seksjon>
  )
}

export default async function FunnSide({ searchParams }: { searchParams?: SearchParams }) {
  const naa = new Date()
  const filters = parseFilters(searchParams)
  const agenter = agentsFor(filters.agent)
  const [funn, sisteAnakin, sisteIndigo] = await Promise.all([
    fetchFindings(filters),
    fetchLatestReportHead("agent-anakinbot"),
    fetchLatestReportHead("agent-indigobot"),
  ])
  const siste: Record<AgentId, LatestReportResult> = {
    "agent-anakinbot": sisteAnakin,
    "agent-indigobot": sisteIndigo,
  }
  const alleRader = agenter.flatMap((a) => (funn[a].ok ? funn[a].rows : []))
  const feil = agenter.some((a) => !funn[a].ok)

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">{feil ? "Funnene" : funnLede(alleRader.length, filters)}</h1>
        <p className="ny-hjelp">
          Det agentene fant, nyeste først. Vil du ha noe gjort med et funn, gjør du det på Anakin-siden.
        </p>
        <Filter navn="Periode" valg={periodeValg(filters)} />
        <Filter navn="Agent" valg={agentValg(filters)} />
        <Filter navn="Type" valg={typeValg(filters, alleRader)} />
      </div>

      {agenter.map((a) => (
        <Agenten key={a} agentId={a} res={funn[a]} siste={siste[a]} filters={filters} naa={naa} />
      ))}

      <Seksjon merkelapp="Gjøre noe">
        <Svar>Funnene bestilles fra Anakin-siden</Svar>
        <Hjelp>Der ligger de viktigste funnene med «Forklar dette funnet» og «Snakk om dette».</Hjelp>
        <Knapper>
          <Link className="ny-knapp" href="/eiere">
            Gå til Anakin
          </Link>
        </Knapper>
      </Seksjon>
    </>
  )
}
