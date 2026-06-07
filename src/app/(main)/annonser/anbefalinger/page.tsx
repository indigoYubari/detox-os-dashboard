"use client"

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  getRecommendations,
  type Recommendation,
  type RecommendationsResponse,
  type RecommendationStatus,
} from "@/lib/detox-api"
import {
  CHANNEL_LABELS as CHANNEL_LABEL,
  SEVERITY,
  TYPE_LABEL,
  labelFor,
  metricPairs,
} from "@/lib/ad-format"
import { cx } from "@/lib/utils"

// ── severity tabs ─────────────────────────────────────────────
type SeverityFilter = "all" | "critical" | "warning" | "info"
const SEVERITY_TABS: { key: SeverityFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "critical", label: "Kritisk" },
  { key: "warning", label: "Advarsel" },
  { key: "info", label: "Info" },
]

type SortKey = "severity" | "newest"

export default function AnbefalingerPage() {
  const [status, setStatus] = useState<RecommendationStatus>("open")
  const [severity, setSeverity] = useState<SeverityFilter>("all")
  const [channel, setChannel] = useState<string>("all")
  const [sort, setSort] = useState<SortKey>("severity")

  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Fetch by status only; severity + channel are filtered client-side so the
  // counts (computed by the backend over the status set) stay stable across
  // tab/pill clicks.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getRecommendations({ status, limit: 500 })
      .then((res) => {
        if (cancelled) return
        setData(res)
        setChannel("all") // available channels change with status
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message ?? "Kunne ikke laste anbefalinger")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const notifySoon = useCallback(() => setToast("Kommer snart"), [])

  const counts = data?.counts
  const severityCount = (key: SeverityFilter) =>
    key === "all" ? (counts?.total ?? 0) : (counts?.bySeverity?.[key] ?? 0)

  const channelEntries = useMemo(
    () => Object.entries(counts?.byChannel ?? {}).sort((a, b) => b[1] - a[1]),
    [counts],
  )

  const visible = useMemo(() => {
    let list = data?.recommendations ?? []
    if (severity !== "all") list = list.filter((r) => r.severity === severity)
    if (channel !== "all") list = list.filter((r) => r.channel === channel)
    if (sort === "newest") {
      list = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    }
    return list
  }, [data, severity, channel, sort])

  return (
    <div>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Anbefalinger
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Forslag fra anbefalingsmotoren — validert mot Shopify-omsetning
        </p>
      </div>

      {/* Severity tabs */}
      <div className="mt-6 border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6" aria-label="Alvorlighet">
          {SEVERITY_TABS.map((tab) => {
            const active = severity === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSeverity(tab.key)}
                className={cx(
                  "flex items-center gap-2 border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-indigo-500 text-gray-900 dark:border-indigo-400 dark:text-gray-50"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                {tab.label}
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                  )}
                >
                  {severityCount(tab.key)}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Filter bar */}
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
              {labelFor(CHANNEL_LABEL, ch)}
              <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
            </ChannelPill>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as RecommendationStatus)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Åpne</SelectItem>
              <SelectItem value="resolved">Behandlet</SelectItem>
              <SelectItem value="dismissed">Avvist</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sortering" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="severity">Alvorlighet</SelectItem>
              <SelectItem value="newest">Nyeste først</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingen anbefalinger med valgte filtre
            </p>
          </div>
        ) : (
          visible.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} onResolve={notifySoon} />
          ))
        )}
      </div>

      {/* Toast */}
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

// ── subcomponents ─────────────────────────────────────────────
function ChannelPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
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

function RecommendationCard({
  rec,
  onResolve,
}: {
  rec: Recommendation
  onResolve: () => void
}) {
  const sev = SEVERITY[rec.severity] ?? {
    label: rec.severity,
    variant: "default" as const,
  }
  const pairs = metricPairs(rec)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={sev.variant}>{sev.label}</Badge>
            <Badge variant="neutral">
              {labelFor(CHANNEL_LABEL, rec.channel)}
            </Badge>
            <Badge variant="neutral">{labelFor(TYPE_LABEL, rec.type)}</Badge>
          </div>

          <h3
            title={rec.title}
            className="mt-2.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-50"
          >
            {rec.title}
          </h3>

          {rec.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {rec.description}
            </p>
          )}

          {pairs.length > 0 && (
            <p className="mt-2.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {pairs.join("  ·  ")}
            </p>
          )}
        </div>

        <div className="shrink-0">
          <Button
            variant="secondary"
            onClick={onResolve}
            className="whitespace-nowrap text-xs"
            title="Kommer snart"
          >
            Merk som behandlet
          </Button>
        </div>
      </div>
    </div>
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
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </>
  )
}
