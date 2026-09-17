"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { ApiError, getMetrics, type MetricsResponse } from "@/lib/detox-api"
import { CHANNEL_LABELS, kr as adKr, pctLabel, roasLabel } from "@/lib/ad-format"

import { Detaljer } from "./Detaljer"
import { RaadBlokk } from "./Raad"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import { tall, type Raad } from "./dagens"

/** Kanalene som faktisk koster penger. Shopify/Klaviyo er egne seksjoner. */
const BETALTE = ["google_ads", "meta"]

type Tilstand =
  | { slag: "laster" }
  | { slag: "ok"; m: MetricsResponse }
  | { slag: "feil"; hint: string }

function dagerSiden(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/**
 * «Annonser». Svarer paa det ene en eier maa vite om betalt media: hva vi la
 * ut, og hva vi fikk igjen. Kanalene som gaar med tap listes i detaljene —
 * det er de som krever en beslutning.
 *
 * Raadene (`raad`) kommer fra serveren, ikke herfra: de er lest fra basen med
 * eierens session foer siden ble sendt. Tallene hentes i klienten fra
 * ad-backenden. Feiler den, staar raadene likevel.
 */
export function AnnonserISeg({
  raad,
  raadFeil,
}: {
  raad: Raad[]
  raadFeil: string | null
}) {
  const [tilstand, setTilstand] = useState<Tilstand>({ slag: "laster" })

  useEffect(() => {
    let avbrutt = false
    getMetrics(dagerSiden(30), new Date().toISOString().slice(0, 10))
      .then((m) => {
        if (!avbrutt) setTilstand({ slag: "ok", m })
      })
      .catch((e: unknown) => {
        if (avbrutt) return
        const hint =
          e instanceof ApiError
            ? (e.hint ?? "Annonsekilden svarte uten forklaring.")
            : "Klarte ikke hente annonsetallene."
        setTilstand({ slag: "feil", hint })
      })
    return () => {
      avbrutt = true
    }
  }, [])

  if (tilstand.slag === "laster") {
    return (
      <Seksjon merkelapp="Annonser">
        <Svar>
          <strong>…</strong>
        </Svar>
        <Hjelp>Henter de siste 30 dagene.</Hjelp>
        <RaadBlokk raad={raad} feil={raadFeil} />
      </Seksjon>
    )
  }

  if (tilstand.slag === "feil") {
    return (
      <Seksjon merkelapp="Annonser">
        <Stille>
          <span className="varsel">Ingen annonsetall.</span> {tilstand.hint}
        </Stille>
        <RaadBlokk raad={raad} feil={raadFeil} />
      </Seksjon>
    )
  }

  const { m } = tilstand
  const betalt = m.channels.filter((c) => BETALTE.includes(c.channel))
  const brukt = betalt.reduce((s, c) => s + c.spend, 0)
  const tilbake = betalt.reduce((s, c) => s + c.revenue, 0)
  const roas = brukt > 0 ? tilbake / brukt : null
  const tapere = betalt.filter((c) => c.spend > 0 && (c.roas ?? 0) < 1)
  const spendDelta = m.comparison?.totals.adSpend

  if (brukt === 0) {
    return (
      <Seksjon merkelapp="Annonser">
        <Stille>Ingen annonseutgifter registrert de siste 30 dagene.</Stille>
        <RaadBlokk raad={raad} feil={raadFeil} />
      </Seksjon>
    )
  }

  return (
    <Seksjon merkelapp="Annonser">
      <Svar>
        <strong>{adKr(brukt)}</strong> brukt · {roasLabel(roas ?? 0)} tilbake
      </Svar>
      <Hjelp>
        {adKr(tilbake)} i omsetning fra betalt media.{" "}
        {spendDelta ? `${pctLabel(spendDelta.pct, spendDelta.dir)} forbruk. ` : ""}
        {tapere.length > 0 ? (
          <span className="varsel">
            {tapere.length} {tapere.length === 1 ? "kanal" : "kanaler"} går med tap.
          </span>
        ) : (
          "Alle kanaler tjener seg inn."
        )}
        {raad.length > 0
          ? ` ${raad.length} ${raad.length === 1 ? "råd" : "råd"} fra annonsemotoren venter på dere.`
          : ""}
      </Hjelp>
      <Detaljer tekst="Se per kanal">
        <Liste>
          {betalt.map((c) => (
            <Linje key={c.channel} n={CHANNEL_LABELS[c.channel] ?? c.channel}>
              {adKr(c.spend)} brukt · {adKr(c.revenue)} tilbake ·{" "}
              <b>{roasLabel(c.roas ?? 0)}</b> · {tall(c.conversions)} salg
            </Linje>
          ))}
        </Liste>
      </Detaljer>
      <RaadBlokk raad={raad} feil={raadFeil} />
      <Knapper>
        <Link className="ny-knapp" href="/annonser">
          Åpne annonser
        </Link>
      </Knapper>
    </Seksjon>
  )
}
