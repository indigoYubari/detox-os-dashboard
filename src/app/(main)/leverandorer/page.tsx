"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"
import { ProgressBar } from "@/components/ProgressBar"

// ── types ─────────────────────────────────────────────────────
type SupplierStatus = "aktiv" | "pause" | "ny"
type CoaStatus = "ok" | "mangler" | "utlopt"

type Batch = {
  ref: string
  date: string
  qty: string
  status: "godkjent" | "karantene" | "avvist"
}

type Supplier = {
  id: string
  name: string
  category: string
  country: string
  contact: string
  email: string
  phone: string
  leadTimeDays: number
  moq: string
  payment: string
  status: SupplierStatus
  coa: CoaStatus
  quality: number
  batches: Batch[]
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
  SupplierStatus,
  { label: string; variant: "success" | "warning" | "neutral" }
> = {
  aktiv: { label: "Aktiv", variant: "success" },
  pause: { label: "På pause", variant: "warning" },
  ny: { label: "Ny", variant: "neutral" },
}
const COA_BADGE: Record<
  CoaStatus,
  { label: string; variant: "success" | "warning" | "error" }
> = {
  ok: { label: "COA OK", variant: "success" },
  mangler: { label: "COA mangler", variant: "error" },
  utlopt: { label: "COA utløpt", variant: "warning" },
}
const BATCH_BADGE: Record<Batch["status"], "success" | "warning" | "error"> = {
  godkjent: "success",
  karantene: "warning",
  avvist: "error",
}
function qualityClass(q: number) {
  if (q >= 90) return "text-emerald-600 dark:text-emerald-400"
  if (q >= 75) return "text-yellow-600 dark:text-yellow-500"
  return "text-red-600 dark:text-red-400"
}

// ── mock data ─────────────────────────────────────────────────
const SUPPLIERS: Supplier[] = [
  {
    id: "lev-001",
    name: "Nordic Botanicals AS",
    category: "Urteekstrakter",
    country: "Norge",
    contact: "Ingrid Solberg",
    email: "ingrid@nordicbotanicals.no",
    phone: "+47 920 11 223",
    leadTimeDays: 14,
    moq: "5 kg",
    payment: "Netto 30",
    status: "aktiv",
    coa: "ok",
    quality: 96,
    batches: [
      {
        ref: "NB-2406-A",
        date: "2026-05-22",
        qty: "12 kg",
        status: "godkjent",
      },
      { ref: "NB-2403-C", date: "2026-03-09", qty: "8 kg", status: "godkjent" },
      {
        ref: "NB-2401-A",
        date: "2026-01-14",
        qty: "10 kg",
        status: "godkjent",
      },
    ],
  },
  {
    id: "lev-002",
    name: "PureMag Labs GmbH",
    category: "Mineraler",
    country: "Tyskland",
    contact: "Markus Weber",
    email: "m.weber@puremag.de",
    phone: "+49 30 5566 7788",
    leadTimeDays: 21,
    moq: "25 kg",
    payment: "Forskudd 50%",
    status: "aktiv",
    coa: "ok",
    quality: 91,
    batches: [
      { ref: "PM-118", date: "2026-05-30", qty: "30 kg", status: "godkjent" },
      { ref: "PM-114", date: "2026-04-02", qty: "25 kg", status: "karantene" },
    ],
  },
  {
    id: "lev-003",
    name: "Atlantic Omega Sourcing",
    category: "Omega-3",
    country: "Island",
    contact: "Sara Jónsdóttir",
    email: "sara@atlanticomega.is",
    phone: "+354 555 9090",
    leadTimeDays: 28,
    moq: "50 kg",
    payment: "Netto 45",
    status: "aktiv",
    coa: "utlopt",
    quality: 88,
    batches: [
      { ref: "AO-771", date: "2026-04-18", qty: "60 kg", status: "godkjent" },
      { ref: "AO-755", date: "2026-02-11", qty: "50 kg", status: "godkjent" },
    ],
  },
  {
    id: "lev-004",
    name: "VitaCaps Packaging",
    category: "Kapsler & emballasje",
    country: "Polen",
    contact: "Tomasz Nowak",
    email: "tomasz@vitacaps.pl",
    phone: "+48 22 333 4455",
    leadTimeDays: 18,
    moq: "100 000 stk",
    payment: "Netto 30",
    status: "pause",
    coa: "ok",
    quality: 82,
    batches: [
      {
        ref: "VC-2025-09",
        date: "2026-03-27",
        qty: "120 000 stk",
        status: "godkjent",
      },
    ],
  },
  {
    id: "lev-005",
    name: "Helios Probiotics",
    category: "Probiotika",
    country: "Danmark",
    contact: "Lene Kristensen",
    email: "lk@heliosprobiotics.dk",
    phone: "+45 70 22 11 00",
    leadTimeDays: 25,
    moq: "10 kg",
    payment: "Netto 30",
    status: "aktiv",
    coa: "ok",
    quality: 94,
    batches: [
      {
        ref: "HP-CFU-44",
        date: "2026-05-12",
        qty: "14 kg",
        status: "godkjent",
      },
      {
        ref: "HP-CFU-41",
        date: "2026-03-19",
        qty: "12 kg",
        status: "godkjent",
      },
    ],
  },
  {
    id: "lev-006",
    name: "Sahel Adaptogens Ltd",
    category: "Adaptogener",
    country: "India",
    contact: "Priya Nair",
    email: "priya@saheladaptogens.in",
    phone: "+91 80 4123 5566",
    leadTimeDays: 42,
    moq: "20 kg",
    payment: "Forskudd 100%",
    status: "ny",
    coa: "mangler",
    quality: 71,
    batches: [
      { ref: "SA-001", date: "2026-05-04", qty: "20 kg", status: "karantene" },
    ],
  },
  {
    id: "lev-007",
    name: "Fjord Collagen Co",
    category: "Kollagen",
    country: "Norge",
    contact: "Henrik Aas",
    email: "henrik@fjordcollagen.no",
    phone: "+47 480 55 100",
    leadTimeDays: 12,
    moq: "15 kg",
    payment: "Netto 30",
    status: "aktiv",
    coa: "ok",
    quality: 93,
    batches: [
      { ref: "FC-302", date: "2026-05-28", qty: "18 kg", status: "godkjent" },
      { ref: "FC-298", date: "2026-04-09", qty: "15 kg", status: "godkjent" },
    ],
  },
  {
    id: "lev-008",
    name: "Iberia Citrus Extracts",
    category: "Vitamin C / bioflavonoider",
    country: "Spania",
    contact: "Carlos Méndez",
    email: "carlos@iberiacitrus.es",
    phone: "+34 91 222 3344",
    leadTimeDays: 30,
    moq: "30 kg",
    payment: "Netto 45",
    status: "pause",
    coa: "utlopt",
    quality: 79,
    batches: [
      { ref: "IC-509", date: "2026-02-25", qty: "30 kg", status: "avvist" },
      { ref: "IC-501", date: "2025-12-14", qty: "35 kg", status: "godkjent" },
    ],
  },
]

const FILTERS: { key: SupplierStatus | "alle"; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "aktiv", label: "Aktive" },
  { key: "pause", label: "På pause" },
  { key: "ny", label: "Nye" },
]

// ── component ─────────────────────────────────────────────────
export default function Leverandorer() {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<SupplierStatus | "alle">("alle")
  const [selectedId, setSelectedId] = React.useState<string>(SUPPLIERS[0].id)

  const visible = SUPPLIERS.filter((s) => {
    const matchStatus = filter === "alle" || s.status === filter
    const q = query.trim().toLowerCase()
    const matchQuery =
      q === "" ||
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q)
    return matchStatus && matchQuery
  })

  const selected = SUPPLIERS.find((s) => s.id === selectedId) ?? null

  const activeCount = SUPPLIERS.filter((s) => s.status === "aktiv").length
  const avgLead = Math.round(
    SUPPLIERS.reduce((a, s) => a + s.leadTimeDays, 0) / SUPPLIERS.length,
  )
  const coaCoverage = Math.round(
    (SUPPLIERS.filter((s) => s.coa === "ok").length / SUPPLIERS.length) * 100,
  )

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Leverandører
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kontakter, COA-er, ledetider og batch-historikk
          </p>
        </div>
        <Badge variant="neutral">{SUPPLIERS.length} leverandører</Badge>
      </div>

      {/* ── KPI ── */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Totalt"
          value={`${SUPPLIERS.length}`}
          hint="registrerte leverandører"
        />
        <KpiCard
          label="Aktive"
          value={`${activeCount}`}
          hint="leverer nå"
          tone="success"
        />
        <KpiCard
          label="Snitt ledetid"
          value={`${avgLead} dager`}
          hint="vektet snitt"
        />
        <KpiCard
          label="COA-dekning"
          value={`${coaCoverage}%`}
          hint="gyldige sertifikater"
          tone={coaCoverage >= 80 ? "success" : "warning"}
        />
      </section>

      {/* ── Toolbar ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
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
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Søk navn, kategori, land…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Master / detail ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* list */}
        <div className="space-y-3 xl:col-span-2">
          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
              Ingen leverandører matcher filteret.
            </div>
          ) : (
            visible.map((s) => {
              const isSel = s.id === selectedId
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`block w-full rounded-lg border p-5 text-left transition ${
                    isSel
                      ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/30 dark:ring-emerald-700"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {s.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {s.category} · {s.country}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant={STATUS_BADGE[s.status].variant}>
                        {STATUS_BADGE[s.status].label}
                      </Badge>
                      <Badge variant={COA_BADGE[s.coa].variant}>
                        {COA_BADGE[s.coa].label}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Metric label="Ledetid" value={`${s.leadTimeDays} d`} />
                    <Metric label="MOQ" value={s.moq} />
                    <div>
                      <p className="text-xs text-gray-400">Kvalitet</p>
                      <p
                        className={`text-sm font-semibold ${qualityClass(s.quality)}`}
                      >
                        {s.quality}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* detail */}
        <div className="xl:col-span-1">
          {selected ? (
            <div className="sticky top-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                  {selected.name}
                </h2>
                <Badge variant={STATUS_BADGE[selected.status].variant}>
                  {STATUS_BADGE[selected.status].label}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selected.category} · {selected.country}
              </p>

              {/* kvalitet */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Kvalitetsscore</span>
                  <span
                    className={`font-semibold ${qualityClass(selected.quality)}`}
                  >
                    {selected.quality}/100
                  </span>
                </div>
                <ProgressBar value={selected.quality} className="mt-2" />
              </div>

              {/* kontakt */}
              <dl className="mt-6 space-y-3 text-sm">
                <Row label="Kontaktperson" value={selected.contact} />
                <Row label="E-post" value={selected.email} />
                <Row label="Telefon" value={selected.phone} />
                <Row label="Ledetid" value={`${selected.leadTimeDays} dager`} />
                <Row label="MOQ" value={selected.moq} />
                <Row label="Betaling" value={selected.payment} />
                <Row label="COA" value={COA_BADGE[selected.coa].label} />
              </dl>

              {/* batch-historikk */}
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Batch-historikk
                </h3>
                <div className="mt-3 space-y-2">
                  {selected.batches.map((b) => (
                    <div
                      key={b.ref}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 dark:border-gray-800"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                          {b.ref}
                        </p>
                        <p className="text-xs text-gray-400">
                          {fmtDate(b.date)} · {b.qty}
                        </p>
                      </div>
                      <Badge variant={BATCH_BADGE[b.status]}>{b.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
              Velg en leverandør for detaljer.
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-900 dark:text-gray-200">
        {value}
      </dd>
    </div>
  )
}
