import type { DeltaValue } from "@/lib/detox-api"
import { cx } from "@/lib/utils"

import { type DeltaTone, deltaClass, deltaLabel } from "./format"

interface KpiCardProps {
  label: string
  value: string
  delta?: DeltaValue | null
  tone?: DeltaTone
  /** Optional colour override for the value itself (used for ROAS bands). */
  valueClassName?: string
  /** Optional muted line spelling out how the number is derived. */
  caption?: string
}

/**
 * One number, at a glance. Label on top, big value, a quiet trend line beneath.
 * Calm by default — colour only appears on the delta to signal direction.
 */
export function KpiCard({
  label,
  value,
  delta,
  tone = "good-up",
  valueClassName,
  caption,
}: KpiCardProps) {
  // A bare arrow with no percentage is noise — only show a trend when there is
  // a real period-over-period change to report.
  const showDelta = delta != null && delta.pct != null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={cx(
          "mt-2 text-xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50",
          valueClassName,
        )}
      >
        {value}
      </p>
      <p
        className={cx(
          "mt-1.5 h-4 text-xs font-medium tabular-nums",
          showDelta ? deltaClass(delta.dir, tone) : "text-transparent",
        )}
      >
        {showDelta ? deltaLabel(delta) : "—"}
      </p>
      {caption && (
        <p className="mt-1 text-[11px] leading-tight text-gray-400 dark:text-gray-500">
          {caption}
        </p>
      )}
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-7 w-24 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  )
}
