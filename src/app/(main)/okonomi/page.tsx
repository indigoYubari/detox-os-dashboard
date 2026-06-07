"use client"

import React from "react"

// ── mock data (replace with Fiken API calls) ──────────────────
const BANK_ACCOUNTS = [
  { name: "DNB Driftskonto", number: "****3847", balance: 284_320, currency: "NOK" },
  { name: "DNB Skattekonto", number: "****9201", balance: 67_450, currency: "NOK" },
  { name: "DNB Valutakonto", number: "****6112", balance: 12_840, currency: "USD" },
]

const MVA_STATUS = {
  period: "3. termin 2026 (mai–jun)",
  deadline: "2026-08-10",
  utgående: 148_200,
  inngående: 62_350,
  tilBetaling: 85_850,
  status: "Ikke levert" as const,
}

const RECENT_TRANSACTIONS = [
  { date: "2026-06-06", description: "Shopify-utbetaling", amount: 34_820, type: "inn" as const, category: "Salgsinntekt" },
  { date: "2026-06-05", description: "Meta Ads", amount: -4_200, type: "ut" as const, category: "Markedsføring" },
  { date: "2026-06-05", description: "Railway Pro", amount: -190, type: "ut" as const, category: "IT/Software" },
  { date: "2026-06-04", description: "Shopify-utbetaling", amount: 28_650, type: "inn" as const, category: "Salgsinntekt" },
  { date: "2026-06-04", description: "Google Ads", amount: -2_800, type: "ut" as const, category: "Markedsføring" },
  { date: "2026-06-03", description: "Klaviyo", amount: -1_490, type: "ut" as const, category: "IT/Software" },
  { date: "2026-06-03", description: "PostNord frakt", amount: -8_320, type: "ut" as const, category: "Frakt" },
  { date: "2026-06-02", description: "Shopify-utbetaling", amount: 41_200, type: "inn" as const, category: "Salgsinntekt" },
  { date: "2026-06-01", description: "Xi'an Super Supplement", amount: -28_400, type: "ut" as const, category: "Varekjøp" },
  { date: "2026-06-01", description: "Shopify abonnement", amount: -2_990, type: "ut" as const, category: "IT/Software" },
]

const UNPAID_INVOICES = [
  { id: "F-2026-042", supplier: "Shaanxi Rainwood Biotech", amount: 42_600, due: "2026-06-15", daysLeft: 8 },
  { id: "F-2026-039", supplier: "PostNord", amount: 12_480, due: "2026-06-20", daysLeft: 13 },
  { id: "F-2026-037", supplier: "Domeneshop", amount: 490, due: "2026-06-30", daysLeft: 23 },
]

const MONTHLY_SUMMARY = {
  revenue: 312_400,
  expenses: 148_200,
  result: 164_200,
  revenuePrevMonth: 287_600,
  expensesPrevMonth: 132_800,
}

// ── helpers ───────────────────────────────────────────────────
function kr(n: number) {
  return `kr ${Math.abs(Math.round(n)).toLocaleString("nb-NO")}`
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), dir: pct >= 0 ? "up" : "down" }
}

// ── component ─────────────────────────────────────────────────
export default function OkonomiPage() {
  const revChange = pctChange(MONTHLY_SUMMARY.revenue, MONTHLY_SUMMARY.revenuePrevMonth)
  const expChange = pctChange(MONTHLY_SUMMARY.expenses, MONTHLY_SUMMARY.expensesPrevMonth)

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Økonomi
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Fiken-integrasjon · Fakturaer, banksaldo, MVA-status
        </p>
      </div>

      {/* KPI Summary */}
      <section className="mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Omsetning MTD</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {kr(MONTHLY_SUMMARY.revenue)}
            </p>
            {revChange && (
              <p className={`mt-1 text-xs ${revChange.dir === "up" ? "text-green-600" : "text-red-500"}`}>
                {revChange.dir === "up" ? "↑" : "↓"} {revChange.pct.toFixed(1)}% vs forrige måned
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Utgifter MTD</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {kr(MONTHLY_SUMMARY.expenses)}
            </p>
            {expChange && (
              <p className={`mt-1 text-xs ${expChange.dir === "up" ? "text-red-500" : "text-green-600"}`}>
                {expChange.dir === "up" ? "↑" : "↓"} {expChange.pct.toFixed(1)}% vs forrige måned
              </p>
            )}
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
            <p className="text-sm text-gray-600 dark:text-gray-400">Resultat MTD</p>
            <p className="mt-2 text-2xl font-semibold text-green-700 dark:text-green-300">
              {kr(MONTHLY_SUMMARY.result)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Margin: {((MONTHLY_SUMMARY.result / MONTHLY_SUMMARY.revenue) * 100).toFixed(1)}%
            </p>
          </div>

          <div className={`rounded-lg border p-6 ${
            MVA_STATUS.status === "Ikke levert"
              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
              : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
          }`}>
            <p className="text-sm text-gray-600 dark:text-gray-400">MVA til betaling</p>
            <p className={`mt-2 text-2xl font-semibold ${
              MVA_STATUS.status === "Ikke levert"
                ? "text-yellow-700 dark:text-yellow-300"
                : "text-green-700 dark:text-green-300"
            }`}>
              {kr(MVA_STATUS.tilBetaling)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {MVA_STATUS.period} · Frist {new Date(MVA_STATUS.deadline).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
      </section>

      {/* Bank Accounts */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Bankkontoer
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {BANK_ACCOUNTS.map((acc) => (
            <div
              key={acc.number}
              className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{acc.name}</p>
                <span className="text-xs text-gray-400">{acc.number}</span>
              </div>
              <p className="mt-3 text-xl font-semibold text-gray-900 dark:text-gray-50">
                {acc.currency === "NOK" ? kr(acc.balance) : `$${acc.balance.toLocaleString("nb-NO")}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Two-column: Transactions + Unpaid Invoices */}
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Transactions */}
        <section className="xl:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Siste transaksjoner
          </h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Dato</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Beskrivelse</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Kategori</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Beløp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {RECENT_TRANSACTIONS.map((tx, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(tx.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {tx.category}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      tx.type === "inn"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-900 dark:text-gray-50"
                    }`}>
                      {tx.type === "inn" ? "+" : "−"}{kr(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Unpaid Invoices */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Ubetalte fakturaer
            </h2>
            <span className="text-sm text-gray-500">{UNPAID_INVOICES.length} stk</span>
          </div>
          <div className="mt-4 space-y-3">
            {UNPAID_INVOICES.map((inv) => (
              <div
                key={inv.id}
                className={`rounded-lg border p-4 ${
                  inv.daysLeft <= 7
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{inv.id}</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
                      {inv.supplier}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    {kr(inv.amount)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Forfaller {new Date(inv.due).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                  {" · "}
                  <span className={inv.daysLeft <= 7 ? "font-medium text-red-600 dark:text-red-400" : ""}>
                    {inv.daysLeft} dager igjen
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* MVA Detail Card */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">MVA-detaljer</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{MVA_STATUS.period}</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Utgående MVA</span>
                <span className="text-gray-900 dark:text-gray-50">{kr(MVA_STATUS.utgående)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Inngående MVA</span>
                <span className="text-gray-900 dark:text-gray-50">−{kr(MVA_STATUS.inngående)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-900 dark:text-gray-50">Til betaling</span>
                  <span className="text-yellow-700 dark:text-yellow-300">{kr(MVA_STATUS.tilBetaling)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                {MVA_STATUS.status}
              </span>
              <span className="text-xs text-gray-400">
                Frist: {new Date(MVA_STATUS.deadline).toLocaleDateString("nb-NO")}
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
