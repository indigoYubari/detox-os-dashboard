import React from "react"

import { kr, num } from "@/components/i-dag/format"
import { Badge } from "@/components/Badge"
import { KpiCard } from "@/components/ui/KpiCard"
import { OsCard } from "@/components/ui/OsCard"
import { fetchContentItems } from "@/lib/content-server"
import {
  countByStage,
  STAGE_LABELS,
  type ContentItem,
} from "@/lib/content"
import {
  ANAKIN_AGENT_ID,
  briefingOf,
  DETOX_PROJECT_REF,
  findPuls,
  parseRequestBody,
  pctLabel,
  QUEUE_STATUSES,
  RADAR_REPORT_TYPE,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPES,
  requiresApproval,
  stripApprovalMark,
  telegramHref,
  WEEK_BUCKET_LABELS,
  weekBucketOf,
  type RadarFinding,
  type RadarRecommendation,
  type RadarReport,
  type RequestRow,
  type WeekBucket,
} from "@/lib/eiere"
import {
  fetchLatestRadar,
  fetchQueue,
  fetchRunState,
  type ReadError,
} from "@/lib/eiere-server"

import { QueueActions } from "./QueueActions"
import { RequestButtons } from "./RequestButtons"

// Eier-oversikt v1 (Kim og Anniken). Fire baand — PULS, Briefing, Koe, Uken —
// alle lest med brukerens egen session (RLS), og fire handlinger som alle
// skriver til `requests` og ingenting annet. Ingen chatbot, ingen publisering.
// Tom og feil skal se tomme/feil ut. Ingen mock-tall.
export const dynamic = "force-dynamic"

// ── smaa byggeklosser ────────────────────────────────────────────────────────

function Provenance({ children }: { children: React.ReactNode }) {
  return (
    <p className="jbm mt-3 text-[10px] leading-relaxed text-[var(--os-text-muted)]">
      {children}
    </p>
  )
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--os-radius-md)] border-[0.5px] border-dashed border-[var(--os-border)] p-4">
      <p className="text-sm text-[var(--os-text-primary)]">{title}</p>
      <div className="mt-1 text-xs text-[var(--os-text-secondary)]">{children}</div>
    </div>
  )
}

function ErrorBox({ err, table }: { err: ReadError; table: string }) {
  return (
    <div className="rounded-[var(--os-radius-md)] border-[0.5px] border-[var(--os-danger)] bg-[rgba(224,92,92,0.06)] p-4">
      <p className="text-sm font-medium text-[var(--os-danger)]">
        Kunne ikke lese {table}
      </p>
      <p className="jbm mt-1 text-[11px] text-[var(--os-text-secondary)]">{err.error}</p>
      {err.code === "no_access" ? (
        <p className="mt-2 text-xs text-[var(--os-text-secondary)]">
          Innlogget bruker mangler lesetilgang til denne tabellen. Det er
          forventet inntil migrasjon{" "}
          <code>supabase/migrations/0008_shared_state_owner_access.sql</code> er
          kjoert mot {DETOX_PROJECT_REF}. Siden viser ingen tall framfor aa vise
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

// ── 1. PULS ──────────────────────────────────────────────────────────────────

function PulsBand({ report }: { report: RadarReport }) {
  const res = findPuls(report.findings)
  const prov = (
    <Provenance>
      findings · kind=signal · report_id={report.id.slice(0, 8)}… ·
      reports.agent_id={ANAKIN_AGENT_ID} · report_type={RADAR_REPORT_TYPE} ·
      period={report.period} · ref {DETOX_PROJECT_REF}. Tallene er Anakins egen
      Shopify-lesing i nattens radar — ikke et nytt Shopify-kall.
    </Provenance>
  )

  if (!res.ok && res.reason === "no_signal") {
    return (
      <OsCard title="Puls — siste 7 dager">
        <Empty title="Radaren for denne dagen har ingen salgspuls.">
          Ingen findings-rad med kind=signal og «salgspuls» i rapport {report.period}.
        </Empty>
        {prov}
      </OsCard>
    )
  }
  if (!res.ok) {
    return (
      <OsCard title="Puls — siste 7 dager">
        <Empty title="Pulsen finnes, men tallene kunne ikke tolkes.">
          Raa tekst fra Anakin (findings/{res.findingId.slice(0, 8)}…):
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
        <KpiCard label="Ordrer forrige uke" value={num(p.ordersPrev)} width="40%" />
        <KpiCard label="Omsetning forrige uke" value={kr(p.revenuePrev)} width="40%" />
      </div>
      <details className="mt-3">
        <summary className="jbm cursor-pointer text-[10px] text-[var(--os-text-muted)]">
          Vis Anakins raa tekst
        </summary>
        <p className="mt-2 text-xs text-[var(--os-text-secondary)]">{res.raw}</p>
      </details>
      {prov}
    </OsCard>
  )
}

// ── 2. Briefing ──────────────────────────────────────────────────────────────

function FindingItem({ f }: { f: RadarFinding }) {
  const flagged = requiresApproval(f.claim)
  return (
    <li className="rounded-[var(--os-radius-sm)] px-2 py-2 hover:bg-[var(--os-bg-hover)]">
      <div className="flex items-center gap-2">
        <span className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
          {f.kind}
        </span>
        {flagged ? (
          <span className="jbm rounded bg-[rgba(245,158,11,0.15)] px-1.5 py-0.5 text-[9px] text-[var(--os-warning)]">
            krever godkjenning
          </span>
        ) : null}
        {f.confidence != null ? (
          <span className="jbm text-[9px] text-[var(--os-text-muted)]">
            conf {String(f.confidence)}
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
  )
}

function RecList({
  title,
  items,
  tag,
}: {
  title: string
  items: RadarRecommendation[]
  tag: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="jbm rounded bg-[var(--os-accent-dim)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--os-accent)]">
          {tag}
        </span>
        <h4 className="text-xs text-[var(--os-text-secondary)]">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="jbm px-2 text-[11px] text-[var(--os-text-muted)]">ingen i denne rapporten</p>
      ) : (
        <ul className="space-y-1">
          {items.map((r) => (
            <li key={r.id} className="rounded-[var(--os-radius-sm)] px-2 py-1.5 text-sm text-[var(--os-text-primary)] hover:bg-[var(--os-bg-hover)]">
              {requiresApproval(r.action) ? (
                <span className="jbm mr-2 rounded bg-[rgba(245,158,11,0.15)] px-1.5 py-0.5 text-[9px] text-[var(--os-warning)]">
                  krever godkjenning
                </span>
              ) : null}
              {stripApprovalMark(r.action)}
              <span className="jbm ml-2 text-[10px] text-[var(--os-text-muted)]">
                {r.status}
                {r.owner ? ` · ${r.owner}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BriefingBand({ report }: { report: RadarReport }) {
  const b = briefingOf(report)
  const pendingRecs = report.recommendations.filter((r) => r.status === "pending").length
  const reportAgeH = (Date.now() - new Date(report.created_at).getTime()) / 3_600_000
  const freshness =
    reportAgeH <= 24
      ? { variant: "success" as const, label: "Fersk" }
      : reportAgeH <= 48
        ? { variant: "warning" as const, label: "Eldre enn 24 t" }
        : { variant: "error" as const, label: "STALE — ingen rapport siste 48 t" }
  return (
    <OsCard title={`Briefing — Content Radar ${report.period}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={freshness.variant}>{freshness.label}</Badge>
        <span className="text-[10px] text-[var(--os-text-muted)]">
          Rapport kom {timeLabel(report.created_at)} · {Math.round(reportAgeH)} t siden
        </span>
      </div>
      {b.funn.length === 0 ? (
        <Empty title="Ingen funn i denne rapporten.">
          findings for report_id {report.id.slice(0, 8)}… er tom (pulsen unntatt).
        </Empty>
      ) : (
        <>
          <h4 className="jbm mb-1 text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
            Tre viktigste funn
          </h4>
          <ul className="space-y-1">
            {b.funn.map((f) => (
              <FindingItem key={f.id} f={f} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <RecList tag="Spor A" title="Anniken — personlig / refleksivt" items={b.sporA} />
        <RecList tag="Spor B" title="Detox — mekanisme / utdanning" items={b.sporB} />
      </div>
      <div className="mt-5">
        <RecList tag="Neste steg" title="anbefalinger uten spor-prefiks" items={b.nesteSteg} />
      </div>

      <div className="mt-5 border-t-[0.5px] border-[var(--os-border)] pt-4">
        <RequestButtons period={report.period} />
      </div>

      <Provenance>
        reports/{report.id.slice(0, 8)}… · agent_id={ANAKIN_AGENT_ID} ·
        report_type={RADAR_REPORT_TYPE} · period={report.period} · status={report.status}
        {report.requires_review ? " · requires_review" : ""} · findings {report.findings.length} ·
        recommendations {report.recommendations.length} ({pendingRecs} pending — ja/nei paa
        disse skjer i Telegram, ikke her) · ref {DETOX_PROJECT_REF}
      </Provenance>
    </OsCard>
  )
}

// ── 3. Godkjenningskoe ───────────────────────────────────────────────────────

function QueueBand({
  queue,
  botHref,
}: {
  queue: { ok: true; rows: RequestRow[] } | ReadError
  botHref: string | null
}) {
  const prov = (
    <Provenance>
      requests · status in ({QUEUE_STATUSES.join(", ")}) · alle requester-verdier
      (Anakin skriver som {ANAKIN_AGENT_ID}, eiere som e-post) · ref {DETOX_PROJECT_REF}.
      Godkjenn = done, avvis = cancelled, marker lest = in_progress. Kun status-kolonnen
      endres. Annonseforslag (action_proposals) hoerer til /annonser/forslag, ikke her.
      {botHref
        ? ""
        : " Telegram-bot ikke konfigurert (NEXT_PUBLIC_DETOX_TELEGRAM_BOT) — bruk kopier-knappen."}
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
          Ingen rader i requests med status open eller in_progress. Bruk knappene i
          briefingen for aa be Anakin om noe; Anakin kan ogsaa legge inn egne
          forespoersler her.
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
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status} · fra {r.requester}
                    {p.to ? ` · til ${p.to}` : ""} · {timeLabel(r.created_at)} · id {r.id.slice(0, 8)}…
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--os-text-primary)]">{p.summary}</p>
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

// ── 4. Uken ──────────────────────────────────────────────────────────────────

function WeekBand({
  week,
}: {
  week: { ok: true; items: ContentItem[] } | { ok: false; error: string }
}) {
  const prov = (
    <Provenance>
      content_items · alle rader (tabellen har ingen planlagt dato, saa «neste 7–14
      dager» kan ikke utledes — dette er alt som er under arbeid) · planlagt =
      stage_status complete, blokkert = blocked, venter = pending/needs_research ·
      ref {DETOX_PROJECT_REF}. Dypdykk: /innhold.
    </Provenance>
  )
  if (!week.ok) {
    return (
      <OsCard title="Uken — innhold">
        <ErrorBox err={{ ok: false, error: week.error, code: "other" }} table="content_items" />
        {prov}
      </OsCard>
    )
  }
  const items = week.items
  const buckets: Record<WeekBucket, ContentItem[]> = { planlagt: [], venter: [], blokkert: [] }
  for (const it of items) buckets[weekBucketOf(it.stage_status)].push(it)
  const counts = countByStage(items)

  return (
    <OsCard title={`Uken — innhold (${items.length})`}>
      {items.length === 0 ? (
        <Empty title="Ingen innholdselementer.">
          content_items er tom, eller synken fra detox-vault har ikke kjoert.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(buckets) as WeekBucket[]).map((b) => (
            <div key={b}>
              <h4 className="jbm mb-1 text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                {WEEK_BUCKET_LABELS[b]} · {buckets[b].length}
              </h4>
              {buckets[b].length === 0 ? (
                <p className="jbm px-2 text-[11px] text-[var(--os-text-muted)]">ingen</p>
              ) : (
                <ul className="space-y-1">
                  {buckets[b].map((it) => (
                    <li key={it.id} className="rounded-[var(--os-radius-sm)] px-2 py-1.5 hover:bg-[var(--os-bg-hover)]">
                      <p className="line-clamp-2 text-sm text-[var(--os-text-primary)]">{it.title}</p>
                      <p className="jbm mt-0.5 text-[10px] text-[var(--os-text-muted)]">
                        {STAGE_LABELS[it.stage] ?? it.stage} · {it.stage_status}
                        {it.requested_by ? ` · ${it.requested_by}` : ""} · {it.channels.join(", ") || "ingen kanal"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {items.length > 0 ? (
        <p className="jbm mt-3 text-[10px] text-[var(--os-text-muted)]">
          brief {counts.brief} · draft {counts.draft} · claim-check {counts.claim_check} ·
          voice/kanal {counts.voice_channel}
        </p>
      ) : null}
      {prov}
    </OsCard>
  )
}

// ── Siden ────────────────────────────────────────────────────────────────────

export default async function EierePage() {
  const [radar, runState, queue, week] = await Promise.all([
    fetchLatestRadar(),
    fetchRunState(ANAKIN_AGENT_ID),
    fetchQueue(),
    fetchContentItems(),
  ])
  const botHref = telegramHref(process.env.NEXT_PUBLIC_DETOX_TELEGRAM_BOT)

  return (
    <>
      <div>
        <h1 className="text-lg text-[var(--os-text-primary)] sm:text-xl">Eiere</h1>
        <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
          Puls, briefing, godkjenningskoe og uken — fra Anakins nattlige Content
          Radar. Dashboardet er oversikt og koe; dialogen skjer i Telegram.
        </p>
        <p className="jbm mt-2 text-[10px] text-[var(--os-text-muted)]">
          {runState.ok
            ? runState.state
              ? `run_state · ${ANAKIN_AGENT_ID} · siste vellykkede kjoering ${timeLabel(runState.state.last_successful_run)} · status ${runState.state.last_run_status ?? "ukjent"}${runState.state.last_error ? ` · feil: ${runState.state.last_error}` : ""}`
              : `run_state · ingen rad for ${ANAKIN_AGENT_ID}`
            : `run_state · kunne ikke leses (${runState.code})`}
          {" · "}ref {DETOX_PROJECT_REF}
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {!radar.ok ? (
          <OsCard title="Puls og briefing">
            <ErrorBox err={radar} table="reports / findings / recommendations" />
            <Provenance>
              reports · agent_id={ANAKIN_AGENT_ID} · report_type={RADAR_REPORT_TYPE} ·
              nyeste · ref {DETOX_PROJECT_REF}
            </Provenance>
          </OsCard>
        ) : radar.report === null ? (
          <OsCard title="Puls og briefing">
            <Empty title="Ingen Content Radar fra Anakin i basen.">
              reports har ingen rad med agent_id={ANAKIN_AGENT_ID} og
              report_type={RADAR_REPORT_TYPE} (ref {DETOX_PROJECT_REF}). Nattjobben
              detox-content-radar skriver via rpc/ingest_report kl. 05:30 UTC.
            </Empty>
            <div className="mt-4">
              <RequestButtons period={null} />
            </div>
          </OsCard>
        ) : (
          <>
            <PulsBand report={radar.report} />
            <BriefingBand report={radar.report} />
          </>
        )}

        <QueueBand queue={queue} botHref={botHref} />
        <WeekBand week={week} />
      </div>
    </>
  )
}
