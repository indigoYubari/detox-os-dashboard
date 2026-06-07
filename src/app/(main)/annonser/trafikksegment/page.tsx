"use client"

import React from "react"
import { subDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { Filterbar } from "@/components/ui/overview/DashboardFilterbar"
import { ProgressBar } from "@/components/ProgressBar"
import {
  getMetrics,
  type MetricsResponse,
  type TrafficSegment,
} from "@/lib/detox-api"

// ── helpers ──────────────────────────────────────────────────
function kr(n: number) {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}
function num(n: number) {
  return n.toLocaleString("nb-NO")
}
function roasLabel(n: number | null) {
  return n == null ? "—" : `${n.toFixed(2)}x`
}
function roasTextClass(n: number | null) {
  if (n == null) return "text-gray-400"
  if (n >= 4) return "text-emerald-600 dark:text-emerald-400"
  if (n >= 1) return "text-yellow-600 dark:text-yellow-500"
  return "text-red-600 dark:text-red-400"
}

type BarTone = "success" | "warning" | "error" | "neutral"
function roasTone(n: number | null): BarTone {
  if (n == null) return "neutral"
  if (n >= 4) return "success"
  if (n >= 1) return "warning"
  return "error"
}

// Segment keys (campaign-name prefixes) → Norwegian labels + short tag.
const SEGMENT_LABELS: Record<string, { title: string; tag: string }> = {
  COLD: { title: "Kald trafikk", tag: "Kald" },
  WARM: { title: "Varm trafikk", tag: "Varm" },
  EMAIL: { title: "E-post", tag: "E-post" },
}
function segmentTitle(key: string) {
  return SEGMENT_LABELS[key]?.title ?? key
}
function segmentTag(key: string) {
  return SEGMENT_LABELS[key]?.tag ?? key
}

// Compare view: which metric the bars rank segments on.
type CompareMetric = "roas" | "spend" | "revenue"
const COMPARE_OPTIONS: { key: CompareMetric; label: string }[] = [
  { key: "roas", label: "ROAS" },
  { key: "spend", label: "Spend" },
  { key: "revenue", label: "Omsetning" },
]
function compareValue(s: TrafficSegment, metric: CompareMetric): number {
  if (metric === "roas") return s.roas ?? 0
  return s[metric]
}
function compareLabel(s: TrafficSegment, metric: CompareMetric): string {
  if (metric === "roas") return roasLabel(s.roas)
  return kr(s[metric])
}

// ── component ─────────────────────────────────────────────────
export default function TrafikksegmentPage() {
  const today = new Date()
  const [selectedDates, setSelectedDates] = React.useState<
    DateRange | undefined
  >({
    from: subDays(today, 30),
    to: today,
  })
  const [data, setData] = React.useState<MetricsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [metric, setMetric] = React.useState<CompareMetric>("roas")

  React.useEffect(() => {
    const since = selectedDates?.from
      ? format(selectedDates.from, "yyyy-MM-dd")
      : undefined
    const until = selectedDates?.to
      ? format(selectedDates.to, "yyyy-MM-dd")
      : undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    getMetrics(since, until)
      .then((d) => {
        if (cancelled) return
        setData(d)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message ?? "Feil ved lasting av data")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDates])

  const segments = data?.segments ?? []

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Trafikksegment
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ytelse per trafikk-type — kald, varm, e-post
          </p>
        </div>
        <Filterbar
          maxDate={today}
          minDate={new Date(2024, 0, 1)}
          selectedDates={selectedDates}
          onDatesChange={(dates) => setSelectedDates(dates)}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <SegmentSkeleton />
          <SegmentSkeleton />
          <SegmentSkeleton />
        </div>
      ) : !error && segments.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ingen trafikksegmenter for valgt periode
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Segmenter utledes fra kampanjenavn med [COLD], [WARM] eller [EMAIL].
          </p>
        </div>
      ) : (
        <>
          {/* ── Segment cards ── */}
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {segments.map((s) => (
              <SegmentCard key={s.segment} segment={s} />
            ))}
          </div>

          {/* ── Comparison ── */}
          {segments.length >= 2 && (
            <ComparisonPanel
              segments={segments}
              metric={metric}
              onMetricChange={setMetric}
            />
          )}
        </>
      )}
    </>
  )
}

// ── segment card ──────────────────────────────────────────────
function SegmentCard({ segment: s }: { segment: TrafficSegment }) {
  const metrics: { label: string; value: string; className?: string }[] = [
    { label: "Spend", value: kr(s.spend) },
    { label: "Omsetning", value: kr(s.revenue) },
    {
      label: "ROAS",
      value: roasLabel(s.roas),
      className: roasTextClass(s.roas),
    },
    { label: "Konverteringer", value: num(s.conversions) },
    { label: "Rader", value: num(s.rows) },
  ]

  return (
    <section className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          {segmentTitle(s.segment)}
        </h2>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {segmentTag(s.segment)}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <dt className="text-xs text-gray-400">{m.label}</dt>
            <dd
              className={`mt-1 text-sm font-semibold tabular-nums ${
                m.className ?? "text-gray-900 dark:text-gray-50"
              }`}
            >
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ── comparison panel ──────────────────────────────────────────
function ComparisonPanel({
  segments,
  metric,
  onMetricChange,
}: {
  segments: TrafficSegment[]
  metric: CompareMetric
  onMetricChange: (m: CompareMetric) => void
}) {
  const ranked = [...segments].sort(
    (a, b) => compareValue(b, metric) - compareValue(a, metric),
  )
  const max = Math.max(...ranked.map((s) => compareValue(s, metric)), 0)

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Sammenligning
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Hvilken trafikk-type presterer best
          </p>
        </div>
        <MetricToggle value={metric} onChange={onMetricChange} />
      </div>

      <div className="mt-5 space-y-4">
        {ranked.map((s) => {
          const value = compareValue(s, metric)
          const pct = max > 0 ? (value / max) * 100 : 0
          return (
            <div key={s.segment}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {segmentTitle(s.segment)}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    metric === "roas"
                      ? roasTextClass(s.roas)
                      : "text-gray-900 dark:text-gray-50"
                  }`}
                >
                  {compareLabel(s, metric)}
                </span>
              </div>
              <ProgressBar
                value={pct}
                max={100}
                variant={metric === "roas" ? roasTone(s.roas) : "default"}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MetricToggle({
  value,
  onChange,
}: {
  value: CompareMetric
  onChange: (m: CompareMetric) => void
}) {
  return (
    <div
      role="group"
      aria-label="Velg sammenligningsmål"
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-900"
    >
      {COMPARE_OPTIONS.map((opt) => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={
              active
                ? "rounded-md bg-white px-3 py-1 text-xs font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                : "rounded-md px-3 py-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── skeleton ──────────────────────────────────────────────────
function SegmentSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-12 rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-14 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
