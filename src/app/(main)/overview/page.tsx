"use client"

import React from "react"
import { subDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { Filterbar } from "@/components/ui/overview/DashboardFilterbar"
import { LineChart } from "@/components/LineChart"
import {
  getMetrics,
  getRecommendations,
  getTrend,
  MetricsResponse,
  RecommendationsResponse,
  TrendResponse,
} from "@/lib/detox-api"

// ── helpers ──────────────────────────────────────────────────
function kr(n: number) {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}
function roasLabel(n: number) {
  return `${n.toFixed(2)}x`
}
function pctLabel(pct: number | null, dir: string) {
  if (pct == null) return null
  const sign = dir === "up" ? "↑" : dir === "down" ? "↓" : "→"
  return `${sign} ${Math.abs(pct).toFixed(1)}%`
}

// ── constants ─────────────────────────────────────────────────
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
const SEV_CLASSES: Record<string, string> = {
  critical: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
  warning: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
}
const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
}

// ── component ─────────────────────────────────────────────────
export default function Overview() {
  const today = new Date()
  const [selectedDates, setSelectedDates] = React.useState<DateRange | undefined>({
    from: subDays(today, 30),
    to: today,
  })
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null)
  const [recs, setRecs] = React.useState<RecommendationsResponse | null>(null)
  const [trend, setTrend] = React.useState<TrendResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const since = selectedDates?.from ? format(selectedDates.from, "yyyy-MM-dd") : undefined
    const until = selectedDates?.to ? format(selectedDates.to, "yyyy-MM-dd") : undefined
    setLoading(true)
    setError(null)
    Promise.all([
      getMetrics(since, until),
      getRecommendations(5),
      getTrend(since, until),
    ])
      .then(([m, r, t]) => {
        setMetrics(m)
        setRecs(r)
        setTrend(t)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message ?? "Feil ved lasting av data")
        setLoading(false)
      })
  }, [selectedDates])

  // ── derived ──────────────────────────────────────────────────
  const shopify = metrics?.channels.find((c) => c.channel === "shopify")
  const adChannels = metrics?.channels.filter((c) =>
    ["google_ads", "meta", "klaviyo"].includes(c.channel),
  ) ?? []
  const totalRevenue = shopify?.revenue ?? 0
  const totalSpend = metrics?.totals?.spend ?? 0
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  const topRecs = [
    ...(recs?.recommendations.filter((r) => r.severity === "critical") ?? []),
    ...(recs?.recommendations.filter((r) => r.severity === "warning") ?? []),
  ].slice(0, 4)

  const trendData =
    trend?.series?.map((pt) => ({
      date: pt.date?.substring(5) ?? "",
      title: pt.date ?? "",
      formattedDate: pt.date
        ? new Date(pt.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
        : "",
      previousFormattedDate: "",
      "Google Ads":
        typeof pt.google_ads_roas === "number" ? +pt.google_ads_roas.toFixed(2) : null,
      Klaviyo: typeof pt.klaviyo_roas === "number" ? +pt.klaviyo_roas.toFixed(2) : null,
    })) ?? []

  const roasCardColor =
    overallRoas >= 4
      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
      : overallRoas > 0 && overallRoas < 1
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
  const roasTextColor =
    overallRoas >= 4
      ? "text-green-700 dark:text-green-300"
      : overallRoas > 0 && overallRoas < 1
        ? "text-red-700 dark:text-red-300"
        : "text-yellow-700 dark:text-yellow-300"

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            detox.OS — Oversikt
          </h1>
          {metrics?.lastSync && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sist synkronisert:{" "}
              {new Date(metrics.lastSync).toLocaleString("nb-NO", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
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

      {/* ── KPI Summary ── */}
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Omsetning (Shopify)</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {loading ? "…" : kr(totalRevenue)}
            </p>
            {metrics?.comparison?.totals?.revenue && (
              <p
                className={`mt-1 text-xs ${
                  metrics.comparison.totals.revenue.dir === "up"
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {pctLabel(
                  metrics.comparison.totals.revenue.pct,
                  metrics.comparison.totals.revenue.dir,
                )}{" "}
                vs forrige periode
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total annonsespend</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {loading ? "…" : kr(totalSpend)}
            </p>
            {metrics?.comparison?.totals?.spend && (
              <p className="mt-1 text-xs text-gray-400">
                {pctLabel(
                  metrics.comparison.totals.spend.pct,
                  metrics.comparison.totals.spend.dir,
                )}{" "}
                vs forrige periode
              </p>
            )}
          </div>

          <div className={`rounded-lg border p-6 ${roasCardColor}`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">Validert ROAS</p>
            <p className={`mt-2 text-2xl font-semibold ${roasTextColor}`}>
              {loading ? "…" : roasLabel(overallRoas)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Shopify-attribuert ÷ ad-spend</p>
          </div>
        </div>
      </section>

      {/* ── Channel Cards ── */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Kanaler</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="text-sm text-gray-400">Laster kanaldata…</p>
          ) : (
            adChannels.map((ch) => {
              const channelRoas = ch.spend > 0 ? ch.revenue / ch.spend : 0
              const chComp = metrics?.comparison?.channels?.[ch.channel]
              return (
                <div
                  key={ch.channel}
                  className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLORS[ch.channel]}`}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {LABELS[ch.channel]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-y-3">
                    <div>
                      <p className="text-xs text-gray-400">Spend</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {kr(ch.spend)}
                      </p>
                      {chComp?.spend && (
                        <p className="text-xs text-gray-400">
                          {pctLabel(chComp.spend.pct, chComp.spend.dir)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {kr(ch.revenue)}
                      </p>
                      {chComp?.revenue && (
                        <p
                          className={`text-xs ${
                            chComp.revenue.dir === "up" ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {pctLabel(chComp.revenue.pct, chComp.revenue.dir)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">ROAS</p>
                      <p
                        className={`text-sm font-semibold ${
                          channelRoas >= 4
                            ? "text-green-600"
                            : channelRoas > 0 && channelRoas < 1
                              ? "text-red-600"
                              : "text-gray-900 dark:text-gray-50"
                        }`}
                      >
                        {roasLabel(channelRoas)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Konverteringer</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {ch.conversions}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── ROAS Trend + Recommendations ── */}
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            ROAS-trend
          </h2>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            {!loading && trendData.length > 0 ? (
              <LineChart
                data={trendData}
                index="date"
                categories={["Google Ads", "Klaviyo"]}
                colors={["blue", "amber"]}
                valueFormatter={(v) => `${v.toFixed(2)}x`}
                showTooltip={false}
                className="h-52"
              />
            ) : (
              <p className="py-16 text-center text-sm text-gray-400">
                {loading ? "Laster…" : "Ingen trenddata"}
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Anbefalinger
            </h2>
            {recs && (
              <span className="text-sm text-gray-500">{recs.counts.total} åpne</span>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-gray-400">Laster…</p>
            ) : topRecs.length === 0 ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Ingen kritiske anbefalinger akkurat nå.
                </p>
              </div>
            ) : (
              topRecs.map((rec) => (
                <div
                  key={rec.id}
                  className={`rounded-lg border p-4 ${SEV_CLASSES[rec.severity]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {LABELS[rec.channel] ?? rec.channel}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                        {rec.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                        {rec.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SEV_BADGE[rec.severity]}`}
                    >
                      {rec.severity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  )
}
