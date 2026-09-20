"use client"

import { useEffect, useState } from "react"

import { ApiError, getInventory, getMetrics } from "@/lib/detox-api"
import { butikkVindu, lesButikkTall, lesLagerTall, type ButikkTall, type LagerTall } from "@/lib/butikk"

import { Detaljer } from "./Detaljer"
import { Hjelp, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import { kr, tall } from "./dagens"

type Tilstand =
  | { slag: "laster" }
  | { slag: "ok"; butikk: ButikkTall; lager: LagerTall | null }
  | { slag: "tom" }
  | { slag: "feil"; hint: string }

/**
 * «Butikken i går». Siden ad-agenten synker Shopify én gang i doegnet (rundt
 * 04:00 UTC) er gaarsdagen den nyeste hele dagen — derfor vinduer paa én dag,
 * ikke «i dag». Kilden kan svare at den ikke har data for perioden; det er
 * «ingen tall», ikke null kroner, og de to skal se ulike ut.
 */
export function ButikkISeg() {
  const [tilstand, setTilstand] = useState<Tilstand>({ slag: "laster" })

  useEffect(() => {
    let avbrutt = false
    const { since, until } = butikkVindu(new Date(), 1)

    Promise.all([getMetrics(since, until), getInventory().catch(() => null)])
      .then(([metrics, lagerRes]) => {
        if (avbrutt) return
        const butikk = lesButikkTall(metrics)
        if (!butikk) return setTilstand({ slag: "tom" })
        setTilstand({
          slag: "ok",
          butikk,
          lager: lagerRes ? lesLagerTall(lagerRes) : null,
        })
      })
      .catch((e: unknown) => {
        if (avbrutt) return
        const hint =
          e instanceof ApiError
            ? (e.hint ?? "Kilden svarte, men uten en forklaring vi kan vise.")
            : "Klarte ikke hente butikktallene."
        setTilstand({ slag: "feil", hint })
      })

    return () => {
      avbrutt = true
    }
  }, [])

  if (tilstand.slag === "laster") {
    return (
      <Seksjon merkelapp="Butikken i går">
        <Svar>
          <strong>…</strong>
        </Svar>
        <Hjelp>Henter tallene.</Hjelp>
      </Seksjon>
    )
  }

  if (tilstand.slag === "feil") {
    return (
      <Seksjon merkelapp="Butikken i går">
        <Stille>
          <span className="varsel">Ingen tall å vise.</span> {tilstand.hint}
        </Stille>
      </Seksjon>
    )
  }

  if (tilstand.slag === "tom") {
    return (
      <Seksjon merkelapp="Butikken i går">
        <Stille>Ingen ordrer registrert i går.</Stille>
      </Seksjon>
    )
  }

  const { butikk, lager } = tilstand
  const pct = butikk.delta.omsetning?.pct
  const lav = lager?.lavtListe[0] ?? null

  return (
    <Seksjon merkelapp="Butikken i går">
      <Svar>
        <strong>{kr(butikk.omsetning)}</strong> · {tall(butikk.ordrer)} ordrer
      </Svar>
      <Hjelp>
        {pct === null || pct === undefined ? (
          "Ingen sammenligning med uken før å vise."
        ) : (
          <>
            <span className={pct >= 0 ? "ok" : "varsel"}>
              {pct >= 0 ? "+" : ""}
              {pct} %
            </span>{" "}
            mot uken før. Snittordre {kr(butikk.snittordre)}.
          </>
        )}
      </Hjelp>
      <Detaljer>
        <Liste>
          <Linje n="enheter">{tall(butikk.enheter)} solgte enheter</Linje>
          <Linje n="snitt">{kr(butikk.snittordre)} per ordre</Linje>
          {lager && (
            <Linje n="lager">{tall(lager.enheter)} enheter igjen totalt</Linje>
          )}
          {lav && (
            <Linje n="lavt">
              <b>{lav.navn}</b> — {lav.antall} igjen
            </Linje>
          )}
        </Liste>
      </Detaljer>
    </Seksjon>
  )
}
