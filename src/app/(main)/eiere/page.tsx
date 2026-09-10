import React from "react"
import Link from "next/link"

import { kr, num } from "@/components/i-dag/format"
import { Badge } from "@/components/Badge"
import { KpiCard } from "@/components/ui/KpiCard"
import { OsCard } from "@/components/ui/OsCard"
import { fetchContentItems } from "@/lib/content-server"
import {
  CONTENT_STAGES,
  countByStage,
  STAGE_LABELS,
  STAGE_STATUS_LABELS,
  type ContentItem,
} from "@/lib/content"
import {
  ANAKIN_AGENT_ID,
  aovOf,
  briefingOf,
  DETOX_PROJECT_REF,
  findPuls,
  NEXT_MOVES,
  parseRequestBody,
  pctLabel,
  planOf,
  QUEUE_STATUSES,
  RADAR_REPORT_TYPE,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPES,
  requiresApproval,
  stripApprovalMark,
  telegramHref,
  WEEK_BUCKET_LABELS,
  weekBucketOf,
  type PulsPoint,
  type RadarFinding,
  type RadarRecommendation,
  type RadarReport,
  type RequestRow,
  type WeekBucket,
} from "@/lib/eiere"
import {
  fetchLatestRadar,
  fetchPulsHistory,
  fetchQueue,
  fetchRunState,
  type ReadError,
} from "@/lib/eiere-server"

import { Openable, Provenance } from "./Openable"
import { PulsChart } from "./PulsChart"
import { QueueActions } from "./QueueActions"
import { RefRequestButton } from "./RefRequestButton"
import { RequestButtons } from "./RequestButtons"

// Eier-oversikt (Kim og Anniken). Fem bånd — PULS, Plan, Briefing, Kø, Uken —
// alle lest med brukerens egen session (RLS). Hovedsiden viser overskrifter;
// hele saken ligger bak «Åpne». Alle knapper skriver til `requests` og
// ingenting annet. Ingen chatbot, ingen publisering. Tom og feil skal se
// tomme/feil ut. Ingen mock-tall.
export const dynamic = "force-dynamic"

// ── små byggeklosser ─────────────────────────────────────────────────────────

function Empty({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--os-radius-md)] border-[0.5px] border-dashed border-[var(--os-border)] p-4">
      <p className="text-sm text-[var(--os-text-primary)]">{title}</p>
      <div className="mt-1 text-xs text-[var(--os-text-secondary)]">
        {children}
      </div>
    </div>
  )
}

function ErrorBox({ err, table }: { err: ReadError; table: string }) {
  return (
    <div className="rounded-[var(--os-radius-md)] border-[0.5px] border-[var(--os-danger)] bg-[rgba(224,92,92,0.06)] p-4">
      <p className="text-sm font-medium text-[var(--os-danger)]">
        Kunne ikke lese {table}
      </p>
      <p className="jbm mt-1 text-[11px] text-[var(--os-text-secondary)]">
        {err.error}
      </p>
      {err.code === "no_access" ? (
        <p className="mt-2 text-xs text-[var(--os-text-secondary)]">
          Innlogget bruker mangler lesetilgang til denne tabellen. Det er
          forventet inntil migrasjon{" "}
          <code>supabase/migrations/0008_shared_state_owner_access.sql</code> er
          kjørt mot {DETOX_PROJECT_REF}. Siden viser ingen tall framfor å vise
          oppdiktede.
        </p>
      ) : null}
    </div>
  )
}

function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "ukjent"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "ukjent" : d.toLocaleString("nb-NO")
}

/** Overskriften som alltid er synlig: maks to linjer. */
function Headline({ children }: { children: React.ReactNode }) {
  return (
    <p className="line-clamp-2 text-sm text-[var(--os-text-primary)]">
      {children}
    </p>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <p className="jbm mt-1 text-[10px] text-[var(--os-text-muted)]">
      {children}
    </p>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="jbm mb-1 text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
      {children}
    </h4>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="jbm rounded bg-[var(--os-accent-dim)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--os-accent)]">
      {children}
    </span>
  )
}

function ApprovalMark() {
  return (
    <span className="jbm rounded bg-[rgba(245,158,11,0.15)] px-1.5 py-0.5 text-[9px] text-[var(--os-warning)]">
      krever godkjenning
    </span>
  )
}

// ── 1. PULS ──────────────────────────────────────────────────────────────────

function PulsBand({
  report,
  history,
}: {
  report: RadarReport
  history: { ok: true; points: PulsPoint[] } | ReadError
}) {
  const res = findPuls(report.findings)
  const prov = (
    <Provenance>
      findings · kind=signal/data · report_id={report.id.slice(0, 8)}… ·
      reports.agent_id={ANAKIN_AGENT_ID} · report_type={RADAR_REPORT_TYPE} ·
      period={report.period} · ref {DETOX_PROJECT_REF}. Tallene er Anakins egen
      Shopify-lesing i nattens radar — ikke et nytt Shopify-kall. Trend: én puls
      per radar-dag fra de siste 14 rapportene
      {history.ok
        ? `, ${history.points.length} kunne tolkes (gjentatte identiske målinger telles én gang)`
        : ` — kunne ikke leses (${history.error})`}
      .
    </Provenance>
  )

  if (!res.ok && res.reason === "no_signal") {
    return (
      <OsCard title="Puls — siste 7 dager">
        <Empty title="Radaren for denne dagen har ingen salgspuls.">
          Ingen findings-rad med kind=signal/data og «salgspuls» i rapport{" "}
          {report.period}.
        </Empty>
        {prov}
      </OsCard>
    )
  }
  if (!res.ok) {
    return (
      <OsCard title="Puls — siste 7 dager">
        <Empty title="Pulsen finnes, men tallene kunne ikke tolkes.">
          Rå tekst fra Anakin (findings/{res.findingId.slice(0, 8)}…):
          <blockquote className="mt-2 border-l-2 border-[var(--os-border)] pl-3 text-[var(--os-text-secondary)]">
            {res.raw}
          </blockquote>
        </Empty>
        {prov}
      </OsCard>
    )
  }

  const p = res.puls
  return (
    <OsCard title="Puls — siste 7 dager">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Ordrer 7d"
          value={num(p.orders7d)}
          delta={`${(p.ordersDeltaPct ?? 0) < 0 ? "↓" : "↑"} ${pctLabel(p.ordersDeltaPct)} vs forrige uke`}
          trend={(p.ordersDeltaPct ?? 0) < 0 ? "down" : "up"}
          width="60%"
        />
        <KpiCard
          label="Omsetning 7d"
          value={kr(p.revenue7d)}
          delta={`${(p.revenueDeltaPct ?? 0) < 0 ? "↓" : "↑"} ${pctLabel(p.revenueDeltaPct)} vs forrige uke`}
          trend={(p.revenueDeltaPct ?? 0) < 0 ? "down" : "up"}
          width="60%"
        />
        <KpiCard
          label="Ordrer forrige uke"
          value={num(p.ordersPrev)}
          width="40%"
        />
        <KpiCard
          label="Omsetning forrige uke"
          value={kr(p.revenuePrev)}
          width="40%"
        />
      </div>
      <PulsChart puls={p} history={history.ok ? history.points : []} />
      <details className="group mt-3">
        <summary className="jbm inline-flex cursor-pointer list-none text-[10px] text-[var(--os-text-muted)] hover:text-[var(--os-text-secondary)] [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Vis Anakins rå tekst</span>
          <span className="hidden group-open:inline">Skjul rå tekst</span>
        </summary>
        <p className="mt-2 text-xs text-[var(--os-text-secondary)]">
          {res.raw}
        </p>
      </details>
      {prov}
    </OsCard>
  )
}

// ── 2. Plan og neste steg ────────────────────────────────────────────────────

function RecItem({
  r,
  period,
  tag,
}: {
  r: RadarRecommendation
  period: string
  tag?: string
}) {
  const text = stripApprovalMark(r.action)
  const flagged = requiresApproval(r.action)
  return (
    <li className="rounded-[var(--os-radius-sm)] px-2 py-2 hover:bg-[var(--os-bg-hover)]">
      <Openable
        headline={
          <>
            {tag || flagged ? (
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {tag ? <Tag>{tag}</Tag> : null}
                {flagged ? <ApprovalMark /> : null}
              </div>
            ) : null}
            <Headline>{text}</Headline>
          </>
        }
      >
        <p className="whitespace-pre-line text-sm text-[var(--os-text-secondary)]">
          {text}
        </p>
        <Meta>
          {r.kind} · {r.status}
          {r.owner ? ` · eier ${r.owner}` : ""} · {timeLabel(r.created_at)} ·
          recommendations/{r.id.slice(0, 8)}…
        </Meta>
        <div className="mt-2">
          <RefRequestButton
            type="do_recommendation"
            refId={r.id}
            period={period}
            label="Be Anakin gjøre dette"
          />
        </div>
      </Openable>
    </li>
  )
}

function RecGroup({
  tag,
  title,
  items,
  period,
}: {
  tag: string
  title: string
  items: RadarRecommendation[]
  period: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Tag>{tag}</Tag>
        <h4 className="text-xs text-[var(--os-text-secondary)]">
          {title} · {items.length}
        </h4>
      </div>
      <ul className="space-y-1">
        {items.map((r) => (
          <RecItem key={r.id} r={r} period={period} />
        ))}
      </ul>
    </div>
  )
}

function ProfitCard({ report }: { report: RadarReport }) {
  const res = findPuls(report.findings)
  if (!res.ok) {
    return (
      <Empty title="Ingen salgspuls å bygge profitt-bildet på i dag.">
        Profitt-kortet bruker de samme tallene som pulsen over. Be Anakin
        oppdatere salgspulsen, så fylles det.
      </Empty>
    )
  }
  const p = res.puls
  const a = aovOf(p)
  const delta = (pct: number | null, unit: string) =>
    `${(pct ?? 0) < 0 ? "↓" : "↑"} ${pctLabel(pct)} ${unit}`
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Flere ordrer"
          value={num(p.orders7d)}
          delta={delta(p.ordersDeltaPct, "vs forrige uke")}
          trend={(p.ordersDeltaPct ?? 0) < 0 ? "down" : "up"}
          tooltip="Antall ordrer siste 7 dager. Flere ordrer = flere kunder inn."
          width="50%"
        />
        <KpiCard
          label="Større kurv (beregnet)"
          value={a.aov === null ? "—" : kr(a.aov)}
          delta={
            a.aovDeltaPct === null
              ? "forrige uke ukjent"
              : delta(a.aovDeltaPct, "vs forrige uke")
          }
          trend={(a.aovDeltaPct ?? 0) < 0 ? "down" : "up"}
          tooltip="Snittordreverdi = omsetning / ordrer, regnet ut av pulsen. Større kurv = mer per kunde."
          width="50%"
        />
        <KpiCard
          label="Omsetning"
          value={kr(p.revenue7d)}
          delta={delta(p.revenueDeltaPct, "vs forrige uke")}
          trend={(p.revenueDeltaPct ?? 0) < 0 ? "down" : "up"}
          tooltip="Omsetning siste 7 dager = ordrer × snittkurv."
          width="50%"
        />
      </div>
      <p className="mt-2 text-xs text-[var(--os-text-secondary)]">
        Profitt vokser på to spaker: flere ordrer og større kurv. Denne uken:
        ordrer {pctLabel(p.ordersDeltaPct)}, kurv{" "}
        {a.aovDeltaPct === null ? "—" : pctLabel(a.aovDeltaPct)}, omsetning{" "}
        {pctLabel(p.revenueDeltaPct)}. Neste trekk over er det Anakin mener
        flytter disse tallene.
      </p>
    </div>
  )
}

function PipelineChips({
  week,
}: {
  week: { ok: true; items: ContentItem[] } | { ok: false; error: string }
}) {
  if (!week.ok) {
    return (
      <Meta>content_items kunne ikke leses ({week.error}) — se /innhold.</Meta>
    )
  }
  const counts = countByStage(week.items)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CONTENT_STAGES.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 ? (
            <span className="text-[var(--os-text-muted)]" aria-hidden="true">
              →
            </span>
          ) : null}
          <Link
            href="/innhold"
            className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-2 py-1 text-[11px] text-[var(--os-text-secondary)] transition-colors hover:bg-[var(--os-bg-hover)] hover:text-[var(--os-text-primary)]"
          >
            {STAGE_LABELS[s]}{" "}
            <span className="jbm text-[var(--os-accent)]">{counts[s]}</span>
          </Link>
        </React.Fragment>
      ))}
      <span className="jbm text-[10px] text-[var(--os-text-muted)]">
        {week.items.length} idéer i arbeid · åpne hver idé under «Uken» · alt i{" "}
        <Link href="/innhold" className="text-[var(--os-accent)]">
          /innhold
        </Link>
      </span>
    </div>
  )
}

function PlanBand({
  report,
  week,
}: {
  report: RadarReport
  week: { ok: true; items: ContentItem[] } | { ok: false; error: string }
}) {
  const plan = planOf(report)
  const restCount = plan.sporA.length + plan.sporB.length + plan.utenSpor.length
  return (
    <OsCard title={`Plan og neste steg — Content Radar ${report.period}`}>
      <SectionLabel>Neste trekk · {plan.neste.length}</SectionLabel>
      {plan.neste.length === 0 ? (
        <Empty title="Ingen anbefalinger venter på avgjørelse.">
          recommendations for rapport {report.id.slice(0, 8)}… har ingen rad med
          status pending ({plan.avgjort} avgjort).
        </Empty>
      ) : (
        <ol className="space-y-1">
          {plan.neste.map((r, i) => (
            <RecItem key={r.id} r={r} period={report.period} tag={`${i + 1}`} />
          ))}
        </ol>
      )}

      <div className="mt-5">
        <SectionLabel>Profitt — hvordan det går</SectionLabel>
        <ProfitCard report={report} />
      </div>

      {restCount > 0 ? (
        <div className="mt-5 border-t-[0.5px] border-[var(--os-border)] pt-4">
          <SectionLabel>Resten av planen · {restCount}</SectionLabel>
          <div className="grid gap-5 md:grid-cols-2">
            <RecGroup
              tag="Spor A"
              title="Anniken — personlig / refleksivt"
              items={plan.sporA}
              period={report.period}
            />
            <RecGroup
              tag="Spor B"
              title="Detox — mekanisme / utdanning"
              items={plan.sporB}
              period={report.period}
            />
          </div>
          <div className={plan.utenSpor.length > 0 ? "mt-5" : ""}>
            <RecGroup
              tag="Uten spor"
              title="konkrete punkter"
              items={plan.utenSpor}
              period={report.period}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-5 border-t-[0.5px] border-[var(--os-border)] pt-4">
        <SectionLabel>Innholdsidéer i pipeline</SectionLabel>
        <PipelineChips week={week} />
      </div>

      <Provenance>
        recommendations · report_id={report.id.slice(0, 8)}… · status=pending ·
        neste trekk = de {NEXT_MOVES} første etter tallet i spor-prefikset
        (A1/B1 før A2/B2; uten prefiks først, i Anakins rekkefølge) ·{" "}
        {plan.avgjort} avgjort (approved/rejected/deferred) vises ikke · ja/nei
        på anbefalinger skjer i Telegram · «Be Anakin gjøre dette» legger en rad
        i requests med ref recommendations/&lt;id&gt; · profitt = samme
        findings-rad som pulsen, snittkurv beregnet · innholdsidéer =
        content_items (Buffer-idéer har ingen kilde i basen ennå) · ref{" "}
        {DETOX_PROJECT_REF}
      </Provenance>
    </OsCard>
  )
}

// ── 3. Briefing ──────────────────────────────────────────────────────────────

function FindingItem({ f, period }: { f: RadarFinding; period: string }) {
  const flagged = requiresApproval(f.claim)
  const text = stripApprovalMark(f.claim)
  return (
    <li className="rounded-[var(--os-radius-sm)] px-2 py-2 hover:bg-[var(--os-bg-hover)]">
      <Openable
        headline={
          <>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                {f.kind}
              </span>
              {flagged ? <ApprovalMark /> : null}
              {f.confidence != null ? (
                <span className="jbm text-[9px] text-[var(--os-text-muted)]">
                  conf {String(f.confidence)}
                </span>
              ) : null}
            </div>
            <Headline>{text}</Headline>
          </>
        }
      >
        <p className="whitespace-pre-line text-sm text-[var(--os-text-secondary)]">
          {text}
        </p>
        {f.evidence ? (
          <blockquote className="mt-2 border-l-2 border-[var(--os-border)] pl-3 text-xs text-[var(--os-text-secondary)]">
            <span className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
              evidens ·{" "}
            </span>
            {f.evidence}
          </blockquote>
        ) : null}
        {f.source_url ? (
          <a
            href={f.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="jbm mt-2 inline-block max-w-full truncate text-[10px] text-[var(--os-accent)]"
          >
            {f.source_url}
          </a>
        ) : null}
        <Meta>
          findings/{f.id.slice(0, 8)}… · {timeLabel(f.created_at)}
        </Meta>
        <div className="mt-2">
          <RefRequestButton
            type="explain_finding"
            refId={f.id}
            period={period}
            label="Forklar dette funnet"
          />
        </div>
      </Openable>
    </li>
  )
}

function BriefingBand({ report }: { report: RadarReport }) {
  const b = briefingOf(report)
  const pendingRecs = report.recommendations.filter(
    (r) => r.status === "pending",
  ).length
  const reportAgeH =
    (Date.now() - new Date(report.created_at).getTime()) / 3_600_000
  const freshness =
    reportAgeH <= 24
      ? { variant: "success" as const, label: "Fersk" }
      : reportAgeH <= 48
        ? { variant: "warning" as const, label: "Eldre enn 24 t" }
        : {
            variant: "error" as const,
            label: "STALE — ingen rapport siste 48 t",
          }
  return (
    <OsCard title={`Briefing — Content Radar ${report.period}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={freshness.variant}>{freshness.label}</Badge>
        <span className="text-[10px] text-[var(--os-text-muted)]">
          Rapport kom {timeLabel(report.created_at)} · {Math.round(reportAgeH)}{" "}
          t siden
        </span>
      </div>
      {b.funn.length === 0 ? (
        <Empty title="Ingen funn i denne rapporten.">
          findings for report_id {report.id.slice(0, 8)}… er tom (pulsen
          unntatt).
        </Empty>
      ) : (
        <>
          <SectionLabel>Tre viktigste funn</SectionLabel>
          <ul className="space-y-1">
            {b.funn.map((f) => (
              <FindingItem key={f.id} f={f} period={report.period} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 border-t-[0.5px] border-[var(--os-border)] pt-4">
        <SectionLabel>Be Anakin</SectionLabel>
        <RequestButtons period={report.period} />
      </div>

      <Provenance>
        reports/{report.id.slice(0, 8)}… · agent_id={ANAKIN_AGENT_ID} ·
        report_type={RADAR_REPORT_TYPE} · period={report.period} · status=
        {report.status}
        {report.requires_review ? " · requires_review" : ""} · findings{" "}
        {report.findings.length} · recommendations{" "}
        {report.recommendations.length} ({pendingRecs} pending — vises under
        Plan) · tre viktigste = høyest confidence, pulsen unntatt · «Forklar
        dette funnet» legger en rad i requests med ref findings/&lt;id&gt; · ref{" "}
        {DETOX_PROJECT_REF}
      </Provenance>
    </OsCard>
  )
}

// ── 4. Godkjenningskø ────────────────────────────────────────────────────────

function QueueBand({
  queue,
  botHref,
}: {
  queue: { ok: true; rows: RequestRow[] } | ReadError
  botHref: string | null
}) {
  const prov = (
    <Provenance>
      requests · status in ({QUEUE_STATUSES.join(", ")}) · alle
      requester-verdier (Anakin skriver som {ANAKIN_AGENT_ID}, eiere som e-post)
      · ref {DETOX_PROJECT_REF}. Godkjenn = done, avvis = cancelled, marker lest
      = in_progress. Kun status-kolonnen endres. Annonseforslag
      (action_proposals) hører til /annonser/forslag, ikke her.
      {botHref
        ? ""
        : " Telegram-bot ikke konfigurert (NEXT_PUBLIC_DETOX_TELEGRAM_BOT) — bruk kopier-knappen."}
    </Provenance>
  )
  if (!queue.ok) {
    return (
      <OsCard title="Godkjenningskø">
        <ErrorBox err={queue} table="requests" />
        {prov}
      </OsCard>
    )
  }
  return (
    <OsCard title={`Godkjenningskø — ${queue.rows.length} venter`}>
      {queue.rows.length === 0 ? (
        <Empty title="Køen er tom.">
          Ingen rader i requests med status open eller in_progress. Bruk
          knappene i planen og briefingen for å be Anakin om noe; Anakin kan
          også legge inn egne forespørsler her.
        </Empty>
      ) : (
        <ul className="divide-y-[0.5px] divide-[var(--os-border)]">
          {queue.rows.map((r) => {
            const p = parseRequestBody(r.body)
            const label = p.type ? REQUEST_TYPES[p.type].label : r.kind
            return (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag>{label}</Tag>
                  <span className="jbm text-[10px] text-[var(--os-text-muted)]">
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status} · fra{" "}
                    {r.requester}
                    {p.to ? ` · til ${p.to}` : ""} · {timeLabel(r.created_at)} ·
                    id {r.id.slice(0, 8)}…
                  </span>
                </div>
                <Openable headline={<Headline>{p.summary}</Headline>}>
                  <p className="whitespace-pre-line text-sm text-[var(--os-text-secondary)]">
                    {r.body}
                  </p>
                  <Meta>
                    requests/{r.id}
                    {p.ref ? ` · ref ${p.ref}` : ""}
                    {p.period ? ` · radar ${p.period}` : ""}
                  </Meta>
                </Openable>
                <QueueActions row={r} telegramHref={botHref} />
              </li>
            )
          })}
        </ul>
      )}
      {prov}
    </OsCard>
  )
}

// ── 5. Uken ──────────────────────────────────────────────────────────────────

function WeekItem({ it }: { it: ContentItem }) {
  return (
    <li className="rounded-[var(--os-radius-sm)] px-2 py-1.5 hover:bg-[var(--os-bg-hover)]">
      <Openable headline={<Headline>{it.title}</Headline>}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-[var(--os-text-secondary)]">
          <dt className="jbm text-[10px] text-[var(--os-text-muted)]">tema</dt>
          <dd>{it.topic ?? "—"}</dd>
          <dt className="jbm text-[10px] text-[var(--os-text-muted)]">stage</dt>
          <dd>
            {STAGE_LABELS[it.stage] ?? it.stage} ·{" "}
            {STAGE_STATUS_LABELS[it.stage_status] ?? it.stage_status}
          </dd>
          <dt className="jbm text-[10px] text-[var(--os-text-muted)]">
            kanaler
          </dt>
          <dd>{it.channels.join(", ") || "ingen kanal"}</dd>
          <dt className="jbm text-[10px] text-[var(--os-text-muted)]">
            bestilt av
          </dt>
          <dd>{it.requested_by ?? "—"}</dd>
          <dt className="jbm text-[10px] text-[var(--os-text-muted)]">kilde</dt>
          <dd className="jbm break-all text-[10px]">
            {it.source_repo}:{it.source_path}
          </dd>
          <dt className="jbm text-[10px] text-[var(--os-text-muted)]">
            oppdatert
          </dt>
          <dd>
            {timeLabel(it.updated_at)}
            {it.synced_at ? ` · synket ${timeLabel(it.synced_at)}` : ""}
          </dd>
        </dl>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RefRequestButton
            type="draft_content"
            refId={it.id}
            period={null}
            label="Be Anakin: lag utkast"
          />
          <Link
            href="/innhold"
            className="jbm text-[10px] text-[var(--os-accent)]"
          >
            /innhold
          </Link>
        </div>
      </Openable>
      <Meta>
        {STAGE_LABELS[it.stage] ?? it.stage} · {it.stage_status}
        {it.requested_by ? ` · ${it.requested_by}` : ""}
      </Meta>
    </li>
  )
}

function WeekBand({
  week,
}: {
  week: { ok: true; items: ContentItem[] } | { ok: false; error: string }
}) {
  const prov = (
    <Provenance>
      content_items · alle rader (tabellen har ingen planlagt dato, så «neste
      7–14 dager» kan ikke utledes — dette er alt som er under arbeid) ·
      planlagt = stage_status complete, blokkert = blocked, venter =
      pending/needs_research · «lag utkast» legger en rad i requests med ref
      content_items/&lt;id&gt; · ref {DETOX_PROJECT_REF}. Dypdykk: /innhold.
    </Provenance>
  )
  if (!week.ok) {
    return (
      <OsCard title="Uken — innhold">
        <ErrorBox
          err={{ ok: false, error: week.error, code: "other" }}
          table="content_items"
        />
        {prov}
      </OsCard>
    )
  }
  const items = week.items
  const buckets: Record<WeekBucket, ContentItem[]> = {
    planlagt: [],
    venter: [],
    blokkert: [],
  }
  for (const it of items) buckets[weekBucketOf(it.stage_status)].push(it)
  const counts = countByStage(items)

  return (
    <OsCard title={`Uken — innhold (${items.length})`}>
      {items.length === 0 ? (
        <Empty title="Ingen innholdselementer.">
          content_items er tom, eller synken fra detox-vault har ikke kjørt.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(buckets) as WeekBucket[]).map((b) => (
            <div key={b}>
              <SectionLabel>
                {WEEK_BUCKET_LABELS[b]} · {buckets[b].length}
              </SectionLabel>
              {buckets[b].length === 0 ? (
                <p className="jbm px-2 text-[11px] text-[var(--os-text-muted)]">
                  ingen
                </p>
              ) : (
                <ul className="space-y-1">
                  {buckets[b].map((it) => (
                    <WeekItem key={it.id} it={it} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {items.length > 0 ? (
        <p className="jbm mt-3 text-[10px] text-[var(--os-text-muted)]">
          brief {counts.brief} · draft {counts.draft} · claim-check{" "}
          {counts.claim_check} · voice/kanal {counts.voice_channel}
        </p>
      ) : null}
      {prov}
    </OsCard>
  )
}

// ── Siden ────────────────────────────────────────────────────────────────────

export default async function EierePage() {
  const [radar, history, runState, queue, week] = await Promise.all([
    fetchLatestRadar(),
    fetchPulsHistory(),
    fetchRunState(ANAKIN_AGENT_ID),
    fetchQueue(),
    fetchContentItems(),
  ])
  const botHref = telegramHref(process.env.NEXT_PUBLIC_DETOX_TELEGRAM_BOT)

  return (
    <>
      <div>
        <h1 className="text-lg text-[var(--os-text-primary)] sm:text-xl">
          Eiere
        </h1>
        <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
          Puls, plan, briefing, godkjenningskø og uken — fra Anakins nattlige
          Content Radar. Overskriftene står her; trykk «Åpne» for hele saken.
          Knappene legger oppgaver i køen til Anakin; dialogen skjer i Telegram.
        </p>
        <Provenance>
          {runState.ok
            ? runState.state
              ? `run_state · ${ANAKIN_AGENT_ID} · siste vellykkede kjøring ${timeLabel(runState.state.last_successful_run)} · status ${runState.state.last_run_status ?? "ukjent"}${runState.state.last_error ? ` · feil: ${runState.state.last_error}` : ""}`
              : `run_state · ingen rad for ${ANAKIN_AGENT_ID}`
            : `run_state · kunne ikke leses (${runState.code})`}
          {" · "}ref {DETOX_PROJECT_REF}
        </Provenance>
      </div>

      <div className="mt-6 space-y-5">
        {!radar.ok ? (
          <OsCard title="Puls, plan og briefing">
            <ErrorBox
              err={radar}
              table="reports / findings / recommendations"
            />
            <Provenance>
              reports · agent_id={ANAKIN_AGENT_ID} · report_type=
              {RADAR_REPORT_TYPE} · nyeste · ref {DETOX_PROJECT_REF}
            </Provenance>
          </OsCard>
        ) : radar.report === null ? (
          <OsCard title="Puls, plan og briefing">
            <Empty title="Ingen Content Radar fra Anakin i basen.">
              reports har ingen rad med agent_id={ANAKIN_AGENT_ID} og
              report_type={RADAR_REPORT_TYPE} (ref {DETOX_PROJECT_REF}).
              Nattjobben detox-content-radar skriver via rpc/ingest_report kl.
              05:30 UTC.
            </Empty>
            <div className="mt-4">
              <RequestButtons period={null} />
            </div>
          </OsCard>
        ) : (
          <>
            <PulsBand report={radar.report} history={history} />
            <PlanBand report={radar.report} week={week} />
            <BriefingBand report={radar.report} />
          </>
        )}

        <QueueBand queue={queue} botHref={botHref} />
        <WeekBand week={week} />
      </div>
    </>
  )
}
