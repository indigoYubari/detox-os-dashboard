// Shared formatting + label helpers for the Annonser section.
// Single source of truth for channel labels/colors, severity maps, number
// formatting and ROAS health bands — used by the briefing room (/annonser),
// Anbefalinger, Kanaler and Overview so the visual language stays consistent.

import type { DeltaValue, Recommendation } from "@/lib/detox-api"

// ── channels ──────────────────────────────────────────────────
export const CHANNEL_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta: "Meta",
  klaviyo: "Klaviyo",
  shopify: "Shopify",
}

// Brand identity colours per channel (distinct from health colours below).
export const CHANNEL_DOT_COLORS: Record<string, string> = {
  google_ads: "bg-blue-500",
  meta: "bg-indigo-500",
  klaviyo: "bg-yellow-500",
  shopify: "bg-green-500",
}

// The three paid/owned media channels surfaced in the briefing glance row.
export const AD_CHANNELS = ["google_ads", "meta", "klaviyo"] as const

// ── severity ──────────────────────────────────────────────────
export const SEVERITY: Record<
  string,
  { label: string; variant: "error" | "warning" | "default" }
> = {
  critical: { label: "Kritisk", variant: "error" },
  warning: { label: "Advarsel", variant: "warning" },
  info: { label: "Info", variant: "default" },
}

// ── recommendation types ──────────────────────────────────────
export const TYPE_LABEL: Record<string, string> = {
  pause_or_revise: "Pause / revider",
  increase_budget: "Øk budsjett",
  insufficient_data: "For lite data",
  add_negative_keyword: "Negativt søkeord",
  review_flow: "Gjennomgå flow",
  top_performer: "Topp-flow",
  update_suppression_list: "Oppdater ekskludering",
  reduce_frequency: "Reduser frekvens",
}

export const labelFor = (map: Record<string, string>, key: string) =>
  map[key] ?? key.replace(/_/g, " ")

// ── number formatting (nb-NO) ─────────────────────────────────
export function kr(n: number): string {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}

export function num(n: number): string {
  return n.toLocaleString("nb-NO")
}

export function roasLabel(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(2)}x`
}

export function pctLabel(pct: number | null, dir: string): string {
  const sign = dir === "up" ? "↑" : dir === "down" ? "↓" : "→"
  if (pct == null) return sign
  return `${sign} ${Math.abs(pct).toFixed(1)}%`
}

export function deltaClass(dir: string): string {
  return dir === "up"
    ? "text-emerald-600 dark:text-emerald-400"
    : dir === "down"
      ? "text-red-500 dark:text-red-400"
      : "text-gray-400"
}

// revenue ÷ spend. What the result *means* depends entirely on what is fed in:
//   • Fed account totals (totals.shopifyRevenue, totals.adSpend) → blended MER,
//     genuinely Shopify-validated (the headline "Blended ROAS").
//   • Fed a single channel's own revenue/spend → PLATFORM ROAS, where revenue is
//     that platform's self-reported conversion value (Google conversions_value,
//     Meta action_values, Klaviyo conversion_value) — NOT Shopify-attributed.
//     This is the per-channel "Plattform-ROAS" behind the briefing health dots.
export function validatedRoas(spend: number, revenue: number): number | null {
  return spend > 0 ? revenue / spend : null
}

// ── ROAS health bands ─────────────────────────────────────────
// green ≥ 4 · amber 1–4 · red < 1 · unknown when ROAS can't be computed.
export type HealthLevel = "green" | "amber" | "red" | "unknown"

export function healthLevel(roas: number | null): HealthLevel {
  if (roas == null) return "unknown"
  if (roas >= 4) return "green"
  if (roas >= 1) return "amber"
  return "red"
}

export const HEALTH_DOT: Record<HealthLevel, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  unknown: "bg-gray-300 dark:bg-gray-600",
}

export const HEALTH_RING: Record<HealthLevel, string> = {
  green: "ring-emerald-500/30",
  amber: "ring-amber-500/30",
  red: "ring-red-500/30",
  unknown: "ring-gray-400/20",
}

export const HEALTH_TEXT: Record<HealthLevel, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  unknown: "text-gray-500 dark:text-gray-400",
}

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  green: "Sterk",
  amber: "Følg med",
  red: "Krever handling",
  unknown: "Ingen data",
}

// ── rationale → inline metric pairs ───────────────────────────
// Inline metadata drawn from `rationale`. Ordered by usefulness; deduped by
// label so the same concept never shows twice.
const MONEY_KEYS = new Set(["spend", "revenue", "shopifyRevenue"])
const ROAS_KEYS = new Set(["roas", "validatedRoas", "platformRoas"])
const META_ORDER: { key: string; label: string }[] = [
  { key: "spend", label: "forbruk" },
  { key: "shopifyRevenue", label: "omsetning" },
  { key: "revenue", label: "omsetning" },
  { key: "validatedRoas", label: "validert ROAS" },
  { key: "roas", label: "ROAS" },
  { key: "platformRoas", label: "plattform-ROAS" },
  { key: "conversions", label: "konv." },
  { key: "clicks", label: "klikk" },
  { key: "frequency", label: "frekvens" },
  { key: "buyer_count", label: "kjøpere" },
  { key: "data_points", label: "datapunkter" },
  { key: "segment", label: "segment" },
]

function formatMetric(key: string, value: unknown): string | null {
  if (value == null) return null
  if (MONEY_KEYS.has(key)) {
    const n = Number(value)
    return Number.isFinite(n)
      ? `kr ${Math.round(n).toLocaleString("nb-NO")}`
      : null
  }
  if (ROAS_KEYS.has(key)) {
    const n = Number(value)
    return Number.isFinite(n) ? `${n.toFixed(2)}x` : null
  }
  if (key === "frequency") {
    const n = Number(value)
    return Number.isFinite(n) ? n.toFixed(2) : null
  }
  if (typeof value === "number") return value.toLocaleString("nb-NO")
  if (typeof value === "string") return value
  return null
}

export function metricPairs(rec: Recommendation): string[] {
  const rationale = rec.rationale ?? {}
  const out: string[] = []
  const seenLabels = new Set<string>()
  for (const { key, label } of META_ORDER) {
    if (!(key in rationale) || seenLabels.has(label)) continue
    const formatted = formatMetric(
      key,
      (rationale as Record<string, unknown>)[key],
    )
    if (formatted == null) continue
    out.push(`${label}: ${formatted}`)
    seenLabels.add(label)
    if (out.length >= 5) break
  }
  return out
}

// ── "Siden sist" change detection ─────────────────────────────
// Turns period-over-period deltas into ranked, plain-Norwegian sentences.
export type SignificantChange = {
  key: string
  sentence: string
  pctLabel: string
  good: boolean
  magnitude: number
}

type MetricSpec = { label: string; upIsGood: boolean }

type ChannelComparison = {
  spend: DeltaValue
  revenue: DeltaValue
  conversions: DeltaValue
  roas: DeltaValue
}

const CHANNEL_METRIC_SPECS: Record<keyof ChannelComparison, MetricSpec> = {
  roas: { label: "Plattform-ROAS", upIsGood: true },
  revenue: { label: "Omsetning", upIsGood: true },
  spend: { label: "Forbruk", upIsGood: false },
  conversions: { label: "Konverteringer", upIsGood: true },
}

const TOTAL_METRIC_SPECS: Record<string, MetricSpec> = {
  shopifyRevenue: { label: "Shopify-omsetning", upIsGood: true },
  adSpend: { label: "Total annonsespend", upIsGood: false },
  shopifyOrders: { label: "Antall ordrer", upIsGood: true },
}

function verbFor(dir: string): string {
  return dir === "up" ? "steg" : dir === "down" ? "falt" : "var uendret"
}

function pushChange(
  out: SignificantChange[],
  key: string,
  spec: MetricSpec,
  delta: DeltaValue | undefined,
  channelLabel?: string,
): void {
  if (!delta || delta.pct == null || !Number.isFinite(delta.pct)) return
  if (delta.dir === "flat") return
  const magnitude = Math.abs(delta.pct)
  if (magnitude < 0.5) return // ignore noise
  const where = channelLabel ? ` på ${channelLabel}` : ""
  const sentence = `${spec.label}${where} ${verbFor(
    delta.dir,
  )} ${magnitude.toFixed(0)}% vs forrige periode`
  const good = delta.dir === "up" ? spec.upIsGood : !spec.upIsGood
  out.push({
    key,
    sentence,
    pctLabel: `${delta.dir === "up" ? "+" : "−"}${magnitude.toFixed(0)}%`,
    good,
    magnitude,
  })
}

export function significantChanges(
  comparison:
    | {
        totals: {
          adSpend: DeltaValue
          shopifyRevenue: DeltaValue
          shopifyOrders: DeltaValue
        }
        channels: Record<string, ChannelComparison>
      }
    | undefined,
  limit = 6,
): SignificantChange[] {
  if (!comparison) return []
  const out: SignificantChange[] = []

  // Totals first — they describe the whole business.
  for (const [key, spec] of Object.entries(TOTAL_METRIC_SPECS)) {
    pushChange(
      out,
      `total:${key}`,
      spec,
      comparison.totals[key as keyof typeof comparison.totals],
    )
  }

  // Then per-channel deltas.
  for (const [channel, cmp] of Object.entries(comparison.channels)) {
    const channelLabel = labelFor(CHANNEL_LABELS, channel)
    for (const [metric, spec] of Object.entries(CHANNEL_METRIC_SPECS)) {
      pushChange(
        out,
        `${channel}:${metric}`,
        spec,
        cmp[metric as keyof ChannelComparison],
        channelLabel,
      )
    }
  }

  return out.sort((a, b) => b.magnitude - a.magnitude).slice(0, limit)
}
