"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { ProgressBar } from "@/components/ProgressBar"

// ── types ─────────────────────────────────────────────────────
type AgentStatus = "kjorer" | "inaktiv" | "feil" | "planlagt"

type Agent = {
  id: string
  name: string
  type: string
  description: string
  status: AgentStatus
  schedule: string
  lastRun: string
  nextRun: string
  runsToday: number
  successRate: number
  avgDuration: string
  lastMessage: string
}

// ── helpers ───────────────────────────────────────────────────
const STATUS_META: Record<
  AgentStatus,
  {
    label: string
    dot: string
    variant: "success" | "neutral" | "error" | "warning"
  }
> = {
  kjorer: { label: "Kjører", dot: "bg-emerald-500", variant: "success" },
  inaktiv: { label: "Inaktiv", dot: "bg-gray-400", variant: "neutral" },
  feil: { label: "Feil", dot: "bg-red-500", variant: "error" },
  planlagt: { label: "Planlagt", dot: "bg-blue-500", variant: "warning" },
}
function rateClass(r: number) {
  if (r >= 95) return "text-emerald-600 dark:text-emerald-400"
  if (r >= 85) return "text-yellow-600 dark:text-yellow-500"
  return "text-red-600 dark:text-red-400"
}

// ── mock data ─────────────────────────────────────────────────
const AGENTS: Agent[] = [
  {
    id: "ag-ads",
    name: "Annonseagent",
    type: "Marketing · Railway",
    description:
      "Henter ROAS på tvers av Google Ads, Meta og Klaviyo, validerer terskler og sender anbefalinger til Telegram.",
    status: "kjorer",
    schedule: "Hver dag 07:00",
    lastRun: "I dag 07:00",
    nextRun: "I morgen 07:00",
    runsToday: 1,
    successRate: 98,
    avgDuration: "2 min 14 s",
    lastMessage: "3 anbefalinger sendt · 0 feil",
  },
  {
    id: "ag-invoice",
    name: "Fakturahenter",
    type: "Økonomi · Gmail → Fiken",
    description:
      "Skanner innboks for fakturaer og kvitteringer, klassifiserer avsender og forbereder bilag til Fiken.",
    status: "planlagt",
    schedule: "Hver dag 06:30",
    lastRun: "I dag 06:30",
    nextRun: "I morgen 06:30",
    runsToday: 1,
    successRate: 92,
    avgDuration: "48 s",
    lastMessage: "7 bilag forberedt · 1 til manuell sjekk",
  },
  {
    id: "ag-seo",
    name: "SEO-revisor",
    type: "Innhold · detox.no",
    description:
      "Sjekker meta-beskrivelser, strukturert data og Rich Results. Flagger OutOfStock-feil i produktschema.",
    status: "kjorer",
    schedule: "Hver mandag 09:00",
    lastRun: "Man 09:00",
    nextRun: "Neste mandag 09:00",
    runsToday: 0,
    successRate: 96,
    avgDuration: "3 min 02 s",
    lastMessage: "4 sider flagget for manglende schema",
  },
  {
    id: "ag-rewriter",
    name: "Produkttekst-omskriver",
    type: "Innhold · Shopify",
    description:
      "Migrerer body_html til strukturerte metafields. INCI-lister kopieres alltid verbatim, aldri omskrevet.",
    status: "inaktiv",
    schedule: "Manuell kjøring",
    lastRun: "4. jun 14:20",
    nextRun: "—",
    runsToday: 0,
    successRate: 100,
    avgDuration: "12 s / produkt",
    lastMessage: "Batch 3/8 fullført · 152 produkter igjen",
  },
  {
    id: "ag-suppress",
    name: "Suppressjon-synk",
    type: "Marketing · Klaviyo",
    description:
      "Synkroniserer avmeldte og bouncede kontakter mot annonseplattformene for å unngå bortkastet spend.",
    status: "feil",
    schedule: "Hver 6. time",
    lastRun: "I dag 12:00",
    nextRun: "I dag 18:00",
    runsToday: 2,
    successRate: 81,
    avgDuration: "1 min 06 s",
    lastMessage: "API 429 fra Meta · retry planlagt",
  },
  {
    id: "ag-reviews",
    name: "Anmeldelsesvokter",
    type: "Kundeservice · detox.no",
    description:
      "Overvåker nye produktanmeldelser, varsler om 1–2-stjerners og foreslår svarutkast på norsk.",
    status: "kjorer",
    schedule: "Hver time",
    lastRun: "I dag 13:00",
    nextRun: "I dag 14:00",
    runsToday: 13,
    successRate: 99,
    avgDuration: "9 s",
    lastMessage: "2 nye anmeldelser · 1 svarutkast klart",
  },
]

const FILTERS: { key: AgentStatus | "alle"; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "kjorer", label: "Kjører" },
  { key: "planlagt", label: "Planlagt" },
  { key: "feil", label: "Feil" },
  { key: "inaktiv", label: "Inaktive" },
]

// ── component ─────────────────────────────────────────────────
export default function Agenter() {
  const [filter, setFilter] = React.useState<AgentStatus | "alle">("alle")

  const visible = AGENTS.filter((a) => filter === "alle" || a.status === filter)

  const running = AGENTS.filter((a) => a.status === "kjorer").length
  const errors = AGENTS.filter((a) => a.status === "feil").length
  const runsToday = AGENTS.reduce((a, x) => a + x.runsToday, 0)
  const avgRate = Math.round(
    AGENTS.reduce((a, x) => a + x.successRate, 0) / AGENTS.length,
  )

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Agenter
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Automatiseringer som kjører på vegne av detox.OS
          </p>
        </div>
        <Badge variant={errors > 0 ? "error" : "success"}>
          {errors > 0 ? `${errors} med feil` : "Alt friskt"}
        </Badge>
      </div>

      {/* ── KPI ── */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Aktive nå"
          value={`${running}`}
          hint="kjører"
          tone="success"
        />
        <KpiCard
          label="Kjøringer i dag"
          value={`${runsToday}`}
          hint="totalt på tvers"
        />
        <KpiCard
          label="Snitt suksessrate"
          value={`${avgRate}%`}
          hint="siste 30 dager"
          tone={avgRate >= 90 ? "success" : "warning"}
        />
        <KpiCard
          label="Feil"
          value={`${errors}`}
          hint="krever oppmerksomhet"
          tone={errors > 0 ? "error" : "success"}
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

      {/* ── Grid ── */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
            Ingen agenter i denne statusen.
          </div>
        ) : (
          visible.map((a) => {
            const meta = STATUS_META[a.status]
            return (
              <div
                key={a.id}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      {a.status === "kjorer" && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dot}`}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {a.name}
                      </p>
                      <p className="text-xs text-gray-400">{a.type}</p>
                    </div>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>

                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                  {a.description}
                </p>

                {/* metrics */}
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <Metric label="Plan" value={a.schedule} />
                  <Metric label="Sist kjørt" value={a.lastRun} />
                  <Metric label="Neste" value={a.nextRun} />
                </div>

                {/* success rate */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Suksessrate</span>
                    <span
                      className={`font-semibold ${rateClass(a.successRate)}`}
                    >
                      {a.successRate}%
                    </span>
                  </div>
                  <ProgressBar value={a.successRate} className="mt-2" />
                </div>

                {/* footer log */}
                <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {a.lastMessage}
                  </p>
                  <span className="shrink-0 text-xs text-gray-400">
                    {a.runsToday} kjøringer i dag
                  </span>
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
