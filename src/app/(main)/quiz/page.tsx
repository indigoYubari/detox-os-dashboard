"use client"

import React from "react"

// ── mock data ─────────────────────────────────────────────────
const QUIZ_KPIS = {
  totalCompletions: 2_840,
  completionsMonth: 312,
  completionsPrevMonth: 267,
  completionRate: 68,
  completionRatePrev: 63,
  emailCapture: 84,
  conversionRate: 12.4,
  conversionRatePrev: 10.8,
  avgOrderFromQuiz: 1_920,
  revenueFromQuiz: 74_200,
}

type GoalCategory = {
  name: string
  color: string
  dotColor: string
  count: number
  pct: number
  topProduct: string
  convRate: number
}

const GOAL_CATEGORIES: GoalCategory[] = [
  { name: "Tarmhelse", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", dotColor: "bg-green-500", count: 68, pct: 21.8, topProduct: "Glutathion Liposomal", convRate: 14.2 },
  { name: "Søvn & Stress", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300", dotColor: "bg-indigo-500", count: 62, pct: 19.9, topProduct: "Magnesium L-threonat", convRate: 16.1 },
  { name: "Energi & Fokus", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", dotColor: "bg-amber-500", count: 56, pct: 17.9, topProduct: "CoQ10 Ubiquinol", convRate: 11.8 },
  { name: "Detox & Rensing", color: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300", dotColor: "bg-teal-500", count: 48, pct: 15.4, topProduct: "NAC 600mg", convRate: 13.5 },
  { name: "Immunforsvar", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", dotColor: "bg-blue-500", count: 44, pct: 14.1, topProduct: "Vitamin D3+K2", convRate: 9.2 },
  { name: "Vekt & Metabolisme", color: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300", dotColor: "bg-rose-500", count: 34, pct: 10.9, topProduct: "Berberine HCL", convRate: 8.6 },
]

const FUNNEL_STEPS = [
  { step: "Quiz startet", count: 459, pct: 100 },
  { step: "Fullført alle spørsmål", count: 312, pct: 68 },
  { step: "Oppga e-post", count: 262, pct: 57 },
  { step: "Klikket produktanbefaling", count: 156, pct: 34 },
  { step: "La i handlekurv", count: 68, pct: 15 },
  { step: "Gjennomførte kjøp", count: 39, pct: 8.5 },
]

const TOP_QUESTIONS = [
  { question: "Hva er ditt hovedmål?", dropoff: 4, avgTime: "8s" },
  { question: "Hvordan vil du beskrive energinivået ditt?", dropoff: 7, avgTime: "12s" },
  { question: "Hvor ofte opplever du fordøyelsesproblemer?", dropoff: 5, avgTime: "10s" },
  { question: "Bruker du kosttilskudd i dag?", dropoff: 3, avgTime: "6s" },
  { question: "Hva er viktigst for deg ved valg av tilskudd?", dropoff: 12, avgTime: "15s" },
]

// ── helpers ───────────────────────────────────────────────────
function kr(n: number) {
  return `kr ${Math.round(n).toLocaleString("nb-NO")}`
}

// ── component ─────────────────────────────────────────────────
export default function QuizPage() {
  const compChange = ((QUIZ_KPIS.completionsMonth - QUIZ_KPIS.completionsPrevMonth) / QUIZ_KPIS.completionsPrevMonth * 100)
  const convChange = ((QUIZ_KPIS.conversionRate - QUIZ_KPIS.conversionRatePrev) / QUIZ_KPIS.conversionRatePrev * 100)

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Quiz
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Octane AI quiz-analyse · Fullføring, e-postfangst, konvertering per målkategori
        </p>
      </div>

      {/* KPIs */}
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400">Fullført MTD</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{QUIZ_KPIS.completionsMonth}</p>
            <p className={`mt-1 text-xs ${compChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {compChange >= 0 ? "↑" : "↓"} {Math.abs(compChange).toFixed(0)}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400">Fullføringsrate</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{QUIZ_KPIS.completionRate}%</p>
            <p className="mt-1 text-xs text-green-600">+{QUIZ_KPIS.completionRate - QUIZ_KPIS.completionRatePrev}pp</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400">E-postfangst</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{QUIZ_KPIS.emailCapture}%</p>
            <p className="mt-1 text-xs text-gray-400">av fullførte</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
            <p className="text-xs text-gray-600 dark:text-gray-400">Konvertering</p>
            <p className="mt-2 text-2xl font-semibold text-green-700 dark:text-green-300">{QUIZ_KPIS.conversionRate}%</p>
            <p className={`mt-1 text-xs ${convChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {convChange >= 0 ? "↑" : "↓"} {Math.abs(convChange).toFixed(0)}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400">Snittordre (quiz)</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{kr(QUIZ_KPIS.avgOrderFromQuiz)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400">Quiz-omsetning MTD</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{kr(QUIZ_KPIS.revenueFromQuiz)}</p>
          </div>
        </div>
      </section>

      {/* Goal Categories */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Resultater per målkategori
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {GOAL_CATEGORIES.map((cat) => (
            <div
              key={cat.name}
              className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cat.dotColor}`} />
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cat.color}`}>
                    {cat.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">{cat.pct}%</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-400">Antall</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{cat.count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Konv.</p>
                  <p className={`text-sm font-semibold ${
                    cat.convRate >= 12 ? "text-green-600" : "text-gray-900 dark:text-gray-50"
                  }`}>
                    {cat.convRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Topprod.</p>
                  <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300" title={cat.topProduct}>
                    {cat.topProduct}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Funnel + Questions */}
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* Conversion Funnel */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Konverteringstrakt
          </h2>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="space-y-3">
              {FUNNEL_STEPS.map((step, i) => (
                <div key={step.step}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{step.step}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {step.count} ({step.pct}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        i === 0 ? "bg-indigo-500" :
                        i <= 2 ? "bg-indigo-400" :
                        i <= 4 ? "bg-indigo-300" :
                        "bg-green-500"
                      }`}
                      style={{ width: `${step.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Question Performance */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Spørsmål-ytelse
          </h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Spørsmål</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Frafall</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Snittid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {TOP_QUESTIONS.map((q) => (
                  <tr key={q.question} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-50">
                      {q.question}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${
                        q.dropoff >= 10
                          ? "text-red-600 dark:text-red-400"
                          : q.dropoff >= 7
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-gray-900 dark:text-gray-50"
                      }`}>
                        {q.dropoff}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {q.avgTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Spørsmål 5 har høyest frafall (12%) — vurder forenkling eller rekkefølge-bytte.
          </p>
        </section>
      </div>
    </>
  )
}
