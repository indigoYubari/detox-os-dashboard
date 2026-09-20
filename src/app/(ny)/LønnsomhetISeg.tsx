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

import { Detaljer } from "./Detaljer"
import { Hjelp, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import { kr } from "./dagens"

/*
  «Lønnsomheten» — det ene tallet The gamle /overview hadde oeverst og det nye
  mangler: blended ROAS over alt betalt media. Verdi fra getMetrics' totals
  (validatedRoas = Shopify-omsetning ÷ total annonsespend), aldri mock.

  Rullefeltet Va er en leseflate: ett svar, detaljer bak «Se …». ROAS-trenden
  (getTrend) vises som tekstlinje fordi designet ikke bruker grafikk.
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

/**
 * Teksttrend fra getTrend-serien: første verdi → siste verdi i vinduet, per kanal.
 * Returnerer null hvis det ikke er to målbare punkter (da sier vi ingenting i
 * stedet for å dikte en linje).
 */
function trendLesning(trend: TrendResponse | null): string | null {
  if (!trend || trend.series.length < 2) return null
  const s = trend.series
  const først = s[0]
  const sist = s[s.length - 1]
  const deler: string[] = []
  for (const [nøkkel, navn] of [
    ["google_ads_roas", "Google"],
    ["klaviyo_roas", "Klaviyo"],
  ] as const) {
    const a = først[nøkkel]
    const b = sist[nøkkel]
    if (typeof a !== "number" || typeof b !== "number") continue
    const diff = b - a
    if (Math.abs(diff) < 0.05) {
      deler.push(`${navn} uendret`)
    } else {
      deler.push(`${navn} ${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(2)}x`)
    }
  }
  return deler.length > 0 ? deler.join(" · ") : null
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
  const trendTekst = trendLesning(trend)

  return (
    <Seksjon merkelapp="Lønnsomheten">
      <Svar>
        Blended ROAS <strong>{roasLabel(blended)}</strong>
      </Svar>
      <Hjelp>
        {kr(omsetning)} i omsetning mot {kr(spend)} i annonser over siste{" "}
        {DAGER} dager.{" "}
        {trendTekst ? `ROAS-trenden: ${trendTekst}.` : ""}
      </Hjelp>
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