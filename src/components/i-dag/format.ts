import type { DeltaValue } from "@/lib/detox-api"

// ── number + currency formatting (nb-NO) ──────────────────────
export function kr(n: number): string {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("nb-NO")
}

export function roasLabel(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(2)}x`
}

// Percentage with Norwegian decimal comma, e.g. 12.3 → "12,3 %".
export function pctValue(pct: number): string {
  return `${Math.abs(pct).toLocaleString("nb-NO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

export function arrowFor(dir: DeltaValue["dir"]): string {
  return dir === "up" ? "↑" : dir === "down" ? "↓" : "→"
}

// Compact delta string for KPI cards: "↑ 12,3 %" or just an arrow when no pct.
export function deltaLabel(delta: DeltaValue): string {
  const arrow = arrowFor(delta.dir)
  if (delta.pct == null) return arrow
  return `${arrow} ${pctValue(delta.pct)}`
}

// ── delta tone → colour ───────────────────────────────────────
// "good-up": rising is positive (revenue, orders, AOV, ROAS).
// "neutral": no value judgement on direction (ad spend).
export type DeltaTone = "good-up" | "neutral"

export function deltaClass(dir: DeltaValue["dir"], tone: DeltaTone): string {
  if (tone === "neutral") return "text-gray-400 dark:text-gray-500"
  if (dir === "up") return "text-emerald-600 dark:text-emerald-400"
  if (dir === "down") return "text-red-500 dark:text-red-400"
  return "text-gray-400 dark:text-gray-500"
}

// ROAS value colour by health band — mirrors the Annonser/Oversikt convention.
export function roasTone(roas: number | null): string {
  if (roas == null) return "text-gray-900 dark:text-gray-50"
  if (roas >= 4) return "text-emerald-600 dark:text-emerald-400"
  if (roas > 0 && roas < 1) return "text-red-600 dark:text-red-400"
  return "text-gray-900 dark:text-gray-50"
}

// ── derivations ───────────────────────────────────────────────
// Build a DeltaValue from raw current/previous numbers (pct in percent units,
// matching the backend's comparison shape).
export function makeDelta(current: number, previous: number): DeltaValue {
  const abs = current - previous
  const pct = previous !== 0 ? (abs / previous) * 100 : null
  const dir = abs > 1e-6 ? "up" : abs < -1e-6 ? "down" : "flat"
  return { abs, pct, dir }
}

// The backend gives deltas as abs = current − previous, so the previous value is
// recoverable. Used to derive AOV/ROAS trends the API doesn't ship directly.
export function previousFrom(
  current: number,
  delta?: DeltaValue,
): number | null {
  if (!delta) return null
  return current - delta.abs
}

// ── dates ─────────────────────────────────────────────────────
// "lørdag 7. juni 2026"
export function longNorwegianDate(date: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function lastSyncLabel(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
