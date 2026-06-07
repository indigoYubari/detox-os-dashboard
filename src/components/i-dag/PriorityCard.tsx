import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Badge, type BadgeProps } from "@/components/Badge"
import type { Recommendation } from "@/lib/detox-api"
import { siteConfig } from "@/app/siteConfig"
import { cx } from "@/lib/utils"

const SEVERITY: Record<
  string,
  { label: string; variant: BadgeProps["variant"]; accent: string }
> = {
  critical: { label: "Kritisk", variant: "error", accent: "bg-red-500" },
  warning: { label: "Advarsel", variant: "warning", accent: "bg-yellow-500" },
  info: { label: "Info", variant: "default", accent: "bg-indigo-500" },
}

const CHANNEL_LABEL: Record<string, string> = {
  google_ads: "Google Ads",
  meta: "Meta",
  klaviyo: "Klaviyo",
  shopify: "Shopify",
}

interface PriorityCardProps {
  rec: Recommendation
}

/**
 * The one thing worth looking at first. A coloured spine signals severity; the
 * card hands off to Annonser rather than acting here — this page only points.
 */
export function PriorityCard({ rec }: PriorityCardProps) {
  const sev = SEVERITY[rec.severity] ?? {
    label: rec.severity,
    variant: "default" as const,
    accent: "bg-gray-400",
  }
  const channel = CHANNEL_LABEL[rec.channel] ?? rec.channel

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <span className={cx("absolute inset-y-0 left-0 w-1", sev.accent)} />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sev.variant}>{sev.label}</Badge>
          <Badge variant="neutral">{channel}</Badge>
        </div>

        <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-50">
          {rec.title}
        </h3>

        {rec.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {rec.description}
          </p>
        )}

        <Link
          href={siteConfig.baseLinks.annonserAnbefalinger}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Åpne i Annonser
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

/** Nothing urgent — a calm, reassuring resting state. */
export function PriorityEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-6 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Ingenting krever oppmerksomhet akkurat nå.
      </p>
    </div>
  )
}

export function PrioritySkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  )
}
