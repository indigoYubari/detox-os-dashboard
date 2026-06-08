"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"

// ── types ─────────────────────────────────────────────────────
type Tool = {
  id: string
  name: string
  category: string
  model: string
  description: string
  lastUsed: string
  runs: number
  favorite: boolean
}

// ── helpers ───────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  })
}
function modelVariant(model: string): "default" | "success" | "warning" {
  if (model.includes("Opus")) return "default"
  if (model.includes("Sonnet")) return "success"
  return "warning"
}

// ── mock data ─────────────────────────────────────────────────
const TOOLS: Tool[] = [
  {
    id: "t-rewriter",
    name: "Produktskriver",
    category: "Innhold",
    model: "Sonnet 4.6",
    description:
      "Genererer strukturerte metafields fra produktinfo. INCI-lister kopieres verbatim, aldri omskrevet.",
    lastUsed: "2026-06-04",
    runs: 237,
    favorite: true,
  },
  {
    id: "t-adcopy",
    name: "Annonsetekst-generator",
    category: "Marketing",
    model: "Sonnet 4.6",
    description:
      "Lager varianter av annonsetekst for Meta og Google på norsk, tilpasset segment og tilbud.",
    lastUsed: "2026-06-05",
    runs: 84,
    favorite: true,
  },
  {
    id: "t-newsletter",
    name: "Nyhetsbrev-assistent",
    category: "Innhold",
    model: "Sonnet 4.6",
    description:
      "Skriver ukentlig nyhetsbrev i detox-tone, med emnefelt-varianter for A/B-test.",
    lastUsed: "2026-06-03",
    runs: 41,
    favorite: false,
  },
  {
    id: "t-roas",
    name: "ROAS-analytiker",
    category: "Marketing",
    model: "Opus 4.8",
    description:
      "Tolker kampanjedata på tvers av kanaler og foreslår budsjettjusteringer mot terskler.",
    lastUsed: "2026-06-05",
    runs: 19,
    favorite: false,
  },
  {
    id: "t-fm",
    name: "Funksjonell medisin-analyse",
    category: "Helse",
    model: "Opus 4.8",
    description:
      "Strukturerer pasientcase, lab og genetiske varianter. Aldri diagnose — beslutningsstøtte for behandler.",
    lastUsed: "2026-05-30",
    runs: 12,
    favorite: true,
  },
  {
    id: "t-seo",
    name: "SEO-tekstforbedrer",
    category: "Innhold",
    model: "Haiku 4.5",
    description:
      "Optimaliserer meta-titler og beskrivelser for søk, innenfor lengdegrenser og uten helsepåstander.",
    lastUsed: "2026-06-01",
    runs: 56,
    favorite: false,
  },
  {
    id: "t-support",
    name: "Kundesvar-utkast",
    category: "Kundeservice",
    model: "Haiku 4.5",
    description:
      "Foreslår svarutkast på henvendelser i riktig tone. Eskalerer helsespørsmål til manuell håndtering.",
    lastUsed: "2026-06-05",
    runs: 128,
    favorite: false,
  },
  {
    id: "t-invoice",
    name: "Faktura-klassifiserer",
    category: "Økonomi",
    model: "Haiku 4.5",
    description:
      "Leser fakturaer fra Gmail, gjenkjenner avsender og foreslår kontering til Fiken.",
    lastUsed: "2026-06-05",
    runs: 73,
    favorite: false,
  },
]

const CATEGORIES = [
  "Alle",
  ...Array.from(new Set(TOOLS.map((t) => t.category))),
]

// ── component ─────────────────────────────────────────────────
export default function AiVerktoy() {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("Alle")

  const visible = TOOLS.filter((t) => {
    const matchCat = category === "Alle" || t.category === category
    const q = query.trim().toLowerCase()
    const matchQuery =
      q === "" ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    return matchCat && matchQuery
  })

  const totalRuns = TOOLS.reduce((a, t) => a + t.runs, 0)
  const favorites = visible.filter((t) => t.favorite)
  const rest = visible.filter((t) => !t.favorite)

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            AI-verktøy
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Status og kjøring for produktskriver, ad-agent, og andre verktøy
          </p>
        </div>
        <Badge variant="neutral">{TOOLS.length} verktøy</Badge>
      </div>

      {/* ── KPI ── */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Verktøy"
          value={`${TOOLS.length}`}
          hint="tilgjengelige"
        />
        <KpiCard
          label="Favoritter"
          value={`${TOOLS.filter((t) => t.favorite).length}`}
          hint="hurtigtilgang"
          tone="success"
        />
        <KpiCard
          label="Kjøringer"
          value={`${totalRuns}`}
          hint="totalt registrert"
        />
      </section>

      {/* ── Toolbar ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                category === c
                  ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Søk verktøy…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          Ingen verktøy matcher.
        </div>
      )}

      {/* ── Favorites ── */}
      {favorites.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            ★ Favoritter
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((t) => (
              <ToolCard key={t.id} tool={t} />
            ))}
          </div>
        </section>
      )}

      {/* ── Rest ── */}
      {rest.length > 0 && (
        <section className="mt-8">
          {favorites.length > 0 && (
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Alle verktøy
            </h2>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((t) => (
              <ToolCard key={t.id} tool={t} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// ── small parts ───────────────────────────────────────────────
function ToolCard({ tool }: { tool: Tool }) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            ✦
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              {tool.name}
            </p>
            <p className="text-xs text-gray-400">{tool.category}</p>
          </div>
        </div>
        {tool.favorite && (
          <span className="text-sm text-yellow-500" title="Favoritt">
            ★
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-sm text-gray-600 dark:text-gray-300">
        {tool.description}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <Badge variant={modelVariant(tool.model)}>{tool.model}</Badge>
        <span className="text-xs text-gray-400">
          {tool.runs} kjøringer · {fmtDate(tool.lastUsed)}
        </span>
      </div>

      <button className="mt-4 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200">
        Åpne verktøy
      </button>
    </div>
  )
}

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
