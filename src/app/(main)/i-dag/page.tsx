"use client"

import React from "react"
import { format, subDays } from "date-fns"
import { Headphones, Megaphone, Receipt, Store } from "lucide-react"

import { siteConfig } from "@/app/siteConfig"
import {
  getMetrics,
  getRecommendations,
  type DeltaValue,
  type MetricsResponse,
  type Recommendation,
} from "@/lib/detox-api"

import {
  ChangesSection,
  ChangesSkeleton,
} from "@/components/i-dag/ChangesSection"
import { KpiCard, KpiCardSkeleton } from "@/components/i-dag/KpiCard"
import {
  PriorityCard,
  PriorityEmpty,
  PrioritySkeleton,
} from "@/components/i-dag/PriorityCard"
import { ShortcutCard } from "@/components/i-dag/ShortcutCard"
import {
  kr,
  lastSyncLabel,
  longNorwegianDate,
  makeDelta,
  num,
  previousFrom,
  roasLabel,
  roasTone,
} from "@/components/i-dag/format"

// Snapshot window — 30 days, matching Oversikt and the Annonser pages. The
// backend's comparison covers the immediately preceding 30-day period.
const WINDOW_DAYS = 30

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

// Critical first, then warning, then info; newest wins within a tier.
function pickPriority(recs: Recommendation[]): Recommendation | null {
  if (recs.length === 0) return null
  return [...recs].sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 99
    const rb = SEVERITY_RANK[b.severity] ?? 99
    if (ra !== rb) return ra - rb
    return a.created_at < b.created_at ? 1 : -1
  })[0]
}

const SHORTCUTS = [
  {
    name: "Annonser",
    description: "Kampanjer, ROAS og anbefalinger på tvers av kanaler.",
    href: siteConfig.baseLinks.annonser,
    icon: Megaphone,
  },
  {
    name: "Butikk",
    description: "Produkter, ordrer og lager i Shopify.",
    href: siteConfig.baseLinks.butikk,
    icon: Store,
  },
  {
    name: "Kundeservice",
    description: "Henvendelser og oppfølging fra kunder.",
    href: siteConfig.baseLinks.kundeservice,
    icon: Headphones,
  },
  {
    name: "Økonomi",
    description: "Regnskap, fakturaer og kontantstrøm.",
    href: siteConfig.baseLinks.okonomi,
    icon: Receipt,
  },
] as const

type Kpi = {
  label: string
  value: string
  delta?: DeltaValue | null
  tone?: "good-up" | "neutral"
  valueClassName?: string
}

// Build the five headline numbers, deriving AOV/ROAS trends from the
// recoverable previous-period totals the comparison exposes.
function buildKpis(metrics: MetricsResponse): Kpi[] {
  const { shopifyRevenue, adSpend } = metrics.totals
  const orders = metrics.totals.shopifyOrders ?? 0
  const comp = metrics.comparison?.totals

  const aov = orders > 0 ? shopifyRevenue / orders : null
  const roas = adSpend > 0 ? shopifyRevenue / adSpend : null

  const prevRevenue = previousFrom(shopifyRevenue, comp?.shopifyRevenue)
  const prevOrders = previousFrom(orders, comp?.shopifyOrders)
  const prevSpend = previousFrom(adSpend, comp?.adSpend)

  const aovDelta =
    aov != null && prevRevenue != null && prevOrders && prevOrders > 0
      ? makeDelta(aov, prevRevenue / prevOrders)
      : null
  const roasDelta =
    roas != null && prevRevenue != null && prevSpend && prevSpend > 0
      ? makeDelta(roas, prevRevenue / prevSpend)
      : null

  return [
    {
      label: "Shopify-omsetning",
      value: kr(shopifyRevenue),
      delta: comp?.shopifyRevenue,
    },
    { label: "Ordrer", value: num(orders), delta: comp?.shopifyOrders },
    {
      label: "Snittordre",
      value: aov != null ? kr(aov) : "—",
      delta: aovDelta,
    },
    {
      label: "Annonsespend",
      value: kr(adSpend),
      delta: comp?.adSpend,
      tone: "neutral",
    },
    {
      label: "Validert ROAS",
      value: roasLabel(roas),
      delta: roasDelta,
      valueClassName: roasTone(roas),
    },
  ]
}

export default function IDagPage() {
  const today = React.useMemo(() => new Date(), [])
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null)
  const [recs, setRecs] = React.useState<Recommendation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const since = format(subDays(today, WINDOW_DAYS), "yyyy-MM-dd")
    const until = format(today, "yyyy-MM-dd")
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getMetrics(since, until),
      getRecommendations({ status: "open", limit: 200 }),
    ])
      .then(([m, r]) => {
        if (cancelled) return
        setMetrics(m)
        setRecs(r.recommendations)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message ?? "Kunne ikke laste dagens data")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [today])

  const kpis = metrics ? buildKpis(metrics) : []
  const priority = pickPriority(recs)

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ── */}
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-gray-50">
          I dag
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
          <span className="first-letter:uppercase">
            {longNorwegianDate(today)}
          </span>
          {metrics?.lastSync && (
            <>
              <span
                aria-hidden="true"
                className="text-gray-300 dark:text-gray-600"
              >
                ·
              </span>
              <span>Sist oppdatert {lastSyncLabel(metrics.lastSync)}</span>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Dagens tall ── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Dagens tall
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            mot forrige {WINDOW_DAYS} dager
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <KpiCardSkeleton key={i} />
              ))
            : kpis.map((k) => (
                <KpiCard
                  key={k.label}
                  label={k.label}
                  value={k.value}
                  delta={k.delta}
                  tone={k.tone}
                  valueClassName={k.valueClassName}
                />
              ))}
        </div>
      </section>

      {/* ── Dagens viktigste + Hva endret seg ── */}
      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Dagens viktigste
          </h2>
          <div className="mt-4">
            {loading ? (
              <PrioritySkeleton />
            ) : priority ? (
              <PriorityCard rec={priority} />
            ) : (
              <PriorityEmpty />
            )}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Hva endret seg
          </h2>
          <div className="mt-4">
            {loading ? (
              <ChangesSkeleton />
            ) : metrics ? (
              <ChangesSection metrics={metrics} />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ingen sammenligningsdata.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Snarveier ── */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Snarveier
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <ShortcutCard
              key={s.href}
              name={s.name}
              description={s.description}
              href={s.href}
              icon={s.icon}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
