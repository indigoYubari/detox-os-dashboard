"use client"

import React from "react"

// ── mock data ─────────────────────────────────────────────────
const SUPPORT_KPIS = {
  openTickets: 12,
  avgResponseMin: 47,
  avgResponsePrev: 62,
  resolvedToday: 6,
  resolvedWeek: 34,
  satisfaction: 94,
  satisfactionPrev: 91,
}

type TicketStatus = "åpen" | "venter på svar" | "løst"
type TicketPriority = "høy" | "normal" | "lav"

type Ticket = {
  id: string
  subject: string
  customer: string
  status: TicketStatus
  priority: TicketPriority
  created: string
  lastReply: string
  category: string
}

const TICKETS: Ticket[] = [
  { id: "T-1284", subject: "Mangler pakke — ordre #10831", customer: "Lise M.", status: "åpen", priority: "høy", created: "2026-06-07 14:20", lastReply: "2026-06-07 14:20", category: "Levering" },
  { id: "T-1283", subject: "Spørsmål om TUDCA og amming", customer: "Camilla R.", status: "åpen", priority: "høy", created: "2026-06-07 11:45", lastReply: "2026-06-07 12:10", category: "Produktinfo" },
  { id: "T-1282", subject: "Ønsker å bytte til annen variant", customer: "Erik S.", status: "venter på svar", priority: "normal", created: "2026-06-06 22:30", lastReply: "2026-06-07 09:15", category: "Bytte/retur" },
  { id: "T-1281", subject: "Rabattkode fungerer ikke", customer: "Nina K.", status: "åpen", priority: "normal", created: "2026-06-06 18:00", lastReply: "2026-06-06 18:00", category: "Betaling" },
  { id: "T-1280", subject: "Allergispørsmål — inneholder produktet soya?", customer: "Trond H.", status: "venter på svar", priority: "høy", created: "2026-06-06 15:20", lastReply: "2026-06-06 16:40", category: "Produktinfo" },
  { id: "T-1279", subject: "Abonnement — ønsker å pause i juli", customer: "Hanne B.", status: "åpen", priority: "normal", created: "2026-06-06 10:15", lastReply: "2026-06-06 10:15", category: "Abonnement" },
  { id: "T-1278", subject: "Takk for rask levering!", customer: "Morten A.", status: "løst", priority: "lav", created: "2026-06-05 20:00", lastReply: "2026-06-06 08:30", category: "Generelt" },
  { id: "T-1277", subject: "Feil produkt mottatt", customer: "Inger L.", status: "løst", priority: "høy", created: "2026-06-05 14:10", lastReply: "2026-06-06 11:00", category: "Bytte/retur" },
  { id: "T-1276", subject: "Spørsmål om dosering magnesium", customer: "Per G.", status: "løst", priority: "normal", created: "2026-06-05 09:30", lastReply: "2026-06-05 10:15", category: "Produktinfo" },
  { id: "T-1275", subject: "Vil gjerne ha faktura på e-post", customer: "Kari D.", status: "løst", priority: "lav", created: "2026-06-04 16:45", lastReply: "2026-06-05 08:00", category: "Betaling" },
]

const TEMPLATES = [
  { name: "Leveringsstatus", uses: 48 },
  { name: "Retur/bytte-prosess", uses: 32 },
  { name: "Allergener & ingredienser", uses: 28 },
  { name: "Abonnement-endring", uses: 21 },
  { name: "Rabattkode-hjelp", uses: 16 },
]

// ── constants ─────────────────────────────────────────────────
const STATUS_STYLE: Record<TicketStatus, string> = {
  åpen: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "venter på svar": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  løst: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
}

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  høy: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  normal: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  lav: "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500",
}

// ── helpers ───────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const now = new Date("2026-06-07T21:00:00")
  const then = new Date(dateStr)
  const diffH = Math.round((now.getTime() - then.getTime()) / (1000 * 60 * 60))
  if (diffH < 1) return "Akkurat nå"
  if (diffH < 24) return `${diffH}t siden`
  return `${Math.round(diffH / 24)}d siden`
}

// ── component ─────────────────────────────────────────────────
export default function KundeservicePage() {
  const [statusFilter, setStatusFilter] = React.useState<TicketStatus | "alle">("alle")

  const filtered = statusFilter === "alle"
    ? TICKETS
    : TICKETS.filter((t) => t.status === statusFilter)

  const respChange = ((SUPPORT_KPIS.avgResponseMin - SUPPORT_KPIS.avgResponsePrev) / SUPPORT_KPIS.avgResponsePrev * 100)
  const satChange = SUPPORT_KPIS.satisfaction - SUPPORT_KPIS.satisfactionPrev

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Kundeservice
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Support-innboks, svarmaler, sentiment og svartid
        </p>
      </div>

      {/* KPIs */}
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className={`rounded-lg border p-5 ${
            SUPPORT_KPIS.openTickets > 10
              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
              : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
          }`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Åpne henvendelser</p>
            <p className={`mt-2 text-2xl font-semibold ${
              SUPPORT_KPIS.openTickets > 10
                ? "text-yellow-700 dark:text-yellow-300"
                : "text-gray-900 dark:text-gray-50"
            }`}>
              {SUPPORT_KPIS.openTickets}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Snitt svartid</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {SUPPORT_KPIS.avgResponseMin} min
            </p>
            <p className={`mt-1 text-xs ${respChange <= 0 ? "text-green-600" : "text-red-500"}`}>
              {respChange <= 0 ? "↓" : "↑"} {Math.abs(respChange).toFixed(0)}% vs forrige uke
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Løst denne uka</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {SUPPORT_KPIS.resolvedWeek}
            </p>
            <p className="mt-1 text-xs text-gray-400">{SUPPORT_KPIS.resolvedToday} i dag</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
            <p className="text-sm text-gray-600 dark:text-gray-400">Tilfredshet</p>
            <p className="mt-2 text-2xl font-semibold text-green-700 dark:text-green-300">
              {SUPPORT_KPIS.satisfaction}%
            </p>
            <p className="mt-1 text-xs text-green-600">
              +{satChange}pp vs forrige uke
            </p>
          </div>
        </div>
      </section>

      {/* Two-column: Tickets + Sidebar */}
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Ticket Table */}
        <section className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Henvendelser
            </h2>
            <div className="flex gap-2">
              {(["alle", "åpen", "venter på svar", "løst"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  {f === "alle" ? "Alle" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Henvendelse</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Kategori</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Prioritet</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Sist aktivitet</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-50">{ticket.subject}</p>
                      <p className="text-xs text-gray-400">{ticket.id} · {ticket.customer}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {ticket.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {timeAgo(ticket.lastReply)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sidebar: Templates + Category breakdown */}
        <section className="space-y-8">
          {/* Top Templates */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Mest brukte svarmaler
            </h2>
            <div className="mt-4 space-y-3">
              {TEMPLATES.map((tmpl, i) => (
                <div
                  key={tmpl.name}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {i + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{tmpl.name}</p>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{tmpl.uses}×</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Fordeling per kategori
            </h2>
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              {(() => {
                const cats: Record<string, number> = {}
                TICKETS.forEach((t) => { cats[t.category] = (cats[t.category] || 0) + 1 })
                const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
                const max = sorted[0]?.[1] ?? 1
                return (
                  <div className="space-y-3">
                    {sorted.map(([cat, count]) => (
                      <div key={cat}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{cat}</span>
                          <span className="text-gray-500 dark:text-gray-400">{count}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-1.5 rounded-full bg-indigo-500"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
