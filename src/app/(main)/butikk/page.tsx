"use client"
import { StatTooltip } from "@/components/ui/StatTooltip"

import React from "react"

// ── mock data (replace with Shopify API calls) ────────────────
const STORE_KPIS = {
  ordersToday: 8,
  ordersWeek: 47,
  ordersMonth: 186,
  revenueToday: 14_280,
  revenueWeek: 87_400,
  revenueMonth: 312_400,
  avgOrderValue: 1_680,
  avgOrderValuePrev: 1_540,
  conversionRate: 3.2,
  conversionRatePrev: 2.9,
  visitors7d: 4_820,
}

const TOP_PRODUCTS = [
  { name: "Glutathion Liposomal 250ml", sku: "GLU-LIP-250", sold: 42, revenue: 62_580, stock: 38 },
  { name: "NAC 600mg (120 kapsler)", sku: "NAC-600-120", sold: 38, revenue: 22_800, stock: 156 },
  { name: "Magnesium L-threonat", sku: "MAG-THR-90", sold: 31, revenue: 24_490, stock: 72 },
  { name: "TUDCA 250mg (60 kapsler)", sku: "TUD-250-60", sold: 28, revenue: 27_720, stock: 14 },
  { name: "Omega-3 EPA/DHA Premium", sku: "OMG-PRE-120", sold: 26, revenue: 18_200, stock: 89 },
  { name: "Berberine HCL 500mg", sku: "BER-500-90", sold: 24, revenue: 16_560, stock: 52 },
  { name: "Vitamin D3+K2 dråper", sku: "VIT-D3K2-30", sold: 22, revenue: 10_780, stock: 203 },
  { name: "Kreatin Monohydrat 500g", sku: "KRE-MON-500", sold: 19, revenue: 9_310, stock: 64 },
]

const LOW_STOCK_ALERTS = [
  { name: "TUDCA 250mg (60 kapsler)", sku: "TUD-250-60", stock: 14, reorderPoint: 25, daysUntilEmpty: 6 },
  { name: "Ashwagandha KSM-66", sku: "ASH-KSM-90", stock: 8, reorderPoint: 20, daysUntilEmpty: 4 },
  { name: "PQQ 20mg (60 kapsler)", sku: "PQQ-020-60", stock: 11, reorderPoint: 15, daysUntilEmpty: 9 },
  { name: "Lions Mane ekstrakt", sku: "LIO-EXT-90", stock: 18, reorderPoint: 30, daysUntilEmpty: 8 },
]

const RECENT_ORDERS = [
  { id: "#10847", date: "2026-06-07 19:42", customer: "Maria K.", items: 2, total: 1_980, status: "Betalt" as const },
  { id: "#10846", date: "2026-06-07 18:15", customer: "Anders T.", items: 1, total: 1_490, status: "Betalt" as const },
  { id: "#10845", date: "2026-06-07 16:30", customer: "Silje R.", items: 3, total: 3_240, status: "Betalt" as const },
  { id: "#10844", date: "2026-06-07 14:55", customer: "Henrik M.", items: 1, total: 990, status: "Betalt" as const },
  { id: "#10843", date: "2026-06-07 13:20", customer: "Ingrid L.", items: 4, total: 4_120, status: "Sendt" as const },
  { id: "#10842", date: "2026-06-07 11:05", customer: "Ole K.", items: 2, total: 1_680, status: "Sendt" as const },
  { id: "#10841", date: "2026-06-07 09:48", customer: "Karin B.", items: 1, total: 1_290, status: "Sendt" as const },
  { id: "#10840", date: "2026-06-06 22:12", customer: "Thomas H.", items: 2, total: 2_180, status: "Levert" as const },
]

// ── helpers ───────────────────────────────────────────────────
function kr(n: number) {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  Betalt: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Sendt: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Levert: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

// ── component ─────────────────────────────────────────────────
export default function ButikkPage() {
  const aovChange = ((STORE_KPIS.avgOrderValue - STORE_KPIS.avgOrderValuePrev) / STORE_KPIS.avgOrderValuePrev * 100)
  const crChange = ((STORE_KPIS.conversionRate - STORE_KPIS.conversionRatePrev) / STORE_KPIS.conversionRatePrev * 100)

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Butikk
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Shopify-butikken · Ordrer, omsetning, lagerstatus
        </p>
      </div>

      {/* KPI Row 1: Orders + Revenue */}
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400"><StatTooltip explanation="Antall fullforte Shopify-ordrer i dag.">Ordrer i dag</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{STORE_KPIS.ordersToday}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400"><StatTooltip explanation="Antall fullforte ordrer siden mandag denne uken.">Ordrer denne uka</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{STORE_KPIS.ordersWeek}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400"><StatTooltip explanation="Ordrer month-to-date: totalt antall ordrer fra 1. i denne maneden til i dag.">Ordrer MTD</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{STORE_KPIS.ordersMonth}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400"><StatTooltip explanation="Total salgsomsetning fra Shopify i dag.">Omsetning i dag</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{kr(STORE_KPIS.revenueToday)}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
            <p className="text-xs text-gray-600 dark:text-gray-400"><StatTooltip explanation="Gjennomsnittlig ordresum. Omsetning delt pa antall ordrer.">Snittordre</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-green-700 dark:text-green-300">{kr(STORE_KPIS.avgOrderValue)}</p>
            <p className={`mt-1 text-xs ${aovChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {aovChange >= 0 ? "↑" : "↓"} {Math.abs(aovChange).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400"><StatTooltip explanation="Andel besokende som legger inn en ordre. Bransjesnitt er 1-3%.">Konvertering</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{STORE_KPIS.conversionRate}%</p>
            <p className={`mt-1 text-xs ${crChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {crChange >= 0 ? "↑" : "↓"} {Math.abs(crChange).toFixed(1)}% · {STORE_KPIS.visitors7d.toLocaleString("nb-NO")} besøk/uke
            </p>
          </div>
        </div>
      </section>

      {/* Two-column: Top Products + Low Stock */}
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Top Products */}
        <section className="xl:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Topprodukter denne måneden
          </h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Produkt</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Solgt</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Omsetning</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Beholdning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {TOP_PRODUCTS.map((p, i) => (
                  <tr key={p.sku} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-50">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-50">
                      {p.sold}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-50">
                      {kr(p.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        p.stock < 20
                          ? "text-red-600 dark:text-red-400"
                          : p.stock < 50
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-gray-900 dark:text-gray-50"
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Low Stock Alerts */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Lav beholdning
            </h2>
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
              {LOW_STOCK_ALERTS.length} varsler
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {LOW_STOCK_ALERTS.map((alert) => (
              <div
                key={alert.sku}
                className={`rounded-lg border p-4 ${
                  alert.daysUntilEmpty <= 5
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {alert.name}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">På lager</p>
                      <p className={`text-sm font-semibold ${
                        alert.daysUntilEmpty <= 5
                          ? "text-red-600 dark:text-red-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {alert.stock} stk
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Bestillingspunkt</p>
                      <p className="text-sm text-gray-900 dark:text-gray-50">{alert.reorderPoint}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tomt om</p>
                    <p className={`text-sm font-semibold ${
                      alert.daysUntilEmpty <= 5
                        ? "text-red-600 dark:text-red-400"
                        : "text-yellow-600 dark:text-yellow-400"
                    }`}>
                      ~{alert.daysUntilEmpty} dager
                    </p>
                  </div>
                </div>
                {/* Stock bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full ${
                      alert.daysUntilEmpty <= 5
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                    style={{ width: `${Math.min(100, (alert.stock / alert.reorderPoint) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Orders */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Siste ordrer
        </h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Ordre</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Kunde</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Produkter</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Totalt</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {RECENT_ORDERS.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-50">{order.id}</p>
                    <p className="text-xs text-gray-400">{order.date}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {order.customer}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                    {order.items} stk
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-50">
                    {kr(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
