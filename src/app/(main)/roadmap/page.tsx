"use client"

import React from "react"
import { Badge } from "@/components/Badge"

// ── types ─────────────────────────────────────────────────────
type Column = "ide" | "planlagt" | "pagar" | "ferdig"
type Priority = "lav" | "medium" | "hoy"

type Item = {
  id: string
  title: string
  project: string
  column: Column
  priority: Priority
  effort: string
  target: string
  note: string
}

// ── constants ─────────────────────────────────────────────────
const COLUMNS: { key: Column; label: string; accent: string }[] = [
  { key: "ide", label: "Idé", accent: "bg-gray-400" },
  { key: "planlagt", label: "Planlagt", accent: "bg-blue-500" },
  { key: "pagar", label: "Pågår", accent: "bg-yellow-500" },
  { key: "ferdig", label: "Ferdig", accent: "bg-emerald-500" },
]
const PRIORITY_BADGE: Record<
  Priority,
  { label: string; variant: "error" | "warning" | "neutral" }
> = {
  hoy: { label: "Høy", variant: "error" },
  medium: { label: "Medium", variant: "warning" },
  lav: { label: "Lav", variant: "neutral" },
}
const PROJECT_DOT: Record<string, string> = {
  "detox.OS": "bg-emerald-500",
  "Ad agent": "bg-indigo-500",
  "Shopify-tema": "bg-pink-500",
  HealthOS: "bg-amber-500",
}

// ── mock data ─────────────────────────────────────────────────
const ITEMS: Item[] = [
  {
    id: "rm-1",
    title: "Leverandørregister med COA-arkiv",
    project: "detox.OS",
    column: "pagar",
    priority: "hoy",
    effort: "M",
    target: "Juni 2026",
    note: "Batch-historikk og ledetidssporing live.",
  },
  {
    id: "rm-2",
    title: "Agent- og pipeline-overvåking",
    project: "detox.OS",
    column: "pagar",
    priority: "hoy",
    effort: "M",
    target: "Juni 2026",
    note: "Status, suksessrate og siste-kjøring per agent.",
  },
  {
    id: "rm-3",
    title: "SOP-bibliotek med sjekklister",
    project: "detox.OS",
    column: "ferdig",
    priority: "medium",
    effort: "S",
    target: "Juni 2026",
    note: "Interaktive playbooks med fremdrift.",
  },
  {
    id: "rm-4",
    title: "Daglig digest til Telegram",
    project: "Ad agent",
    column: "ferdig",
    priority: "hoy",
    effort: "M",
    target: "Mai 2026",
    note: "ROAS-validering og anbefalinger 07:00.",
  },
  {
    id: "rm-5",
    title: "Segmentert ROAS-terskel",
    project: "Ad agent",
    column: "pagar",
    priority: "medium",
    effort: "S",
    target: "Juni 2026",
    note: "[COLD]/[WARM]/[EMAIL] med cold-start-guard.",
  },
  {
    id: "rm-6",
    title: "Produkttekst-migrering 389 produkter",
    project: "Shopify-tema",
    column: "planlagt",
    priority: "hoy",
    effort: "L",
    target: "Juli 2026",
    note: "body_html → strukturerte metafields, INCI verbatim.",
  },
  {
    id: "rm-7",
    title: "Quiz-anbefalingsmotor v2",
    project: "Shopify-tema",
    column: "planlagt",
    priority: "medium",
    effort: "M",
    target: "Juli 2026",
    note: "Koble quiz-svar tettere til produktutvalg.",
  },
  {
    id: "rm-8",
    title: "Strukturert data — fiks OutOfStock-bug",
    project: "Shopify-tema",
    column: "ide",
    priority: "medium",
    effort: "S",
    target: "Q3 2026",
    note: "Rich Results feiler på utsolgte varer.",
  },
  {
    id: "rm-9",
    title: "Biologisk prioritetshierarki-rammeverk",
    project: "HealthOS",
    column: "ide",
    priority: "lav",
    effort: "L",
    target: "Q4 2026",
    note: "Konseptfase — kjernemodell for portalen.",
  },
  {
    id: "rm-10",
    title: "Fiken-bankavstemming automatisering",
    project: "detox.OS",
    column: "planlagt",
    priority: "medium",
    effort: "M",
    target: "Juli 2026",
    note: "Auto-match transaksjoner mot bilag.",
  },
  {
    id: "rm-11",
    title: "Innstillinger og integrasjonsnøkler",
    project: "detox.OS",
    column: "ide",
    priority: "lav",
    effort: "S",
    target: "Q3 2026",
    note: "Sentralt panel for API-koblinger.",
  },
]

const PROJECTS = ["Alle", ...Object.keys(PROJECT_DOT)]

// ── component ─────────────────────────────────────────────────
export default function Roadmap() {
  const [project, setProject] = React.useState("Alle")

  const filtered =
    project === "Alle" ? ITEMS : ITEMS.filter((i) => i.project === project)

  const total = filtered.length
  const inProgress = filtered.filter((i) => i.column === "pagar").length
  const done = filtered.filter((i) => i.column === "ferdig").length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Roadmap
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hva som er under bygging på tvers av prosjekter
          </p>
        </div>
        <Badge variant="neutral">{ITEMS.length} initiativer</Badge>
      </div>

      {/* ── KPI ── */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Totalt" value={`${total}`} hint="i visningen" />
        <KpiCard
          label="Pågår"
          value={`${inProgress}`}
          hint="aktivt arbeid"
          tone="warning"
        />
        <KpiCard
          label="Ferdig"
          value={`${done}`}
          hint="levert"
          tone="success"
        />
        <KpiCard
          label="Fremdrift"
          value={`${pct}%`}
          hint="ferdig av totalt"
          tone="success"
        />
      </section>

      {/* ── Toolbar ── */}
      <div className="mt-8 flex flex-wrap gap-1.5">
        {PROJECTS.map((p) => (
          <button
            key={p}
            onClick={() => setProject(p)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              project === p
                ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {p !== "Alle" && (
              <span className={`h-2 w-2 rounded-full ${PROJECT_DOT[p]}`} />
            )}
            {p}
          </button>
        ))}
      </div>

      {/* ── Kanban ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = filtered.filter((i) => i.column === col.key)
          return (
            <div key={col.key} className="flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.accent}`} />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    {col.label}
                  </h2>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {cards.length}
                </span>
              </div>

              <div className="flex-1 space-y-3 rounded-lg bg-gray-50/60 p-3 dark:bg-gray-900/40">
                {cards.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">Tomt</p>
                ) : (
                  cards.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                          {c.title}
                        </p>
                        <Badge variant={PRIORITY_BADGE[c.priority].variant}>
                          {PRIORITY_BADGE[c.priority].label}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {c.note}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span
                            className={`h-2 w-2 rounded-full ${PROJECT_DOT[c.project]}`}
                          />
                          {c.project}
                        </span>
                        <span className="text-xs text-gray-400">
                          {c.effort} · {c.target}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
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
  tone?: "neutral" | "success" | "warning"
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warning"
        ? "text-yellow-700 dark:text-yellow-500"
        : "text-gray-900 dark:text-gray-50"
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  )
}
