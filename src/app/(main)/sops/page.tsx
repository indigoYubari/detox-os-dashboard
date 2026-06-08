"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"
import { ProgressBar } from "@/components/ProgressBar"

// ── types ─────────────────────────────────────────────────────
type SopStatus = "aktiv" | "utkast" | "utdatert"

type Sop = {
  id: string
  title: string
  category: string
  owner: string
  frequency: string
  lastUpdated: string
  status: SopStatus
  summary: string
  steps: string[]
}

// ── helpers ───────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
const STATUS_BADGE: Record<
  SopStatus,
  { label: string; variant: "success" | "warning" | "neutral" }
> = {
  aktiv: { label: "Aktiv", variant: "success" },
  utkast: { label: "Utkast", variant: "neutral" },
  utdatert: { label: "Trenger revisjon", variant: "warning" },
}

// ── mock data ─────────────────────────────────────────────────
const SOPS: Sop[] = [
  {
    id: "sop-ny-produkt",
    title: "Lansere nytt produkt",
    category: "Produkt",
    owner: "Kim",
    frequency: "Ved behov",
    lastUpdated: "2026-05-30",
    status: "aktiv",
    summary:
      "Fra godkjent leverandørbatch til publisert produkt på detox.no med komplette metafields.",
    steps: [
      "Bekreft COA og batch godkjent fra leverandør",
      "Opprett produkt i Shopify med riktig kolleksjon",
      "Fyll metafields: short_description, benefits, dosage, certifications",
      "Lim inn full_ingredients verbatim — aldri AI-omskriv INCI",
      "Sjekk helsepåstander mot Forbrukertilsynets regelverk",
      "Sett pris, lager og MVA-sats",
      "Legg til i relevant quiz-anbefaling",
      "Publiser og verifiser strukturert data i Rich Results",
    ],
  },
  {
    id: "sop-bankavstemming",
    title: "Månedlig bankavstemming",
    category: "Økonomi",
    owner: "Kim / Iman",
    frequency: "Månedlig",
    lastUpdated: "2026-06-01",
    status: "aktiv",
    summary:
      "Avstem DNB-transaksjoner mot Fiken-bilag og lukk regnskapsperioden.",
    steps: [
      "Hent banktransaksjoner fra DNB for perioden",
      "Kjør fakturahenter for manglende bilag fra Gmail",
      "Match innbetalinger mot utgående fakturaer",
      "Match utbetalinger mot inngående fakturaer",
      "Bokfør gebyrer og renter manuelt",
      "Sjekk MVA-grunnlag før innsending",
      "Lukk perioden i Fiken",
    ],
  },
  {
    id: "sop-kampanje",
    title: "Sette opp annonsekampanje",
    category: "Marketing",
    owner: "Kim",
    frequency: "Ukentlig",
    lastUpdated: "2026-05-18",
    status: "aktiv",
    summary:
      "Lansér ny kampanje på Google Ads / Meta med ROAS-terskler og Telegram-varsling.",
    steps: [
      "Definer segment og ROAS-terskel ([COLD]/[WARM]/[EMAIL])",
      "Bygg annonsesett med godkjent kreativ",
      "Sett dagsbudsjett og cold-start-guard",
      "Koble til suppressjonslister fra Klaviyo",
      "Aktiver og registrer i annonseagenten",
      "Overvåk første 48t i daglig digest",
    ],
  },
  {
    id: "sop-kundeservice",
    title: "Svare på kundehenvendelse",
    category: "Kundeservice",
    owner: "Kim",
    frequency: "Daglig",
    lastUpdated: "2026-04-22",
    status: "utdatert",
    summary:
      "Standardflyt for e-post og chat — tone, svartid og eskalering ved helsespørsmål.",
    steps: [
      "Klassifiser henvendelse: ordre / produkt / helse / retur",
      "Slå opp kundens ordrehistorikk i Shopify",
      "Svar innen 24t på norsk bokmål",
      "Ved helsespørsmål: ingen diagnose, henvis til kvalifisert behandler",
      "Logg utfall og oppdater eventuelt FAQ",
    ],
  },
  {
    id: "sop-retur",
    title: "Behandle retur og refusjon",
    category: "Kundeservice",
    owner: "Kim",
    frequency: "Ved behov",
    lastUpdated: "2026-03-11",
    status: "utkast",
    summary:
      "Fra returforespørsel til kreditnota i Fiken og refundert beløp til kunde.",
    steps: [
      "Verifiser returrett (14 dager, uåpnet)",
      "Registrer retur i Shopify",
      "Opprett kreditnota i Fiken",
      "Refunder via opprinnelig betalingsmetode",
      "Oppdater lager hvis varen kan selges på nytt",
    ],
  },
  {
    id: "sop-nyhetsbrev",
    title: "Sende ukentlig nyhetsbrev",
    category: "Innhold",
    owner: "Kim",
    frequency: "Ukentlig",
    lastUpdated: "2026-05-26",
    status: "aktiv",
    summary:
      "Klaviyo-flyt for ukentlig nyhetsbrev med segmentering og A/B på emnefelt.",
    steps: [
      "Velg tema og produktfokus for uken",
      "Skriv tekst på norsk bokmål (detox-content)",
      "Sett opp A/B-test på emnefelt",
      "Segmenter mottakere og ekskluder nylig kjøpt",
      "Planlegg utsending tirsdag 09:00",
      "Sjekk åpnings- og klikkrate etter 48t",
    ],
  },
]

const CATEGORIES = ["Alle", ...Array.from(new Set(SOPS.map((s) => s.category)))]

// ── component ─────────────────────────────────────────────────
export default function Sops() {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("Alle")
  const [selectedId, setSelectedId] = React.useState<string>(SOPS[0].id)
  const [checked, setChecked] = React.useState<Set<string>>(new Set())

  const visible = SOPS.filter((s) => {
    const matchCat = category === "Alle" || s.category === category
    const q = query.trim().toLowerCase()
    const matchQuery =
      q === "" ||
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    return matchCat && matchQuery
  })

  const selected = SOPS.find((s) => s.id === selectedId) ?? null

  const toggleStep = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeCount = SOPS.filter((s) => s.status === "aktiv").length
  const staleCount = SOPS.filter((s) => s.status === "utdatert").length
  const catCount = new Set(SOPS.map((s) => s.category)).size

  const selDone = selected
    ? selected.steps.filter((_, i) => checked.has(`${selected.id}:${i}`)).length
    : 0
  const selPct =
    selected && selected.steps.length > 0
      ? Math.round((selDone / selected.steps.length) * 100)
      : 0

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            SOPs
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Dokumenterte prosedyrer og playbooks
          </p>
        </div>
        <Badge variant={staleCount > 0 ? "warning" : "success"}>
          {staleCount > 0
            ? `${staleCount} trenger revisjon`
            : "Alle oppdaterte"}
        </Badge>
      </div>

      {/* ── KPI ── */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Totalt" value={`${SOPS.length}`} hint="prosedyrer" />
        <KpiCard
          label="Aktive"
          value={`${activeCount}`}
          hint="i bruk"
          tone="success"
        />
        <KpiCard
          label="Trenger revisjon"
          value={`${staleCount}`}
          hint="utdaterte"
          tone={staleCount > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Kategorier"
          value={`${catCount}`}
          hint="områder dekket"
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
            placeholder="Søk prosedyre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Master / detail ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* list */}
        <div className="space-y-3 xl:col-span-1">
          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
              Ingen prosedyrer matcher.
            </div>
          ) : (
            visible.map((s) => {
              const isSel = s.id === selectedId
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`block w-full rounded-lg border p-4 text-left transition ${
                    isSel
                      ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/30 dark:ring-emerald-700"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {s.title}
                    </p>
                    <Badge variant={STATUS_BADGE[s.status].variant}>
                      {STATUS_BADGE[s.status].label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {s.category} · {s.steps.length} steg · {s.frequency}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* detail */}
        <div className="xl:col-span-2">
          {selected ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                      {selected.title}
                    </h2>
                    <Badge variant={STATUS_BADGE[selected.status].variant}>
                      {STATUS_BADGE[selected.status].label}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                    {selected.summary}
                  </p>
                </div>
              </div>

              {/* meta */}
              <div className="mt-5 grid grid-cols-2 gap-4 border-y border-gray-100 py-4 sm:grid-cols-4 dark:border-gray-800">
                <Meta label="Kategori" value={selected.category} />
                <Meta label="Eier" value={selected.owner} />
                <Meta label="Frekvens" value={selected.frequency} />
                <Meta
                  label="Sist oppdatert"
                  value={fmtDate(selected.lastUpdated)}
                />
              </div>

              {/* progress */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Fremdrift · {selDone} av {selected.steps.length} steg
                  </span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {selPct}%
                  </span>
                </div>
                <ProgressBar value={selPct} className="mt-2" />
              </div>

              {/* checklist */}
              <ol className="mt-5 space-y-2">
                {selected.steps.map((step, i) => {
                  const key = `${selected.id}:${i}`
                  const done = checked.has(key)
                  return (
                    <li key={key}>
                      <button
                        onClick={() => toggleStep(key)}
                        className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                          done
                            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                            : "border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-gray-300 text-transparent dark:border-gray-600"
                          }`}
                        >
                          ✓
                        </span>
                        <span
                          className={`text-sm ${
                            done
                              ? "text-gray-400 line-through dark:text-gray-500"
                              : "text-gray-700 dark:text-gray-200"
                          }`}
                        >
                          <span className="mr-1.5 font-medium text-gray-400">
                            {i + 1}.
                          </span>
                          {step}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
              Velg en prosedyre.
            </div>
          )}
        </div>
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
        {value}
      </p>
    </div>
  )
}
