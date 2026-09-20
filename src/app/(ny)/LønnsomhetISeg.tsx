"use client"

import { useEffect, useState } from "react"

import {
  ApiError,
  getMetrics,
  getTrend,
  type MetricsResponse,
  type TrendResponse,
} from "@/lib/detox-api"
import { roasLabel, validatedRoas } from "@/lib/ad-format"
import { LineChart } from "@/components/LineChart"

import { Detaljer } from "./Detaljer"
import { Hjelp, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import { kr } from "./dagens"

/*
  «Lønnsomheten» — det ene tallet det gamle /overview hadde oeverst: blended ROAS
  over alt betalt media. Verdi fra getMetrics' totals (validatedRoas =
  Shopify-omsetning ÷ total annonsespend), aldri mock.

  Under svaret ligger en ROAS-trend-graf (getTrend) — den samme serien det gamle
  /overview-plotet, i den nye flatens stil. Mangler en kanal data, tegnes den ikke.
*/

const DAGER = 30

/** Kanalene som faktisk koster penger. Shopify og Klaviyo er egne seksjoner. */
const BETALTE = ["google_ads", "meta"]

type Tilstand =
  | { slag: "laster" }
  | { slag: "tom" }
  | { slag: "ok"; m: MetricsResponse; trend: TrendResponse | null }
  | { slag: "feil"; hint: string }

function dagerSiden(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000)
  return d.toISOString().slice(0, 10)
}

type GrafPunkt = {
  date: string
  Google: number | null
  Klaviyo: number | null
}

/** Serien fra getTrend, omformet til grafen. Bare kanaler med data slippes inn. */
function trendGraf(
  trend: TrendResponse | null,
): { data: GrafPunkt[]; categories: ("Google" | "Klaviyo")[] } {
  if (!trend || trend.series.length === 0) {
    return { data: [], categories: [] }
  }
  const data: GrafPunkt[] = trend.series.map((pt) => ({
    date: String(pt.date ?? "").slice(5),
    Google:
      typeof pt.google_ads_roas === "number"
        ? +pt.google_ads_roas.toFixed(2)
        : null,
    Klaviyo:
      typeof pt.klaviyo_roas === "number"
        ? +pt.klaviyo_roas.toFixed(2)
        : null,
  }))
  const categories: ("Google" | "Klaviyo")[] = []
  if (data.some((d) => d.Google != null)) categories.push("Google")
  if (data.some((d) => d.Klaviyo != null)) categories.push("Klaviyo")
  return { data, categories }
}

const GRAF_FARGE: Record<string, "blue" | "amber"> = {
  Google: "blue",
  Klaviyo: "amber",
}

export function LønnsomhetISeg() {
  const [tilstand, setTilstand] = useState<Tilstand>({ slag: "laster" })

  useEffect(() => {
    let avbrutt = false
    const since = dagerSiden(DAGER)
    const until = new Date().toISOString().slice(0, 10)
    Promise.all([
      getMetrics(since, until),
      getTrend(since, until).catch(() => null),
    ])
      .then(([m, trend]) => {
        if (avbrutt) return
        if (m.totals.adSpend <= 0) return setTilstand({ slag: "tom" })
        setTilstand({ slag: "ok", m, trend })
      })
      .catch((e: unknown) => {
        if (avbrutt) return
        const hint =
          e instanceof ApiError
            ? (e.hint ?? "Annonsekilden svarte uten forklaring.")
            : "Klarte ikke hente lønnsomhetstallene."
        setTilstand({ slag: "feil", hint })
      })
    return () => {
      avbrutt = true
    }
  }, [])

  if (tilstand.slag === "laster") {
    return (
      <Seksjon merkelapp="Lønnsomheten">
        <Svar>
          <strong>…</strong>
        </Svar>
        <Hjelp>Henter de siste {DAGER} dagene.</Hjelp>
      </Seksjon>
    )
  }

  if (tilstand.slag === "feil") {
    return (
      <Seksjon merkelapp="Lønnsomheten">
        <Stille>
          <span className="varsel">Ingen lønnsomhetstall.</span> {tilstand.hint}
        </Stille>
      </Seksjon>
    )
  }

  if (tilstand.slag === "tom") {
    return (
      <Seksjon merkelapp="Lønnsomheten">
        <Svar>Ingen annonseutgifter i perioden</Svar>
        <Hjelp>Da er det ikke et annonsetap å måle.</Hjelp>
      </Seksjon>
    )
  }

  const { m, trend } = tilstand
  const omsetning = m.totals.shopifyRevenue
  const spend = m.totals.adSpend
  const blended = validatedRoas(spend, omsetning)
  const kanaler = m.channels.filter((c) => BETALTE.includes(c.channel))
  const { data: graf, categories } = trendGraf(trend)

  return (
    <Seksjon merkelapp="Lønnsomheten">
      <Svar>
        Blended ROAS <strong>{roasLabel(blended)}</strong>
      </Svar>
      <Hjelp>
        {kr(omsetning)} i omsetning mot {kr(spend)} i annonser over siste{" "}
        {DAGER} dager.
      </Hjelp>

      {graf.length > 1 && categories.length > 0 ? (
        <LineChart
          data={graf}
          index="date"
          categories={categories}
          colors={categories.map((c) => GRAF_FARGE[c])}
          valueFormatter={(v) => `${v.toFixed(2)}x`}
          showTooltip={false}
          connectNulls
          className="mt-4 h-52"
        />
      ) : (
        <Hjelp>For lite data for en trend akkurat nå.</Hjelp>
      )}

      <Detaljer tekst="Se per kanal">
        <Liste>
          {kanaler.map((c) => (
            <Linje key={c.channel} n={c.channel === "google_ads" ? "Google" : "Meta"}>
              {kr(c.spend)} brukt · {kr(c.revenue)} tilbake ·{" "}
              <b>{roasLabel(c.roas ?? null)}</b> · {c.conversions} salg
            </Linje>
          ))}
        </Liste>
      </Detaljer>
    </Seksjon>
  )
}