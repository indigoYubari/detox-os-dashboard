"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { StatTooltip } from "@/components/ui/StatTooltip"
import {
  getSearchTerms,
  type SearchTerm,
  type SearchTermsResponse,
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

const DAY_OPTIONS = [7, 14, 30, 90] as const
const DEFAULT_DAYS = 30

// ── sorting ───────────────────────────────────────────────────
type SortKey =
  | "searchTerm"
  | "clicks"
  | "impressions"
  | "cost"
  | "conversions"
  | "roas"
  | "flag"
type SortDir = "asc" | "desc"

// Flag → attention rank so "Sløsing" sorts above "Sterk" above neutral.
function flagRank(flag: SearchTerm["flag"]) {
  if (flag === "wasted") return 2
  if (flag === "strong") return 1
  return 0
}

function sortValue(t: SearchTerm, key: SortKey): number | string {
  switch (key) {
    case "searchTerm":
      return t.searchTerm.toLowerCase()
    case "roas":
      // null ROAS (no spend) sorts to the bottom on desc.
      return t.roas ?? -1
    case "flag":
      return flagRank(t.flag)
    default:
      return t[key]
  }
}

function sortTerms(
  terms: SearchTerm[],
  key: SortKey,
  dir: SortDir,
): SearchTerm[] {
  const factor = dir === "asc" ? 1 : -1
  return [...terms].sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    if (av < bv) return -1 * factor
    if (av > bv) return 1 * factor
    return 0
  })
}

// ── component ─────────────────────────────────────────────────
export default function SoketermerPage() {
  const [days, setDays] = React.useState<number>(DEFAULT_DAYS)
  const [data, setData] = React.useState<SearchTermsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [sortKey, setSortKey] = React.useState<SortKey>("cost")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSearchTerms(days, 100)
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
  }, [days])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // String column defaults to ascending; numeric to descending.
      setSortDir(key === "searchTerm" ? "asc" : "desc")
    }
  }

  const terms = data?.terms ?? []
  const sorted = React.useMemo(
    () => sortTerms(data?.terms ?? [], sortKey, sortDir),
    [data, sortKey, sortDir],
  )

  const wastedCount = data?.counts.wasted ?? 0
  const strongCount = data?.counts.strong ?? 0
  const wastedSpend = terms
    .filter((t) => t.flag === "wasted")
    .reduce((sum, t) => sum + t.cost, 0)

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Søketermer
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Google Ads søkeord-rapport — rangert etter ytelse
          </p>
        </div>
        <DaysSelector value={days} onChange={setDays} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Summary ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Søketermer" tooltip="Totalt antall unike søketermer som har utløst annonsene dine i perioden."
          value={loading ? null : num(terms.length)}
        />
        <SummaryCard
          label="Sløsing" tooltip="Søketermer med høyt forbruk og null konverteringer. Bør legges til som negative søkeord."
          value={loading ? null : num(wastedCount)}
          tone="error"
        />
        <SummaryCard
          label="Sterke" tooltip="Søketermer med ROAS over 4x. Disse driver lønsom trafikk og bør prioriteres."
          value={loading ? null : num(strongCount)}
          tone="success"
        />
        <SummaryCard
          label="Forbruk på sløsing" tooltip="Totalt beløp brukt på søketermer klassifisert som sløsing. Potensielt besparelsespotensial."
          value={loading ? null : kr(wastedSpend)}
          tone={wastedSpend > 0 ? "error" : undefined}
        />
      </div>

      {/* ── Table ── */}
      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 dark:border-gray-800">
                <SortHeader
                  label="Søkeord"
                  columnKey="searchTerm"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Klikk"
                  columnKey="clicks"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortHeader
                  label="Visninger"
                  columnKey="impressions"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortHeader
                  label="Spend"
                  columnKey="cost"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortHeader
                  label="Konverteringer"
                  columnKey="conversions"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortHeader
                  label="ROAS"
                  columnKey="roas"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <SortHeader
                  label="Status"
                  columnKey="flag"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading ? (
                <SearchTermSkeletonRows />
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Ingen søketermer funnet for perioden
                  </td>
                </tr>
              ) : (
                sorted.map((t, i) => (
                  <SearchTermRow key={`${t.searchTerm}-${i}`} term={t} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── days selector ─────────────────────────────────────────────
function DaysSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (days: number) => void
}) {
  return (
    <div
      role="group"
      aria-label="Velg periode"
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-900"
    >
      {DAY_OPTIONS.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={
              active
                ? "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }
          >
            {opt} d
          </button>
        )
      })}
    </div>
  )
}

// ── summary card ──────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string
  value: string | null
  tone?: "error" | "success"
  tooltip?: string
}) {
  const valueClass =
    tone === "error"
      ? "text-red-600 dark:text-red-400"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-gray-900 dark:text-gray-50"
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">{tooltip ? <StatTooltip explanation={tooltip}>{label}</StatTooltip> : label}</p>
      {value == null ? (
        <div className="mt-2 h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      ) : (
        <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
          {value}
        </p>
      )}
    </div>
  )
}

// ── sortable header ───────────────────────────────────────────
function SortHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string
  columnKey: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const active = columnKey === sortKey
  const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : ""
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200 ${
          active ? "text-gray-700 dark:text-gray-200" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span>{label}</span>
        <span className="w-2 text-[0.625rem] leading-none">{arrow}</span>
      </button>
    </th>
  )
}

// ── search term row ───────────────────────────────────────────
function SearchTermRow({ term: t }: { term: SearchTerm }) {
  const rowTint =
    t.flag === "wasted"
      ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30"
      : t.flag === "strong"
        ? "bg-emerald-50/60 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
        : "hover:bg-gray-50 dark:hover:bg-gray-800/40"

  return (
    <tr className={`transition-colors ${rowTint}`}>
      <td className="max-w-xs px-4 py-3">
        <p
          title={t.searchTerm}
          className="truncate font-medium text-gray-900 dark:text-gray-50"
        >
          {t.searchTerm}
        </p>
        {t.campaignName && (
          <p
            title={t.campaignName}
            className="truncate text-xs text-gray-400 dark:text-gray-500"
          >
            {t.campaignName}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
        {num(t.clicks)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
        {num(t.impressions)}
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
        {kr(t.cost)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-50">
        {num(t.conversions)}
      </td>
      <td
        className={`px-4 py-3 text-right font-medium tabular-nums ${roasTextClass(t.roas)}`}
      >
        {roasLabel(t.roas)}
      </td>
      <td className="px-4 py-3 text-right">
        <StatusBadge flag={t.flag} />
      </td>
    </tr>
  )
}

function StatusBadge({ flag }: { flag: SearchTerm["flag"] }) {
  if (flag === "wasted") return <Badge variant="error">Sløsing</Badge>
  if (flag === "strong") return <Badge variant="success">Sterk</Badge>
  return <span className="text-gray-300 dark:text-gray-600">—</span>
}

// ── skeleton ──────────────────────────────────────────────────
function SearchTermSkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </td>
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="ml-auto h-4 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
