import React from "react"

import { kr, num } from "@/components/i-dag/format"
import { Badge } from "@/components/Badge"
import { KpiCard } from "@/components/ui/KpiCard"
import { OsCard } from "@/components/ui/OsCard"
import {
  ANAKIN_AGENT_ID,
  briefingOf,
  findPuls,
  parseRequestBody,
  pctLabel,
  QUEUE_STATUSES,
  RADAR_REPORT_TYPE,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPES,
  requiresApproval,
  stripApprovalMark,
  type RadarReport,
  type RequestRow,
} from "@/lib/eiere"
import {
  fetchLatestRadar,
  fetchQueue,
  fetchRunState,
  type ReadError,
} from "@/lib/eiere-server"
import {
  AGENT_IDS,
  AGENTS,
  agentsFor,
  confidenceLabel,
  DETOX_PROJECT_REF,
  filterHref,
  freshnessOf,
  KINDS,
  kindLabel,
  parseFilters,
  PERIOD_DAYS,
  sinceDate,
  storyOf,
  timeLabel,
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

// Radar v1 (Kim og Anniken): all intel fra nattjobbene til AnakinBot (marked)
// og IndigoBot (research), lest direkte fra Detox-basen med eierens egen
// session. Kun lesing — ja/nei paa koeen gjoeres paa /eiere, dialogen i
// Telegram. Ingen chat, ingen mock. Tom og feil skal se tomme/feil ut.
export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

// ── smaa byggeklosser ────────────────────────────────────────────────────────

function Provenance({ children }: { children: React.ReactNode }) {
  return (
    <p className="jbm mt-3 text-[10px] leading-relaxed text-[var(--os-text-muted)]">
      {children}
    </p>
  )
}

function Empty({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--os-radius-md)] border-[0.5px] border-dashed border-[var(--os-border)] p-4">
      <p className="text-sm text-[var(--os-text-primary)]">{title}</p>
      {children ? (
        <div className="mt-1 text-xs text-[var(--os-text-secondary)]">
          {children}
        </div>
      ) : null}
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
          Innlogget bruker mangler lesetilgang. Forventet inntil migrasjon{" "}
          <code>supabase/migrations/0008_shared_state_owner_access.sql</code> er
          kjoert mot {DETOX_PROJECT_REF}.
        </p>
      ) : null}
    </div>
  )
}

function KindTag({ kind }: { kind: string }) {
  return (
    <span className="jbm rounded bg-[var(--os-accent-dim)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--os-accent)]">
      {kindLabel(kind)}
    </span>
  )
}

function ReviewTag() {
  return (
    <span className="jbm rounded bg-[rgba(245,158,11,0.15)] px-1.5 py-0.5 text-[9px] text-[var(--os-warning)]">
      ikke gjennomgaatt
    </span>
  )
}

// ── Ferskhet per agent ───────────────────────────────────────────────────────

function FreshnessLine({
  agentId,
  latest,
}: {
  agentId: AgentId
  latest: LatestReportResult
}) {
  const meta = AGENTS[agentId]
  if (!latest.ok) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--os-text-primary)]">
          {meta.label}
        </span>
        <Badge variant="error">kunne ikke leses</Badge>
        <span className="jbm text-[10px] text-[var(--os-text-muted)]">
          {latest.error}
        </span>
      </div>
    )
  }
  const f = freshnessOf(latest.report?.created_at ?? null)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--os-text-primary)]">
        {meta.label}{" "}
        <span className="text-[var(--os-text-muted)]">({meta.role})</span>
      </span>
      <Badge variant={f.variant}>{f.label}</Badge>
      <span className="jbm text-[10px] text-[var(--os-text-muted)]">
        {latest.report
          ? `siste rapport ${timeLabel(latest.report.created_at)} · ${latest.report.report_type} · ${latest.report.period}${f.ageH !== null ? ` · ${Math.round(f.ageH)} t siden` : ""}`
          : `ingen rader i reports for ${agentId}`}
      </span>
    </div>
  )
}

// ── I dag + PULS (siste Content Radar fra Anakin) ────────────────────────────

function TodayBand({ report }: { report: RadarReport }) {
  const funn = briefingOf(report).funn
  return (
    <OsCard title={`I dag — Content Radar ${report.period}`}>
      {funn.length === 0 ? (
        <Empty title="Ingen funn i dagens radar (pulsen unntatt)." />
      ) : (
        <ul className="space-y-1">
          {funn.map((f) => (
            <li
              key={f.id}
              className="rounded-[var(--os-radius-sm)] px-2 py-2 hover:bg-[var(--os-bg-hover)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <KindTag kind={f.kind} />
                {requiresApproval(f.claim) ? (
                  <span className="jbm rounded bg-[rgba(245,158,11,0.15)] px-1.5 py-0.5 text-[9px] text-[var(--os-warning)]">
                    krever godkjenning
                  </span>
                ) : null}
                {confidenceLabel(f.confidence) ? (
                  <span className="jbm text-[9px] text-[var(--os-text-muted)]">
                    conf {confidenceLabel(f.confidence)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--os-text-primary)]">
                {stripApprovalMark(f.claim)}
              </p>
              {f.source_url ? (
                <a
                  href={f.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="jbm mt-1 inline-block max-w-full truncate text-[10px] text-[var(--os-accent)]"
                >
                  {f.source_url}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Provenance>
        Tre viktigste = hoeyest confidence i reports/{report.id.slice(0, 8)}… ·
        agent_id={ANAKIN_AGENT_ID} · report_type={RADAR_REPORT_TYPE} · period=
        {report.period} · findings {report.findings.length} · recommendations{" "}
        {report.recommendations.length} · ref {DETOX_PROJECT_REF}. Spor A/B,
        anbefalinger og bestillinger: /eiere.
      </Provenance>
    </OsCard>
  )
}

function PulsBand({ report }: { report: RadarReport }) {
  const res = findPuls(report.findings)
  const prov = (
    <Provenance>
      findings · kind=signal · report {report.period} · Anakins egen
      Shopify-lesing i nattens radar, ikke et nytt Shopify-kall · ref{" "}
      {DETOX_PROJECT_REF}
    </Provenance>
  )
  if (!res.ok) {
    return (
      <OsCard title="Puls — siste 7 dager">
        {res.reason === "no_signal" ? (
          <Empty title="Radaren for denne dagen har ingen salgspuls.">
            Ingen findings-rad med kind=signal og «salgspuls» i rapport{" "}
            {report.period}.
          </Empty>
        ) : (
          <Empty title="Pulsen finnes, men tallene kunne ikke tolkes.">
            <blockquote className="mt-2 border-l-2 border-[var(--os-border)] pl-3 text-[var(--os-text-secondary)]">
              {res.raw}
            </blockquote>
          </Empty>
        )}
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
          delta={`${pctLabel(p.ordersDeltaPct)} vs forrige uke`}
          trend={(p.ordersDeltaPct ?? 0) < 0 ? "down" : "up"}
          width="60%"
        />
        <KpiCard
          label="Omsetning 7d"
          value={kr(p.revenue7d)}
          delta={`${pctLabel(p.revenueDeltaPct)} vs forrige uke`}
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
      <details className="mt-3">
        <summary className="jbm cursor-pointer text-[10px] text-[var(--os-text-muted)]">
          Vis Anakins raa tekst
        </summary>
        <p className="mt-2 text-xs text-[var(--os-text-secondary)]">
          {res.raw}
        </p>
      </details>
      {prov}
    </OsCard>
  )
}

// ── Filtre (ren GET-form, ingen klient-JS) ───────────────────────────────────

function FilterBar({ filters }: { filters: RadarFilters }) {
  const select =
    "rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] bg-[var(--os-bg-card)] px-2 py-1 text-xs text-[var(--os-text-primary)]"
  return (
    <form
      method="get"
      action="/radar"
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1 text-[10px] text-[var(--os-text-muted)]">
        Agent
        <select name="agent" defaultValue={filters.agent} className={select}>
          <option value="alle">Alle</option>
          <option value="anakin">Anakin (marked)</option>
          <option value="indigo">Indigo (research)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-[var(--os-text-muted)]">
        Periode
        <select
          name="periode"
          defaultValue={filters.periode}
          className={select}
        >
          <option value="7d">Siste 7 dager</option>
          <option value="30d">Siste 30 dager</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-[var(--os-text-muted)]">
        Type
        <select
          name="kind"
          defaultValue={filters.kind ?? ""}
          className={select}
        >
          <option value="">Alle typer</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)} ({k})
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-accent)] px-3 py-1 text-xs text-[var(--os-accent)] hover:bg-[var(--os-accent-dim)]"
      >
        Filtrer
      </button>
      <a
        href={filterHref({ agent: "alle", periode: "7d", kind: null })}
        className="jbm text-[10px] text-[var(--os-text-muted)] underline"
      >
        nullstill
      </a>
    </form>
  )
}

// ── Agent-kolonner ───────────────────────────────────────────────────────────

function FindingCard({ f }: { f: FindingRow }) {
  const story = storyOf(f.report.report_type)
  const conf = confidenceLabel(f.confidence)
  return (
    <li className="rounded-[var(--os-radius-sm)] px-2 py-2 hover:bg-[var(--os-bg-hover)]">
      <div className="flex flex-wrap items-center gap-2">
        <KindTag kind={f.kind} />
        <span className="jbm text-[10px] text-[var(--os-text-muted)]">
          {f.report.period}
        </span>
        {story ? (
          <span className="jbm text-[10px] text-[var(--os-text-muted)]">
            {story}
          </span>
        ) : null}
        {conf ? (
          <span className="jbm text-[9px] text-[var(--os-text-muted)]">
            conf {conf}
          </span>
        ) : null}
        {f.report.requires_review ? <ReviewTag /> : null}
        {requiresApproval(f.claim) ? (
          <span className="jbm rounded bg-[rgba(245,158,11,0.15)] px-1.5 py-0.5 text-[9px] text-[var(--os-warning)]">
            krever godkjenning
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-[var(--os-text-primary)]">
        {stripApprovalMark(f.claim)}
      </p>
      {f.evidence ? (
        <details className="mt-1">
          <summary className="jbm cursor-pointer text-[10px] text-[var(--os-text-muted)]">
            evidens
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--os-text-secondary)]">
            {f.evidence}
          </p>
        </details>
      ) : null}
      {f.source_url ? (
        <a
          href={f.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="jbm mt-1 inline-block max-w-full truncate text-[10px] text-[var(--os-accent)]"
        >
          {f.source_url}
        </a>
      ) : null}
    </li>
  )
}

function AgentColumn({
  agentId,
  result,
  filters,
}: {
  agentId: AgentId
  result: FindingsResult
  filters: RadarFilters
}) {
  const meta = AGENTS[agentId]
  const since = sinceDate(filters.periode)
  const prov = (
    <Provenance>
      findings ⋈ reports · agent_id={agentId} · period ≥ {since} (
      {PERIOD_DAYS[filters.periode]} d)
      {filters.kind ? ` · kind=${filters.kind}` : ""} · nyeste foerst · maks{" "}
      {FINDINGS_PER_AGENT} · ref {DETOX_PROJECT_REF}
    </Provenance>
  )
  if (!result.ok) {
    return (
      <OsCard title={`${meta.label} — ${meta.role}`}>
        <ErrorBox err={result} table="findings / reports" />
        {prov}
      </OsCard>
    )
  }
  const reviewCount = result.rows.filter((r) => r.report.requires_review).length
  return (
    <OsCard title={`${meta.label} — ${meta.role} · ${result.rows.length} funn`}>
      {result.rows.length === 0 ? (
        <Empty title={`Ingen funn fra ${meta.label} i valgt periode.`}>
          Ingen rader i findings med reports.agent_id={agentId} og period ≥{" "}
          {since}
          {filters.kind ? ` og kind=${filters.kind}` : ""}.
        </Empty>
      ) : (
        <ul className="space-y-1">
          {result.rows.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </ul>
      )}
      {result.rows.length > 0 && reviewCount > 0 ? (
        <p className="jbm mt-2 text-[10px] text-[var(--os-text-muted)]">
          {reviewCount} av {result.rows.length} fra rapporter som ikke er
          menneskelig gjennomgaatt (requires_review).
        </p>
      ) : null}
      {prov}
    </OsCard>
  )
}

// ── Godkjenningskoe (kun lesing) ─────────────────────────────────────────────

function QueueBand({
  queue,
}: {
  queue: { ok: true; rows: RequestRow[] } | ReadError
}) {
  const prov = (
    <Provenance>
      requests · status in ({QUEUE_STATUSES.join(", ")}) · nyeste foerst · ref{" "}
      {DETOX_PROJECT_REF}. Kun lesing her — godkjenn/avvis/marker lest gjoeres
      paa /eiere, dialogen i Telegram.
    </Provenance>
  )
  if (!queue.ok) {
    return (
      <OsCard title="Godkjenningskoe">
        <ErrorBox err={queue} table="requests" />
        {prov}
      </OsCard>
    )
  }
  return (
    <OsCard title={`Godkjenningskoe — ${queue.rows.length} venter`}>
      {queue.rows.length === 0 ? (
        <Empty title="Koeen er tom.">
          Ingen rader i requests med status open eller in_progress.
        </Empty>
      ) : (
        <ul className="divide-y-[0.5px] divide-[var(--os-border)]">
          {queue.rows.map((r) => {
            const p = parseRequestBody(r.body)
            const label = p.type ? REQUEST_TYPES[p.type].label : r.kind
            return (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="jbm rounded bg-[var(--os-accent-dim)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--os-accent)]">
                    {label}
                  </span>
                  <span className="jbm text-[10px] text-[var(--os-text-muted)]">
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status} · fra{" "}
                    {r.requester}
                    {p.to ? ` · til ${p.to}` : ""} · {timeLabel(r.created_at)} ·
                    id {r.id.slice(0, 8)}…
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--os-text-primary)]">
                  {p.summary}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      {prov}
    </OsCard>
  )
}

// ── Siden ────────────────────────────────────────────────────────────────────

export default async function RadarPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const filters = parseFilters(searchParams)
  const [
    radar,
    findings,
    latestAnakin,
    latestIndigo,
    runAnakin,
    runIndigo,
    queue,
  ] = await Promise.all([
    fetchLatestRadar(),
    fetchFindings(filters),
    fetchLatestReportHead("agent-anakinbot"),
    fetchLatestReportHead("agent-indigobot"),
    fetchRunState("agent-anakinbot"),
    fetchRunState("agent-indigobot"),
    fetchQueue(),
  ])
  const latest: Record<AgentId, LatestReportResult> = {
    "agent-anakinbot": latestAnakin,
    "agent-indigobot": latestIndigo,
  }
  const runs = [runAnakin, runIndigo]
  const columns = agentsFor(filters.agent)

  return (
    <>
      <div>
        <h1 className="text-lg text-[var(--os-text-primary)] sm:text-xl">
          Radar
        </h1>
        <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
          All intel fra nattjobbene: Anakins content-radar (marked) og Indigos
          forskningsfunn (research), rett fra basen. Oversikt og koe — ja/nei
          paa /eiere, dialogen i Telegram.
        </p>
        <div className="mt-3 space-y-1">
          {AGENT_IDS.map((a) => (
            <FreshnessLine key={a} agentId={a} latest={latest[a]} />
          ))}
        </div>
        <p className="jbm mt-2 text-[10px] text-[var(--os-text-muted)]">
          {AGENT_IDS.map((a, i) => {
            const r = runs[i]
            return r.ok
              ? r.state
                ? `run_state ${a}: ${r.state.last_run_status ?? "ukjent"} · ${timeLabel(r.state.last_successful_run)}`
                : `run_state ${a}: ingen rad`
              : `run_state ${a}: kunne ikke leses (${r.code})`
          }).join(" · ")}
          {" · "}ref {DETOX_PROJECT_REF}
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {!radar.ok ? (
          <OsCard title="I dag og puls">
            <ErrorBox
              err={radar}
              table="reports / findings / recommendations"
            />
          </OsCard>
        ) : radar.report === null ? (
          <OsCard title="I dag og puls">
            <Empty title="Ingen Content Radar fra Anakin i basen.">
              reports har ingen rad med agent_id={ANAKIN_AGENT_ID} og
              report_type={RADAR_REPORT_TYPE}.
            </Empty>
          </OsCard>
        ) : (
          <>
            <TodayBand report={radar.report} />
            <PulsBand report={radar.report} />
          </>
        )}

        <OsCard title="Filtre">
          <FilterBar filters={filters} />
        </OsCard>

        <div
          className={
            columns.length === 2 ? "grid gap-5 lg:grid-cols-2" : "grid gap-5"
          }
        >
          {columns.map((a) => (
            <AgentColumn
              key={a}
              agentId={a}
              result={findings[a]}
              filters={filters}
            />
          ))}
        </div>

        <QueueBand queue={queue} />
      </div>
    </>
  )
}
