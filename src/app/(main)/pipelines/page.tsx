"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { ProgressBar } from "@/components/ProgressBar"

// ── types ─────────────────────────────────────────────────────
type PipelineStatus = "ok" | "kjorer" | "feil" | "pause"
type StageStatus = "ferdig" | "aktiv" | "venter" | "feil"

type Stage = { name: string; status: StageStatus }

type Pipeline = {
  id: string
  name: string
  description: string
  trigger: string
  status: PipelineStatus
  lastRun: string
  duration: string
  throughput: string
  successRate: number
  stages: Stage[]
}

// ── helpers ───────────────────────────────────────────────────
const STATUS_META: Record<
  PipelineStatus,
  { label: string; variant: "success" | "warning" | "error" | "neutral" }
> = {
  ok: { label: "Frisk", variant: "success" },
  kjorer: { label: "Kjører", variant: "warning" },
  feil: { label: "Feilet", variant: "error" },
  pause: { label: "På pause", variant: "neutral" },
}
const STAGE_DOT: Record<StageStatus, string> = {
  ferdig: "bg-emerald-500 border-emerald-500",
  aktiv: "bg-blue-500 border-blue-500",
  venter: "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-600",
  feil: "bg-red-500 border-red-500",
}
const STAGE_LINE: Record<StageStatus, string> = {
  ferdig: "bg-emerald-500",
  aktiv: "bg-blue-500",
  venter: "bg-gray-200 dark:bg-gray-700",
  feil: "bg-red-500",
}
function rateClass(r: number) {
  if (r >= 95) return "text-emerald-600 dark:text-emerald-400"
  if (r >= 85) return "text-yellow-600 dark:text-yellow-500"
  return "text-red-600 dark:text-red-400"
}

// ── mock data ─────────────────────────────────────────────────
const PIPELINES: Pipeline[] = [
  {
    id: "pl-shopify-fiken",
    name: "Shopify → Fiken",
    description:
      "Henter ordrer fra Shopify, mapper til bilag og synkroniserer salgsfakturaer til Fiken med korrekt MVA.",
    trigger: "Planlagt · hver dag 23:00",
    status: "ok",
    lastRun: "I går 23:00",
    duration: "3 min 41 s",
    throughput: "142 ordrer",
    successRate: 99,
    stages: [
      { name: "Hent ordrer", status: "ferdig" },
      { name: "Map bilag", status: "ferdig" },
      { name: "MVA-validering", status: "ferdig" },
      { name: "Push Fiken", status: "ferdig" },
    ],
  },
  {
    id: "pl-ad-metrics",
    name: "Annonsemetrikk-innsamling",
    description:
      "Samler spend, ROAS og konverteringer fra Google Ads, Meta og Klaviyo til detox.OS-databasen.",
    trigger: "Planlagt · hver 6. time",
    status: "kjorer",
    lastRun: "I dag 12:00",
    duration: "pågår…",
    throughput: "3 kanaler",
    successRate: 97,
    stages: [
      { name: "Google Ads", status: "ferdig" },
      { name: "Meta", status: "aktiv" },
      { name: "Klaviyo", status: "venter" },
      { name: "Persist metrics", status: "venter" },
    ],
  },
  {
    id: "pl-klaviyo-sync",
    name: "Klaviyo-suppressjon",
    description:
      "Synkroniserer avmeldte og bouncede kontakter til annonseplattformenes ekskluderingslister.",
    trigger: "Utløst · ved avmelding",
    status: "feil",
    lastRun: "I dag 12:04",
    duration: "1 min 06 s",
    throughput: "318 kontakter",
    successRate: 84,
    stages: [
      { name: "Hent avmeldte", status: "ferdig" },
      { name: "Dedupliser", status: "ferdig" },
      { name: "Push Meta", status: "feil" },
      { name: "Push Google", status: "venter" },
    ],
  },
  {
    id: "pl-product-rewrite",
    name: "Produkttekst-migrering",
    description:
      "Konverterer body_html til strukturerte metafields. INCI-deklarasjoner kopieres verbatim, aldri AI-omskrevet.",
    trigger: "Manuell · batch",
    status: "pause",
    lastRun: "4. jun 14:20",
    duration: "—",
    throughput: "237 / 389 produkter",
    successRate: 100,
    stages: [
      { name: "Les produkt", status: "ferdig" },
      { name: "Parse seksjoner", status: "ferdig" },
      { name: "Skriv metafields", status: "venter" },
      { name: "Verifiser", status: "venter" },
    ],
  },
  {
    id: "pl-invoice-fetch",
    name: "Faktura-innhenting",
    description:
      "Henter fakturaer og kvitteringer fra Gmail, klassifiserer avsender og leverer bilag klart til Fiken.",
    trigger: "Planlagt · hver dag 06:30",
    status: "ok",
    lastRun: "I dag 06:30",
    duration: "48 s",
    throughput: "7 bilag",
    successRate: 93,
    stages: [
      { name: "Skann innboks", status: "ferdig" },
      { name: "Klassifiser", status: "ferdig" },
      { name: "Trekk ut PDF", status: "ferdig" },
      { name: "Til Fiken-kø", status: "ferdig" },
    ],
  },
]

const FILTERS: { key: PipelineStatus | "alle"; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "ok", label: "Friske" },
  { key: "kjorer", label: "Kjører" },
  { key: "feil", label: "Feilet" },
  { key: "pause", label: "På pause" },
]

// ── component ─────────────────────────────────────────────────
export default function Pipelines() {
  const [filter, setFilter] = React.useState<PipelineStatus | "alle">("alle")

  const visible = PIPELINES.filter(
    (p) => filter === "alle" || p.status === filter,
  )

  const running = PIPELINES.filter((p) => p.status === "kjorer").length
  const failed = PIPELINES.filter((p) => p.status === "feil").length
  const avgRate = Math.round(
    PIPELINES.reduce((a, p) => a + p.successRate, 0) / PIPELINES.length,
  )

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Pipelines
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gjentakende arbeidsflyter — planlagt eller utløst
          </p>
        </div>
        <Badge variant={failed > 0 ? "error" : "success"}>
          {failed > 0 ? `${failed} feilet` : "Alle friske"}
        </Badge>
      </div>

      {/* ── KPI ── */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pipelines"
          value={`${PIPELINES.length}`}
          hint="konfigurert"
        />
        <KpiCard
          label="Kjører nå"
          value={`${running}`}
          hint="aktive kjøringer"
          tone="warning"
        />
        <KpiCard
          label="Snitt suksessrate"
          value={`${avgRate}%`}
          hint="siste 30 dager"
          tone={avgRate >= 90 ? "success" : "warning"}
        />
        <KpiCard
          label="Feilet"
          value={`${failed}`}
          hint="siste døgn"
          tone={failed > 0 ? "error" : "success"}
        />
      </section>

      {/* ── Toolbar ── */}
      <div className="mt-8 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === f.key
                ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <section className="mt-6 space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
            Ingen pipelines i denne statusen.
          </div>
        ) : (
          visible.map((p) => {
            const meta = STATUS_META[p.status]
            return (
              <div
                key={p.id}
                className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                        {p.name}
                      </h2>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                      {p.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {p.trigger}
                  </span>
                </div>

                {/* stage stepper */}
                <div className="mt-6 flex items-center">
                  {p.stages.map((st, i) => (
                    <React.Fragment key={st.name}>
                      <div className="flex flex-col items-center gap-2">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${STAGE_DOT[st.status]}`}
                        >
                          {st.status === "ferdig" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </span>
                        <span
                          className={`whitespace-nowrap text-xs ${
                            st.status === "venter"
                              ? "text-gray-400"
                              : st.status === "feil"
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {st.name}
                        </span>
                      </div>
                      {i < p.stages.length - 1 && (
                        <div
                          className={`mx-2 mb-5 h-0.5 flex-1 rounded ${STAGE_LINE[p.stages[i + 1].status === "venter" ? "venter" : st.status]}`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* footer metrics */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4 dark:border-gray-800">
                  <Metric label="Sist kjørt" value={p.lastRun} />
                  <Metric label="Varighet" value={p.duration} />
                  <Metric label="Gjennomstrømming" value={p.throughput} />
                  <div>
                    <p className="text-xs text-gray-400">Suksessrate</p>
                    <p
                      className={`text-sm font-semibold ${rateClass(p.successRate)}`}
                    >
                      {p.successRate}%
                    </p>
                    <ProgressBar value={p.successRate} className="mt-1.5" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </section>
    </>
  )
}

// ── small parts ───────────────────────────────────────────────
function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: string
  hint: string
  tone?: "neutral" | "success" | "warning" | "error"
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warning"
        ? "text-yellow-700 dark:text-yellow-500"
        : tone === "error"
          ? "text-red-700 dark:text-red-400"
          : "text-gray-900 dark:text-gray-50"
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
        {value}
      </p>
    </div>
  )
}
