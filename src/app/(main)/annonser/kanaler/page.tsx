"use client"

import React from "react"
import { subDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { Filterbar } from "@/components/ui/overview/DashboardFilterbar"
import { StatTooltip } from "@/components/ui/StatTooltip"
import {
  getMetrics,
  type ChannelMetrics,
  type ChannelTypeBreakdown,
  type DeltaValue,
  type MetricsResponse,
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
function pctLabel(pct: number | null, dir: string) {
  const sign = dir === "up" ? "↑" : dir === "down" ? "↓" : "→"
  if (pct == null) return sign
  return `${sign} ${Math.abs(pct).toFixed(1)}%`
}
function deltaClass(dir: string) {
  return dir === "up"
    ? "text-green-600 dark:text-green-400"
    : dir === "down"
      ? "text-red-500 dark:text-red-400"
      : "text-gray-400"
}

// ── constants ─────────────────────────────────────────────────
// Reused from Overview for visual consistency.
const LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta: "Meta",
  klaviyo: "Klaviyo",
  shopify: "Shopify",
}
const DOT_COLORS: Record<string, string> = {
  google_ads: "bg-blue-500",
  meta: "bg-indigo-500",
  klaviyo: "bg-yellow-500",
  shopify: "bg-green-500",
}
// Display order requested for the detailed cards.
const CHANNEL_ORDER: string[] = ["klaviyo", "shopify", "google_ads", "meta"]

const ENTITY_LABELS: Record<string, string> = {
  campaign: "Kampanje",
  ad_group: "Annonsegruppe",
  ad: "Annonse",
  keyword: "Søkeord",
  flow: "Flow",
  segment: "Segment",
  order: "Ordre",
  product: "Produkt",
  customer_segment: "Kundesegment",
  ukjent: "Ukjent",
}
const entityLabel = (key: string) =>
  ENTITY_LABELS[key] ?? key.replace(/_/g, " ")

// ── component ─────────────────────────────────────────────────
export default function KanalerPage() {
  const today = new Date()
  const [selectedDates, setSelectedDates] = React.useState<DateRange | undefined>({
    from: subDays(today, 30),
    to: today,
  })
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const since = selectedDates?.from ? format(selectedDates.from, "yyyy-MM-dd") : undefined
    const until = selectedDates?.to ? format(selectedDates.to, "yyyy-MM-dd") : undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    getMetrics(since, until)
      .then((m) => {
        if (cancelled) return
        setMetrics(m)
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

  // Order channels per CHANNEL_ORDER; append any unexpected channels last.
  const channels = React.useMemo(() => {
    const list = metrics?.channels ?? []
    return [...list].sort((a, b) => {
      const ia = CHANNEL_ORDER.indexOf(a.channel)
      const ib = CHANNEL_ORDER.indexOf(b.channel)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [metrics])

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Kanaler
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detaljert ytelse per kanal — med fordeling på entitetstype
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

      {/* ── Channel cards ── */}
      <div className="mt-8 space-y-6">
        {loading ? (
          <>
            <ChannelSkeleton />
            <ChannelSkeleton />
          </>
        ) : !error && channels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingen kanaldata for valgt periode
            </p>
          </div>
        ) : (
          channels.map((ch) => (
            <ChannelCard
              key={ch.channel}
              channel={ch}
              comparison={metrics?.comparison?.channels?.[ch.channel]}
            />
          ))
        )}
      </div>
    </>
  )
}

// ── channel card ──────────────────────────────────────────────
type ChannelComparison = {
  spend: DeltaValue
  revenue: DeltaValue
  conversions: DeltaValue
  roas: DeltaValue
}

function ChannelCard({
  channel,
  comparison,
}: {
  channel: ChannelMetrics
  comparison?: ChannelComparison
}) {
  const headline: {
    label: string
    value: string
    delta?: DeltaValue
    tooltip?: string
  }[] = [
    { label: "Spend", value: kr(channel.spend), delta: comparison?.spend, tooltip: "Totalt annonseforbruk pa denne kanalen i valgt periode." },
    { label: "Omsetning", value: kr(channel.revenue), delta: comparison?.revenue, tooltip: "Omsetning tilskrevet denne kanalen. Kan inkludere plattformens egen attribusjon." },
    { label: "ROAS", value: roasLabel(channel.roas), delta: comparison?.roas, tooltip: "Return on Ad Spend: omsetning delt pa forbruk. Over 3x er bra for detox.no." },
    {
      label: "Konverteringer",
      value: num(channel.conversions),
      delta: comparison?.conversions,
      tooltip: "Antall kjop eller malehandlinger registrert av plattformen.",
    },
    { label: "Klikk", value: num(channel.clicks), tooltip: "Antall klikk pa annonser i perioden." },
    { label: "Visninger", value: num(channel.impressions), tooltip: "Antall ganger annonsene er vist til brukere." },
  ]

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      {/* header */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLORS[channel.channel] ?? "bg-gray-400"}`}
        />
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {LABELS[channel.channel] ?? channel.channel}
        </h2>
      </div>

      {/* headline metrics */}
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {headline.map((m) => (
          <div key={m.label}>
            <p className="text-xs text-gray-400">
              {m.tooltip ? <StatTooltip explanation={m.tooltip}>{m.label}</StatTooltip> : m.label}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50">
              {m.value}
            </p>
            {m.delta && (
              <p className={`mt-0.5 text-xs tabular-nums ${deltaClass(m.delta.dir)}`}>
                {pctLabel(m.delta.pct, m.delta.dir)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* entity-type breakdown */}
      <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Fordeling på entitetstype
        </h3>
        {channel.byType.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">Ingen entitetsdata</p>
        ) : (
          <BreakdownTable rows={channel.byType} />
        )}
      </div>
    </section>
  )
}

function BreakdownTable({ rows }: { rows: ChannelTypeBreakdown[] }) {
  const sorted = [...rows].sort((a, b) => b.spend - a.spend || b.revenue - a.revenue)
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-400 dark:border-gray-800">
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 text-right font-medium">Rader</th>
            <th className="py-2 pr-4 text-right font-medium">Spend</th>
            <th className="py-2 pr-4 text-right font-medium">Omsetning</th>
            <th className="py-2 text-right font-medium">Konverteringer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {sorted.map((r) => (
            <tr key={r.entity_type}>
              <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                {entityLabel(r.entity_type)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-gray-600 dark:text-gray-400">
                {num(r.rows)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-gray-900 dark:text-gray-50">
                {kr(r.spend)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-gray-900 dark:text-gray-50">
                {kr(r.revenue)}
              </td>
              <td className="py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                {num(r.conversions)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── skeleton ──────────────────────────────────────────────────
function ChannelSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-5">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
        <div className="h-px w-full bg-gray-100 dark:bg-gray-800" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    </div>
  )
}
