"use client"

import React from "react"
import { subDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import { Filterbar } from "@/components/ui/overview/DashboardFilterbar"
import { StatTooltip } from "@/components/ui/StatTooltip"
import { Badge } from "@/components/Badge"
import { ProgressBar } from "@/components/ProgressBar"
import {
  getCampaignHealth,
  type CampaignHealth,
  type CampaignHealthResponse,
} from "@/lib/detox-api"

// ── helpers ──────────────────────────────────────────────────
function kr(n: number) {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
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

// Google Ads enums → Norwegian. Falls back to a prettified enum.
const CHANNEL_TYPE_LABELS: Record<string, string> = {
  PERFORMANCE_MAX: "Performance Max",
  SEARCH: "Søk",
  SHOPPING: "Shopping",
  DISPLAY: "Display",
  VIDEO: "Video",
  DEMAND_GEN: "Demand Gen",
  MULTI_CHANNEL: "Flerkanal",
}
const BIDDING_LABELS: Record<string, string> = {
  MAXIMIZE_CONVERSION_VALUE: "Maksimer konv.verdi",
  MAXIMIZE_CONVERSIONS: "Maksimer konverteringer",
  TARGET_ROAS: "Mål-ROAS",
  TARGET_CPA: "Mål-CPA",
  MANUAL_CPC: "Manuell CPC",
  TARGET_SPEND: "Maksimer klikk",
}
function prettyEnum(v: string | null, map: Record<string, string>) {
  if (!v) return null
  if (map[v]) return map[v]
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

type StatusTone = "success" | "warning" | "error" | "neutral"
function statusFor(c: CampaignHealth): { label: string; variant: StatusTone } {
  if (c.spend <= 0) return { label: "Ingen forbruk", variant: "neutral" }
  if (c.roas != null && c.roas < 1) return { label: "Tapsbringende", variant: "error" }
  if (c.budgetLimited) return { label: "Begrenset av budsjettet", variant: "warning" }
  if (c.roas != null && c.roas >= 4) return { label: "God", variant: "success" }
  return { label: "Akseptabel", variant: "neutral" }
}

// Tempo (today's spend vs daily budget): green ≤100, amber 100–120, red >120.
function tempoTone(pct: number | null): StatusTone {
  if (pct == null) return "neutral"
  if (pct <= 100) return "success"
  if (pct <= 120) return "warning"
  return "error"
}

// ── component ─────────────────────────────────────────────────
export default function KampanjerPage() {
  const today = new Date()
  const [selectedDates, setSelectedDates] = React.useState<DateRange | undefined>({
    from: subDays(today, 7),
    to: today,
  })
  const [data, setData] = React.useState<CampaignHealthResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const since = selectedDates?.from ? format(selectedDates.from, "yyyy-MM-dd") : undefined
    const until = selectedDates?.to ? format(selectedDates.to, "yyyy-MM-dd") : undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    getCampaignHealth(since, until)
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

  const campaigns = data?.campaigns ?? []

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Kampanjer
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Google Ads kampanje-helse
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

      {/* ── Campaign cards ── */}
      <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {loading ? (
          <>
            <CampaignSkeleton />
            <CampaignSkeleton />
          </>
        ) : !error && campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center xl:col-span-2 dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingen kampanjer for valgt periode
            </p>
          </div>
        ) : (
          campaigns.map((c) => <CampaignCard key={c.campaignId} campaign={c} />)
        )}
      </div>
    </>
  )
}

// ── campaign card ─────────────────────────────────────────────
function CampaignCard({ campaign: c }: { campaign: CampaignHealth }) {
  const status = statusFor(c)
  const noSpend = c.spend <= 0
  const channelType = prettyEnum(c.channelType, CHANNEL_TYPE_LABELS)
  const bidding = prettyEnum(c.biddingStrategy, BIDDING_LABELS)
  const subtitleParts = [channelType, bidding].filter(Boolean) as string[]

  const pct = c.tempo.pct
  const hasTempo = pct != null && c.tempo.dailyBudget > 0

  return (
    <section className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            title={c.name}
            className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50"
          >
            {c.name}
          </h2>
          {subtitleParts.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {subtitleParts.join(" · ")}
            </p>
          )}
        </div>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
      </div>

      {/* daily budget */}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Dagsbudsjett:{" "}
        <span className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
          {c.dailyBudget > 0 ? kr(c.dailyBudget) : "ikke satt"}
        </span>
      </p>

      {noSpend ? (
        <p className="mt-5 rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-gray-400 dark:bg-gray-800/40">
          Ingen forbruk i perioden
        </p>
      ) : (
        <>
          {/* metrics */}
          <div className="mt-5 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400"><StatTooltip explanation="Totalt annonseforbruk for kampanjen i valgt periode.">Spend</StatTooltip></p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {kr(c.spend)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400"><StatTooltip explanation="Omsetning tilskrevet denne kampanjen av Google Ads.">Omsetning</StatTooltip></p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {kr(c.revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400"><StatTooltip explanation="Return on Ad Spend: omsetning delt pa forbruk. Over 3x er bra for detox.no.">ROAS</StatTooltip></p>
              <p className={`mt-1 text-sm font-semibold tabular-nums ${roasTextClass(c.roas)}`}>
                {roasLabel(c.roas)}
              </p>
            </div>
          </div>

          {/* budget tempo */}
          {hasTempo && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-400"><StatTooltip explanation="Hvor mye av dagsbudsjettet som er brukt i dag. Over 100% betyr kampanjen er begrenset av budsjettet.">Forbruk i dag</StatTooltip></span>
                <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
                  {pct}%
                </span>
              </div>
              <ProgressBar
                value={pct ?? 0}
                max={100}
                variant={tempoTone(pct)}
                showAnimation
              />
              <p className="mt-1.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                Brukt {kr(c.tempo.todaySpend)} av {kr(c.tempo.dailyBudget)} i dag
              </p>
            </div>
          )}
        </>
      )}

      {/* health recommendation */}
      {c.health && (
        <p className="mt-5 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {c.health}
        </p>
      )}
    </section>
  )
}

// ── skeleton ──────────────────────────────────────────────────
function CampaignSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  )
}
