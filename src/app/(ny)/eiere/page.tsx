import Link from "next/link"

import { fetchContentItems } from "@/lib/content-server"
import { STAGE_LABELS, STAGE_STATUS_LABELS, type ContentItem } from "@/lib/content"
import {
  activeChatRefs,
  findPuls,
  planOf,
  briefingOf,
  refKey,
  REQUEST_STATUS_LABELS,
  requiresApproval,
  stripApprovalMark,
  telegramHref,
  WEEK_BUCKET_LABELS,
  type RadarFinding,
  type RadarRecommendation,
  type RadarReport,
  type RefTable,
  type RequestRow,
  type Thread,
  type WeekBucket,
} from "@/lib/eiere"
import {
  fetchLatestRadar,
  fetchOperatorKort,
  fetchQueue,
  fetchThreads,
  type OperatorKort,
} from "@/lib/eiere-server"

import { Detaljer } from "../Detaljer"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "../Seksjon"
import { koen, varighet, type Koen } from "../dagens"
import {
  anbefalingTekst,
  planHjelp,
  planSvar,
  pulsHjelp,
  pulsSvar,
  samtaleStatus,
  uken,
  ukenSvar,
} from "./eiere"
import { BeAnakin } from "./BeAnakin"
import { KoeKnapper } from "./KoeKnapper"
import { Samtale } from "./Samtale"
import { Snakk } from "./Snakk"

// «Anakin» (/eiere) — eiernes flate. Seks baand: pulsen, planen,
// briefingen, samtalene, koeen og uken — alle lest med
// eierens egen session (RLS), og alt som skrives gaar til `requests` og
// ingenting annet. Ett svar per seksjon; resten bak «Se …». Tom og feil ser
// tomme og feil ut. Ingen mock.

export const dynamic = "force-dynamic"

type Snakkis = { botHref: string | null; aktive: ReadonlySet<string> }

function SnakkOm({
  s,
  table,
  id,
  period,
}: {
  s: Snakkis
  table: RefTable
  id: string
  period: string | null
}) {
  return (
    <Snakk
      refTable={table}
      refId={id}
      period={period}
      botHref={s.botHref}
      paagaar={s.aktive.has(refKey(table, id))}
    />
  )
}

function Feil({ hva, feil }: { hva: string; feil: string }) {
  return (
    <Stille>
      <span className="varsel">Fikk ikke lest {hva}.</span> {feil}
    </Stille>
  )
}

// ── Pulsen ──────────────────────────────────────────────────────────────────

function Pulsen({ report }: { report: RadarReport }) {
  const res = findPuls(report.findings)
  if (!res.ok && res.reason === "no_signal") {
    return (
      <Seksjon merkelapp="Pulsen">
        <Stille>Radaren for {report.period} har ingen salgspuls.</Stille>
        <Knapper>
          <BeAnakin type="refresh_puls" period={report.period} tekst="Be Anakin oppdatere pulsen" />
        </Knapper>
      </Seksjon>
    )
  }
  if (!res.ok) {
    return (
      <Seksjon merkelapp="Pulsen">
        <Stille>Pulsen finnes, men tallene kunne ikke tolkes. Dette skrev Anakin:</Stille>
        <p className="ny-sitat">{res.raw}</p>
        <Knapper>
          <BeAnakin type="refresh_puls" period={report.period} tekst="Be Anakin oppdatere pulsen" />
        </Knapper>
      </Seksjon>
    )
  }
  const s = pulsSvar(res.puls)
  return (
    <Seksjon merkelapp="Pulsen">
      <Svar>
        <span className={s.ned ? "varsel" : undefined}>{s.hook}:</span> {s.tekst}
      </Svar>
      <Hjelp>{pulsHjelp(res.puls)} Anakins egen Shopify-lesing i radaren {report.period}.</Hjelp>
      <Detaljer tekst="Se Anakins tekst">
        <p className="ny-sitat">{res.raw}</p>
      </Detaljer>
      <Knapper>
        <Link className="ny-knapp" href="/">
          Se lønnsomheten i dag
        </Link>
        <BeAnakin type="refresh_puls" period={report.period} tekst="Be Anakin oppdatere pulsen" />
      </Knapper>
    </Seksjon>
  )
}

// ── Planen ──────────────────────────────────────────────────────────────────

function Anbefaling({
  r,
  n,
  period,
  s,
}: {
  r: RadarRecommendation
  n: string
  period: string
  s: Snakkis
}) {
  return (
    <Linje n={n}>
      {requiresApproval(r.action) ? <span className="varsel">Krever godkjenning · </span> : null}
      {anbefalingTekst(r, 400)}
      <span className="ny-linje-knapper">
        <BeAnakin type="do_recommendation" refId={r.id} period={period} tekst="Be Anakin gjøre dette" />
        <SnakkOm s={s} table="recommendations" id={r.id} period={period} />
      </span>
    </Linje>
  )
}

function Planen({ report, s }: { report: RadarReport; s: Snakkis }) {
  const plan = planOf(report)
  const sv = planSvar(plan)
  if (!sv.neste) {
    return (
      <Seksjon merkelapp="Planen">
        <Svar>Ingen anbefalinger venter</Svar>
        <Hjelp>
          Radaren {report.period} har {sv.avgjort === 0 ? "ingen anbefalinger" : `${sv.avgjort} avgjorte`}.
        </Hjelp>
      </Seksjon>
    )
  }
  return (
    <Seksjon merkelapp="Planen">
      <Svar>
        Neste trekk: <strong className="ny-svar-tekst">{sv.neste}</strong>
      </Svar>
      <Hjelp>{planHjelp(plan)}</Hjelp>
      <Detaljer tekst="Se planen">
        <Liste>
          {plan.neste.map((r, i) => (
            <Anbefaling key={r.id} r={r} n={`${i + 1}`} period={report.period} s={s} />
          ))}
          {plan.sporA.map((r) => (
            <Anbefaling key={r.id} r={r} n="spor A" period={report.period} s={s} />
          ))}
          {plan.sporB.map((r) => (
            <Anbefaling key={r.id} r={r} n="spor B" period={report.period} s={s} />
          ))}
          {plan.utenSpor.map((r) => (
            <Anbefaling key={r.id} r={r} n="" period={report.period} s={s} />
          ))}
        </Liste>
      </Detaljer>
    </Seksjon>
  )
}

// ── Briefingen ──────────────────────────────────────────────────────────────

function Funn({ f, period, s }: { f: RadarFinding; period: string; s: Snakkis }) {
  return (
    <Linje n={f.kind}>
      {requiresApproval(f.claim) ? <span className="varsel">Krever godkjenning · </span> : null}
      <b>{stripApprovalMark(f.claim)}</b>
      {f.evidence ? <span className="ny-evidens">{f.evidence}</span> : null}
      {f.source_url ? (
        <a className="ny-kilde" href={f.source_url} target="_blank" rel="noreferrer">
          Åpne kilden
        </a>
      ) : null}
      <span className="ny-linje-knapper">
        <BeAnakin type="explain_finding" refId={f.id} period={period} tekst="Forklar dette funnet" />
        <SnakkOm s={s} table="findings" id={f.id} period={period} />
      </span>
    </Linje>
  )
}

function Briefingen({
  report,
  kort,
  s,
  naa,
}: {
  report: RadarReport
  kort: { ok: true; kort: OperatorKort | null } | { ok: false; error: string }
  s: Snakkis
  naa: Date
}) {
  const b = briefingOf(report)
  const topp = b.funn[0]
  return (
    <Seksjon merkelapp="Briefingen">
      {topp ? (
        <Svar>
          <strong className="ny-svar-tekst">{stripApprovalMark(topp.claim)}</strong>
        </Svar>
      ) : (
        <Stille>Ingen funn i radaren {report.period}, pulsen unntatt.</Stille>
      )}
      <Hjelp>
        Content Radar {report.period}, kom for {varighet(report.created_at, naa)} siden.{" "}
        {report.findings.length} funn, {report.recommendations.length} anbefalinger.
        {report.requires_review ? " Ikke gjennomgått av et menneske ennå." : ""}
      </Hjelp>
      {b.funn.length > 0 ? (
        <Detaljer tekst="Se de viktigste funnene">
          <Liste>
            {b.funn.map((f) => (
              <Funn key={f.id} f={f} period={report.period} s={s} />
            ))}
          </Liste>
        </Detaljer>
      ) : null}
      {!kort.ok ? (
        <Stille>
          <span className="varsel">Fikk ikke lest hele radaren.</span> {kort.error}
        </Stille>
      ) : kort.kort ? (
        <Detaljer tekst="Les hele Content Radar">
          <p className="ny-sitat lang">{kort.kort.text}</p>
        </Detaljer>
      ) : null}
      <Knapper>
        <BeAnakin type="generate_week" period={report.period} tekst="Be Anakin: neste ukes innhold" primaer />
        <BeAnakin type="draft_email" period={report.period} tekst="Be Anakin: e-postutkast" />
        <BeAnakin type="find_idea" period={report.period} tekst="Be Anakin: finn neste idé" />
      </Knapper>
    </Seksjon>
  )
}

// ── Samtalene ───────────────────────────────────────────────────────────────

function Samtalene({
  threads,
  botHref,
}: {
  threads: { ok: true; threads: Thread[] } | { ok: false; error: string }
  botHref: string | null
}) {
  if (!threads.ok) {
    return (
      <Seksjon merkelapp="Samtalene">
        <Feil hva="samtalene" feil={threads.error} />
      </Seksjon>
    )
  }
  const st = samtaleStatus(threads.threads)
  if (st.totalt === 0) {
    return (
      <Seksjon merkelapp="Samtalene">
        <Svar>Ingen svar fra Anakin ennå</Svar>
        <Hjelp>Når hun svarer på en bestilling eller en samtale, kommer det hit.</Hjelp>
      </Seksjon>
    )
  }
  return (
    <Seksjon merkelapp="Samtalene">
      <Svar>
        <strong>{st.totalt}</strong> {st.totalt === 1 ? "samtale" : "samtaler"}
        {st.paagaar > 0 ? (
          <>
            , <span className="varsel">{st.paagaar} pågår</span>
          </>
        ) : null}
      </Svar>
      <Hjelp>{st.siste ? `Sist fra Anakin: «${st.siste.tekst}»` : "Anakin har ikke svart i noen av dem ennå."}</Hjelp>
      {threads.threads.map((t) => (
        <Samtale key={t.key} threadKey={t.key} initial={t.messages} botHref={botHref} />
      ))}
    </Seksjon>
  )
}

// ── Køen ────────────────────────────────────────────────────────────────────

function Koeen({
  koe,
  rader,
  feil,
  botHref,
  naa,
}: {
  koe: Koen
  /** Radene bak oppdragene, for knappene (status-skriving trenger hele raden). */
  rader: ReadonlyMap<string, RequestRow>
  feil: string | null
  botHref: string | null
  naa: Date
}) {
  if (feil) {
    return (
      <Seksjon merkelapp="Køen">
        <Feil hva="køen" feil={feil} />
      </Seksjon>
    )
  }
  if (koe.antall === 0) {
    return (
      <Seksjon merkelapp="Køen">
        <Svar>Ingenting står åpent</Svar>
        <Hjelp>Bestillingene fra knappene over havner her til Anakin har svart.</Hjelp>
      </Seksjon>
    )
  }
  return (
    <Seksjon merkelapp="Køen">
      {koe.haster > 0 ? (
        <Svar>
          <span className="varsel">{koe.haster === 1 ? "Ett haster" : `${koe.haster} haster`}</span> av{" "}
          <strong>{koe.antall}</strong> åpne oppdrag
        </Svar>
      ) : (
        <Svar>
          <strong>{koe.antall}</strong> oppdrag står åpne
        </Svar>
      )}
      <Hjelp>
        {koe.eldsteAlder ? `Eldste har ligget ${koe.eldsteAlder}. ` : ""}
        Det som haster står først. Godkjenn, avvis eller marker lest — bare status endres.
      </Hjelp>
      {koe.oppdrag.map((o) => {
        const rad = rader.get(o.id)
        return (
          <div key={o.id} className="ny-post">
            <div className="ny-post-topp">
              {o.lapp ? (
                <span className={o.prioritet === "low" ? "ny-lapp" : "ny-lapp haster"}>{o.lapp}</span>
              ) : null}
              <span>{o.fra}</span>
              <span>kom for {varighet(o.created_at, naa)} siden</span>
              {rad ? <span>{REQUEST_STATUS_LABELS[rad.status] ?? rad.status}</span> : null}
            </div>
            <p className="ny-post-tittel">{o.tekst}</p>
            {rad ? (
              <div className="ny-knapper">
                <KoeKnapper row={rad} botHref={botHref} />
              </div>
            ) : null}
          </div>
        )
      })}
    </Seksjon>
  )
}

// ── Uken ────────────────────────────────────────────────────────────────────

function Uken({
  week,
  s,
}: {
  week: { ok: true; items: ContentItem[] } | { ok: false; error: string }
  s: Snakkis
}) {
  if (!week.ok) {
    return (
      <Seksjon merkelapp="Uken">
        <Feil hva="innholdet" feil={week.error} />
      </Seksjon>
    )
  }
  const u = uken(week.items)
  if (u.totalt === 0) {
    return (
      <Seksjon merkelapp="Uken">
        <Stille>Ingen innholdsidéer i arbeid. Synken fra detox-vault har ikke skrevet noe ennå.</Stille>
      </Seksjon>
    )
  }
  return (
    <Seksjon merkelapp="Uken">
      <Svar>{ukenSvar(u)}</Svar>
      <Hjelp>
        Idéene har ingen dato i basen, så dette er alt som er under arbeid: brief → utkast →
        claim-check → stemme og kanal.
      </Hjelp>
      <Detaljer tekst="Se uken">
        <Liste>
          {(Object.keys(u.per) as WeekBucket[]).flatMap((b) =>
            u.per[b].map((it) => (
              <Linje key={it.id} n={WEEK_BUCKET_LABELS[b]}>
                <b>{it.title}</b>
                <span className="ny-evidens">
                  {STAGE_LABELS[it.stage] ?? it.stage} · {STAGE_STATUS_LABELS[it.stage_status] ?? it.stage_status}
                  {it.topic ? ` · ${it.topic}` : ""}
                  {it.channels.length > 0 ? ` · ${it.channels.join(", ")}` : ""}
                </span>
                <span className="ny-linje-knapper">
                  <BeAnakin type="draft_content" refId={it.id} period={null} tekst="Be Anakin: lag utkast" />
                  <SnakkOm s={s} table="content_items" id={it.id} period={null} />
                </span>
              </Linje>
            )),
          )}
        </Liste>
      </Detaljer>
    </Seksjon>
  )
}

// ── Siden ───────────────────────────────────────────────────────────────────

export default async function AnakinSide() {
  const naa = new Date()
  const [radar, queue, threads, week, kort] = await Promise.all([
    fetchLatestRadar(),
    fetchQueue(),
    fetchThreads(),
    fetchContentItems(),
    fetchOperatorKort(),
  ])
  const botHref = telegramHref(process.env.NEXT_PUBLIC_DETOX_TELEGRAM_BOT)
  const s: Snakkis = {
    botHref,
    aktive: activeChatRefs([
      ...(queue.ok ? queue.rows : []),
      ...(threads.ok ? threads.threads.flatMap((t) => t.messages) : []),
    ]),
  }
  const TOM: Koen = { antall: 0, eldste: null, eldsteAlder: null, haster: 0, oppdrag: [] }
  const koe = queue.ok ? koen(queue.rows, naa) : TOM
  const rader = new Map<string, RequestRow>(
    queue.ok ? queue.rows.map((r) => [r.id, r]) : [],
  )

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">
          <Link href="/">← I dag</Link>
        </div>
        <h1 className="ny-lede">
          {radar.ok && radar.report
            ? `Anakins radar fra ${radar.report.period}.`
            : radar.ok
              ? "Ingen radar fra Anakin ennå."
              : "Anakin"}
        </h1>
        <p className="ny-hjelp">
          Pulsen, planen og briefingen fra nattens Content Radar, samtalene med henne, og køen.
          Knappene legger bestillinger i køen; hun svarer her eller i Telegram. Ingenting publiseres.
        </p>
      </div>

      {!radar.ok ? (
        <Seksjon merkelapp="Radaren">
          <Feil hva="radaren" feil={radar.error} />
          {radar.code === "no_access" ? (
            <Hjelp>Innlogget bruker mangler lesetilgang til reports. Det er migrasjon 0008.</Hjelp>
          ) : null}
        </Seksjon>
      ) : radar.report === null ? (
        <Seksjon merkelapp="Radaren">
          <Stille>
            Ingen Content Radar fra Anakin i basen. Nattjobben skriver den klokka 05:30 UTC.
          </Stille>
          <Knapper>
            <BeAnakin type="refresh_puls" period={null} tekst="Be Anakin oppdatere pulsen" />
          </Knapper>
        </Seksjon>
      ) : (
        <>
          <Pulsen report={radar.report} />
          <Planen report={radar.report} s={s} />
          <Briefingen report={radar.report} kort={kort} s={s} naa={naa} />
        </>
      )}

      <Samtalene threads={threads} botHref={botHref} />

      <Koeen
        koe={koe}
        rader={rader}
        feil={queue.ok ? null : queue.error}
        botHref={botHref}
        naa={naa}
      />

      <Uken week={week} s={s} />
    </>
  )
}
