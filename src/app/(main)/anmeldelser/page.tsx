"use client"
import { StatTooltip } from "@/components/ui/StatTooltip"

import React from "react"

const REVIEW_KPIS = {
  avgRating: 4.82, totalReviews: 651, newThisMonth: 18, newPrevMonth: 14,
  responseRate: 96, fiveStarPct: 87,
}
const DISTRIBUTION = [
  { stars: 5, pct: 87, count: 566 }, { stars: 4, pct: 9, count: 59 },
  { stars: 3, pct: 3, count: 20 }, { stars: 2, pct: 0.5, count: 3 },
  { stars: 1, pct: 0.5, count: 3 },
]
type Review = { id: string; customer: string; rating: number; title: string; body: string; date: string; product?: string; replied: boolean }
const RECENT_REVIEWS: Review[] = [
  { id: "R-651", customer: "Maria K.", rating: 5, title: "Fantastisk glutathion!", body: "Merker virkelig forskjell på energi og hud etter 3 uker. Rask levering som alltid.", date: "2026-06-06", product: "Glutathion Liposomal 250ml", replied: true },
  { id: "R-650", customer: "Thomas H.", rating: 5, title: "Beste nettbutikken for kosttilskudd", body: "Seriøs butikk med god informasjon om produktene. Kundeservice svarer raskt.", date: "2026-06-05", replied: true },
  { id: "R-649", customer: "Silje A.", rating: 4, title: "Bra produkt, litt treg levering", body: "NAC fungerer bra, men tok 5 dager å få pakken. Ellers fornøyd.", date: "2026-06-04", product: "NAC 600mg", replied: true },
  { id: "R-648", customer: "Anders T.", rating: 5, title: "TUDCA reddet magen min", body: "Etter 2 måneder med TUDCA merker jeg enorm forbedring i fordøyelsen. Anbefales!", date: "2026-06-03", product: "TUDCA 250mg", replied: false },
  { id: "R-647", customer: "Karin B.", rating: 5, title: "Trygg og kunnskapsrik butikk", body: "Setter pris på at dere har så grundig informasjon om hvert produkt. Føler meg trygg på det jeg kjøper.", date: "2026-06-02", replied: true },
  { id: "R-646", customer: "Erik M.", rating: 3, title: "Ok, men dyrt", body: "Produktet er bra, men prisen er høy sammenlignet med utenlandske alternativer.", date: "2026-06-01", product: "Omega-3 EPA/DHA Premium", replied: true },
  { id: "R-645", customer: "Hanne L.", rating: 5, title: "Magnesium som faktisk virker", body: "Har prøvd mange magnesium-tilskudd. L-threonat er det eneste som gir merkbar effekt på søvn.", date: "2026-05-30", product: "Magnesium L-threonat", replied: true },
  { id: "R-644", customer: "Ole N.", rating: 5, title: "Topp kundeservice", body: "Fikk feil produkt tilsendt, men de ordnet det samme dag. Imponerende service.", date: "2026-05-29", replied: true },
]
function stars(n: number) { return "★".repeat(n) + "☆".repeat(5 - n) }

export default function AnmeldelserPage() {
  const newChange = ((REVIEW_KPIS.newThisMonth - REVIEW_KPIS.newPrevMonth) / REVIEW_KPIS.newPrevMonth * 100)
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">Anmeldelser</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Trustpilot-anmeldelser · Rating, sentiment og respons</p>
      </div>
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
            <p className="text-sm text-gray-600 dark:text-gray-400">Gjennomsnitt</p>
            <p className="mt-2 text-2xl font-semibold text-green-700 dark:text-green-300">{REVIEW_KPIS.avgRating} ★</p>
            <p className="mt-1 text-xs text-gray-500">{REVIEW_KPIS.totalReviews} anmeldelser totalt</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400"><StatTooltip explanation="Antall nye anmeldelser mottatt denne maneden.">Nye denne mnd</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{REVIEW_KPIS.newThisMonth}</p>
            <p className={`mt-1 text-xs ${newChange >= 0 ? "text-green-600" : "text-red-500"}`}>{newChange >= 0 ? "↑" : "↓"} {Math.abs(newChange).toFixed(0)}% vs forrige mnd</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400"><StatTooltip explanation="Andel anmeldelser som har fatt et svar fra butikken. Hoy svarprosent styrker tilliten.">Svarprosent</StatTooltip></p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{REVIEW_KPIS.responseRate}%</p>
            <p className="mt-1 text-xs text-gray-400">av alle anmeldelser besvart</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">5-stjernes andel</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{REVIEW_KPIS.fiveStarPct}%</p>
            <p className="mt-1 text-xs text-gray-400">{DISTRIBUTION[0].count} av {REVIEW_KPIS.totalReviews}</p>
          </div>
        </div>
      </section>
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-3">
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Fordeling</h2>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="space-y-3">
              {DISTRIBUTION.map((d) => (
                <div key={d.stars} className="flex items-center gap-3">
                  <span className="w-8 text-right text-sm font-medium text-gray-700 dark:text-gray-300">{d.stars}★</span>
                  <div className="flex-1"><div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-2 rounded-full ${d.stars >= 4 ? "bg-green-500" : d.stars === 3 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${d.pct}%` }} /></div></div>
                  <span className="w-12 text-right text-xs text-gray-500 dark:text-gray-400">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Mest nevnte produkter</h3>
            <div className="mt-3 space-y-2">
              {[{ name: "Glutathion Liposomal", mentions: 84 },{ name: "TUDCA 250mg", mentions: 56 },{ name: "Magnesium L-threonat", mentions: 42 },{ name: "NAC 600mg", mentions: 38 }].map((p) => (
                <div key={p.name} className="flex justify-between text-sm"><span className="text-gray-700 dark:text-gray-300">{p.name}</span><span className="text-gray-400">{p.mentions} omtaler</span></div>
              ))}
            </div>
          </div>
        </section>
        <section className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Siste anmeldelser</h2>
            <span className="text-sm text-gray-500">{RECENT_REVIEWS.filter((r) => !r.replied).length} ubesvarte</span>
          </div>
          <div className="mt-4 space-y-4">
            {RECENT_REVIEWS.map((review) => (
              <div key={review.id} className={`rounded-lg border p-5 ${!review.replied ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${review.rating >= 4 ? "text-green-500" : review.rating === 3 ? "text-yellow-500" : "text-red-500"}`}>{stars(review.rating)}</span>
                      <span className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">{review.title}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{review.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400">{review.customer}</span>
                      {review.product && <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{review.product}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${review.replied ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"}`}>{review.replied ? "Besvart" : "Ubesvart"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
