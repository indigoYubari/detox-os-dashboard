"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import {
  approveProposal,
  getProposalExecutionMode,
  getProposals,
  rejectProposal,
  type Proposal,
  type ProposalDecisionResponse,
  type ProposalExecutionResult,
  type ProposalExecutionModeResponse,
  type ProposalsResponse,
} from "@/lib/detox-api"
import {
  CHANNEL_LABELS,
  SEVERITY,
  TYPE_LABEL,
  kr,
  labelFor,
  roasLabel,
} from "@/lib/ad-format"
import { cx } from "@/lib/utils"

type PriorityFilter = "all" | "critical" | "warning" | "info"
type MainTab = "pending" | "history"

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: "pending", label: "Venter" },
  { key: "history", label: "Historikk" },
]

const PRIORITY_TABS: { key: PriorityFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "critical", label: "Kritisk" },
  { key: "warning", label: "Advarsel" },
  { key: "info", label: "Info" },
]

const STATUS_LABEL: Record<string, string> = {
  pending: "Venter",
  approved: "Godkjent",
  rejected: "Avvist",
}

const EXECUTION_LABEL: Record<string, string> = {
  dry_run: "Dry-run",
  done: "Utført",
  failed: "Feilet",
  skipped: "Hoppet over",
}

export default function ForslagPage() {
  const [tab, setTab] = useState<MainTab>("pending")
  const [priority, setPriority] = useState<PriorityFilter>("all")
  const [channel, setChannel] = useState("all")
  const [data, setData] = useState<ProposalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionMode, setExecutionMode] = useState<
    ProposalExecutionModeResponse["proposalExecution"] | null
  >(null)
  const [executionModeError, setExecutionModeError] = useState<string | null>(
    null,
  )
  const [executionModeLoading, setExecutionModeLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setExecutionModeLoading(true)
    getProposalExecutionMode()
      .then((res) => {
        if (cancelled) return
        setExecutionMode(res.proposalExecution)
        setExecutionModeError(null)
        setExecutionModeLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setExecutionMode(null)
        setExecutionModeError(e.message ?? "Kunne ikke sjekke execution-modus")
        setExecutionModeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // Venter henter kun pending. Historikk henter alt og filtreres client-side
    // til status !== "pending" (API har ingen egen "decided"-param).
    getProposals({ status: tab === "pending" ? "pending" : "all", limit: 500 })
      .then((res) => {
        if (cancelled) return
        setData(res)
        setChannel("all")
        setPriority("all")
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message ?? "Kunne ikke laste forslag")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const baseList = useMemo(() => {
    const all = data?.proposals ?? []
    return tab === "history" ? all.filter((p) => p.status !== "pending") : all
  }, [data, tab])

  const counts = useMemo(() => computeCounts(baseList), [baseList])
  const priorityCount = (key: PriorityFilter) =>
    key === "all" ? counts.total : (counts.byPriority[key] ?? 0)

  const channelEntries = useMemo(
    () => Object.entries(counts.byChannel).sort((a, b) => b[1] - a[1]),
    [counts],
  )

  const visible = useMemo(() => {
    let list = baseList
    if (priority !== "all") list = list.filter((p) => p.priority === priority)
    if (channel !== "all") list = list.filter((p) => p.channel === channel)
    const byRecency = (a: Proposal, b: Proposal) =>
      (b.decided_at ?? b.created_at) > (a.decided_at ?? a.created_at) ? 1 : -1
    return [...list].sort(
      tab === "history"
        ? byRecency
        : (a, b) =>
            priorityRank(a.priority) - priorityRank(b.priority) ||
            byRecency(a, b),
    )
  }, [baseList, priority, channel, tab])

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id)
    setError(null)
    try {
      const res =
        action === "approve"
          ? await approveProposal(id)
          : await rejectProposal(id)
      setData((prev) => mergeDecision(prev, id, res))
      setToast(action === "approve" ? "Forslag godkjent" : "Forslag avvist")
    } catch (e) {
      setError(
        `Kunne ikke ${action === "approve" ? "godkjenne" : "avvise"}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Handlingsforslag
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Godkjennbare forslag fra ad-agenten. Live-eksekvering styres av
            Railway-flagget, default er dry-run.
          </p>
        </div>
        <ExecutionModeBanner
          mode={executionMode}
          error={executionModeError}
          loading={executionModeLoading}
        />
      </div>

      <div className="mt-6 flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
        {MAIN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cx(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6" aria-label="Prioritet">
          {PRIORITY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPriority(tab.key)}
              className={cx(
                "flex items-center gap-2 border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors",
                priority === tab.key
                  ? "border-indigo-500 text-gray-900 dark:border-indigo-400 dark:text-gray-50"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              )}
            >
              {tab.label}
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {priorityCount(tab.key)}
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelPill
            active={channel === "all"}
            onClick={() => setChannel("all")}
          >
            Alle kanaler
          </ChannelPill>
          {channelEntries.map(([ch, n]) => (
            <ChannelPill
              key={ch}
              active={channel === ch}
              onClick={() => setChannel(ch)}
            >
              {labelFor(CHANNEL_LABELS, ch)}
              <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
            </ChannelPill>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <SkeletonList />
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tab === "history"
                ? "Ingen forslag i historikken ennå"
                : "Ingen forslag med valgte filtre"}
            </p>
          </div>
        ) : (
          visible.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              busy={busyId === proposal.id}
              onApprove={() => decide(proposal.id, "approve")}
              onReject={() => decide(proposal.id, "reject")}
            />
          ))
        )}
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-md bg-gray-900 px-3.5 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-50 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function ExecutionModeBanner({
  mode,
  error,
  loading,
}: {
  mode: ProposalExecutionModeResponse["proposalExecution"] | null
  error: string | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        Sjekker execution-modus
      </div>
    )
  }

  if (error || !mode) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
        Modus ukjent. Sjekk Railway før godkjenning.
      </div>
    )
  }

  if (mode.enabled) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        Live handlinger PÅ. Godkjenning kan endre annonser.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
      Dry-run aktiv. Godkjenning markerer forslag, men endrer ikke annonser.
    </div>
  )
}

function ProposalCard({
  proposal,
  busy,
  onApprove,
  onReject,
}: {
  proposal: Proposal
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const sev = SEVERITY[proposal.priority] ?? {
    label: proposal.priority,
    variant: "default" as const,
  }
  const statusVariant =
    proposal.status === "approved"
      ? "success"
      : proposal.status === "rejected"
        ? "error"
        : "neutral"
  const execution = proposal.execution_status
  const executionVariant =
    execution === "done"
      ? "success"
      : execution === "failed"
        ? "error"
        : execution === "dry_run"
          ? "warning"
          : "neutral"

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={sev.variant}>{sev.label}</Badge>
        {proposal.status !== "pending" && (
          <Badge variant={statusVariant}>
            {STATUS_LABEL[proposal.status] ?? proposal.status}
          </Badge>
        )}
        <Badge variant="neutral">
          {labelFor(CHANNEL_LABELS, proposal.channel)}
        </Badge>
        <Badge variant="neutral">{proposalDisplayName(proposal)}</Badge>
        <Badge variant="neutral">
          {labelFor(TYPE_LABEL, proposal.recommendation_type)}
        </Badge>
      </div>

      <h3 className="mt-3 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-50">
        {proposal.suggested_action}
      </h3>

      {proposal.ai_analysis && (
        <p className="mt-3 rounded-md bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:bg-gray-950 dark:text-gray-300">
          <span className="font-semibold">AI:</span> {proposal.ai_analysis}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
        <span>ROAS: {roasLabel(proposal.current_roas)}</span>
        <span>
          Forbruk:{" "}
          {proposal.current_spend == null ? "—" : kr(proposal.current_spend)}
        </span>
        <span>Status: {STATUS_LABEL[proposal.status] ?? proposal.status}</span>
      </div>

      {execution && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          <Badge variant={executionVariant}>
            {EXECUTION_LABEL[execution] ?? execution}
          </Badge>
          <span>{executionSummary(proposal.execution_result)}</span>
          {proposal.executed_at && (
            <span>{formatWhen(proposal.executed_at)}</span>
          )}
          {proposal.execution_result?.error && (
            <span className="text-red-600 dark:text-red-400">
              {proposal.execution_result.error}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {proposal.status === "pending" ? (
          <>
            <Button
              type="button"
              onClick={onApprove}
              isLoading={busy}
              loadingText="Godkjenner"
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              Godkjenn
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onReject}
              disabled={busy}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Avvis
            </Button>
          </>
        ) : (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {STATUS_LABEL[proposal.status] ?? proposal.status}
            {proposal.decided_by ? ` · ${proposal.decided_by}` : ""}
            {proposal.decided_at ? ` · ${formatWhen(proposal.decided_at)}` : ""}
          </span>
        )}
      </div>
    </div>
  )
}

function ChannelPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-gray-900 text-white ring-gray-900 dark:bg-gray-50 dark:text-gray-900 dark:ring-gray-50"
          : "bg-white text-gray-600 ring-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-950 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-900",
      )}
    >
      {children}
    </button>
  )
}

function SkeletonList() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="animate-pulse space-y-3">
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-4 w-4/5 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-16 rounded bg-gray-100 dark:bg-gray-950" />
          </div>
        </div>
      ))}
    </>
  )
}

function computeCounts(list: Proposal[]) {
  const byPriority: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  for (const p of list) {
    byPriority[p.priority] = (byPriority[p.priority] ?? 0) + 1
    byChannel[p.channel] = (byChannel[p.channel] ?? 0) + 1
  }
  return { total: list.length, byPriority, byChannel }
}

function priorityRank(priority: string) {
  if (priority === "critical") return 0
  if (priority === "warning") return 1
  if (priority === "info") return 2
  return 9
}

function proposalDisplayName(proposal: Proposal) {
  if (proposal.entity_name) return proposal.entity_name
  const quoted = proposal.suggested_action.match(/«([^»]+)»/)?.[1]
  return quoted ?? proposal.entity_id ?? proposal.entity_type
}

function executionSummary(result: ProposalExecutionResult | null) {
  const action = result?.intendedAction
  if (!action) return "Ingen eksekveringsdetaljer"
  const operation =
    action.operation === "increase_budget"
      ? "Øk budsjett"
      : action.operation === "pause"
        ? "Pause"
        : "Ingen handling"
  const target =
    action.target ?? action.entityType ?? action.channel ?? "ukjent"
  const pct = action.maxBudgetChangePctPerDay
    ? ` · maks ${action.maxBudgetChangePctPerDay}%`
    : ""
  return `${operation} · ${target}${pct}`
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(new Date(iso))
}

function mergeDecision(
  data: ProposalsResponse | null,
  id: string,
  decision: ProposalDecisionResponse,
): ProposalsResponse | null {
  if (!data) return data
  const status = executionStatusFromResponse(decision.execution)
  const nextProposal = {
    ...decision.proposal,
    ...(status
      ? {
          execution_status: status,
          execution_result: decision.execution ?? null,
          executed_at: new Date().toISOString(),
        }
      : {}),
  }
  return {
    ...data,
    proposals: data.proposals.map((p) => (p.id === id ? nextProposal : p)),
  }
}

function executionStatusFromResponse(result?: ProposalExecutionResult) {
  if (!result) return null
  if (result.dryRun) return "dry_run" as const
  if (result.done) return "done" as const
  if (result.failed) return "failed" as const
  if (result.skipped) return "skipped" as const
  return null
}
