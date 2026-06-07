import type { DeltaValue, MetricsResponse } from "@/lib/detox-api"
import { cx } from "@/lib/utils"

import {
  type DeltaTone,
  arrowFor,
  deltaClass,
  makeDelta,
  pctValue,
  previousFrom,
} from "./format"

type Change = {
  key: string
  noun: string
  delta: DeltaValue
  tone: DeltaTone
}

function verbFor(dir: DeltaValue["dir"]): string {
  return dir === "up" ? "økte" : dir === "down" ? "falt" : "var uendret"
}

// Assemble candidate changes, then surface the few that actually moved most.
function buildChanges(metrics: MetricsResponse): Change[] {
  const comp = metrics.comparison?.totals
  if (!comp) return []

  const candidates: Change[] = [
    {
      key: "revenue",
      noun: "Shopify-omsetningen",
      delta: comp.shopifyRevenue,
      tone: "good-up",
    },
    {
      key: "orders",
      noun: "Antall ordrer",
      delta: comp.shopifyOrders,
      tone: "good-up",
    },
    {
      key: "spend",
      noun: "Annonsespend",
      delta: comp.adSpend,
      tone: "neutral",
    },
  ]

  // Derive a validated-ROAS change from the recoverable previous totals.
  const revenue = metrics.totals.shopifyRevenue
  const spend = metrics.totals.adSpend
  const prevRevenue = previousFrom(revenue, comp.shopifyRevenue)
  const prevSpend = previousFrom(spend, comp.adSpend)
  if (prevRevenue != null && prevSpend && prevSpend > 0 && spend > 0) {
    const roasDelta = makeDelta(revenue / spend, prevRevenue / prevSpend)
    candidates.push({
      key: "roas",
      noun: "Blended ROAS",
      delta: roasDelta,
      tone: "good-up",
    })
  }

  return candidates
    .filter((c) => c.delta && c.delta.pct != null && c.delta.dir !== "flat")
    .sort((a, b) => Math.abs(b.delta.pct ?? 0) - Math.abs(a.delta.pct ?? 0))
    .slice(0, 3)
}

interface ChangesSectionProps {
  metrics: MetricsResponse
}

export function ChangesSection({ metrics }: ChangesSectionProps) {
  const changes = buildChanges(metrics)

  if (changes.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Ingen sammenligningsdata.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {changes.map((c) => {
        const colour = deltaClass(c.delta.dir, c.tone)
        return (
          <li key={c.key} className="flex items-baseline gap-2.5">
            <span
              className={cx("text-sm font-semibold", colour)}
              aria-hidden="true"
            >
              {arrowFor(c.delta.dir)}
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {c.noun} {verbFor(c.delta.dir)}{" "}
              <span className={cx("font-semibold tabular-nums", colour)}>
                {pctValue(c.delta.pct as number)}
              </span>{" "}
              mot forrige periode.
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export function ChangesSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800"
        />
      ))}
    </div>
  )
}
