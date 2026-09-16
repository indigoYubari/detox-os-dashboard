"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Detaljer } from "./Detaljer"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"

type Melding = {
  id: string
  subject: string
  fromName: string
  unread: boolean
  kategori: string
}

type Tilstand =
  | { slag: "laster" }
  | { slag: "ok"; uleste: Melding[]; haster: Melding[] }
  | { slag: "feil"; hint: string }

/** Kategoriene som faktisk maa svares paa i dag — resten kan vente. */
const HASTER = ["Levering", "Retur/bytte"]

/**
 * «Kundeservice». Ruta svarer alltid med `hint` naar den feiler, saa vi viser
 * grunnen i stedet for «Kunne ikke hente». Ruta faller aldri tilbake til en
 * tom innboks — «ingen henvendelser» og «vi fikk ikke lest innboksen» er to
 * helt ulike beskjeder til et kundeserviceteam.
 */
export function KundeserviceISeg() {
  const [tilstand, setTilstand] = useState<Tilstand>({ slag: "laster" })

  useEffect(() => {
    let avbrutt = false
    fetch("/api/gmail/kundeservice", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as {
          meldinger?: Melding[]
          hint?: string
        }
        if (!res.ok) {
          return {
            slag: "feil" as const,
            hint: body.hint ?? "Klarte ikke lese innboksen.",
          }
        }
        const uleste = (body.meldinger ?? []).filter((m) => m.unread)
        return {
          slag: "ok" as const,
          uleste,
          haster: uleste.filter((m) => HASTER.includes(m.kategori)),
        }
      })
      .then((ny) => {
        if (!avbrutt) setTilstand(ny)
      })
      .catch(() => {
        if (!avbrutt) {
          setTilstand({ slag: "feil", hint: "Fikk ikke kontakt med innboksen." })
        }
      })
    return () => {
      avbrutt = true
    }
  }, [])

  if (tilstand.slag === "laster") {
    return (
      <Seksjon merkelapp="Kundeservice">
        <Svar>
          <strong>…</strong>
        </Svar>
        <Hjelp>Leser innboksen.</Hjelp>
      </Seksjon>
    )
  }

  if (tilstand.slag === "feil") {
    return (
      <Seksjon merkelapp="Kundeservice">
        <Stille>
          <span className="varsel">Fikk ikke lest innboksen.</span>{" "}
          {tilstand.hint}
        </Stille>
      </Seksjon>
    )
  }

  const { uleste, haster } = tilstand

  if (uleste.length === 0) {
    return (
      <Seksjon merkelapp="Kundeservice">
        <Svar>Ingenting ulest</Svar>
        <Hjelp>Innboksen er tom.</Hjelp>
      </Seksjon>
    )
  }

  return (
    <Seksjon merkelapp="Kundeservice">
      <Svar>
        <strong>{uleste.length}</strong> uleste
      </Svar>
      <Hjelp>
        {haster.length > 0 ? (
          <>
            <span className="varsel">{haster.length} av dem haster</span>
            {" — "}
            {Array.from(new Set(haster.map((m) => m.kategori.toLowerCase()))).join(
              ", ",
            )}
            .
          </>
        ) : (
          "Ingen av dem haster."
        )}
      </Hjelp>
      <Detaljer tekst="Se de uleste">
        <Liste>
          {uleste.slice(0, 6).map((m) => (
            <Linje key={m.id} n={m.kategori.split("/")[0].toLowerCase()}>
              <b>{m.fromName}</b> — {m.subject}
            </Linje>
          ))}
        </Liste>
      </Detaljer>
      <Knapper>
        <Link className="ny-knapp" href="/kundeservice">
          Åpne kundeservice
        </Link>
      </Knapper>
    </Seksjon>
  )
}
