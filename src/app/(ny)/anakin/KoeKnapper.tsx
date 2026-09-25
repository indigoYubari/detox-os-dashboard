"use client"

import { useState, useTransition } from "react"

import {
  DECISIONS,
  REQUEST_STATUS_LABELS,
  telegramText,
  type Decision,
  type RequestRow,
} from "@/lib/eiere"

import { decideRequestAction, type ActionResult } from "./actions"

// Knappene paa ett oppdrag i koeen. Skriver kun status i requests. Telegram
// er den fremste: lenke til boten hvis den er satt opp (teksten kopieres
// samtidig), ellers ferdig tekst med request-id til aa lime inn.
export function KoeKnapper({
  row,
  botHref,
}: {
  row: RequestRow
  botHref: string | null
}) {
  const [pending, start] = useTransition()
  const [res, setRes] = useState<ActionResult | null>(null)
  const [kopiert, setKopiert] = useState(false)

  function avgjor(decision: Decision) {
    start(async () => {
      setRes(await decideRequestAction({ id: row.id, decision }))
    })
  }

  async function kopier() {
    try {
      await navigator.clipboard.writeText(telegramText(row))
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      setKopiert(false)
    }
  }

  if (res?.ok) {
    return (
      <span className="ny-kvittering">
        Nå: {REQUEST_STATUS_LABELS[res.row.status] ?? res.row.status}.
      </span>
    )
  }

  return (
    <>
      {botHref ? (
        <a
          className="ny-knapp liten primaer"
          href={botHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => void kopier()}
        >
          Åpne i Telegram{kopiert ? " · kopiert" : ""}
        </a>
      ) : (
        <button type="button" className="ny-knapp liten" onClick={() => void kopier()}>
          {kopiert ? "Kopiert" : "Kopier tekst til Telegram"}
        </button>
      )}
      {(Object.keys(DECISIONS) as Decision[]).map((d) => (
        <button
          key={d}
          type="button"
          className="ny-knapp liten"
          disabled={pending}
          onClick={() => avgjor(d)}
        >
          {DECISIONS[d].label}
        </button>
      ))}
      {res && !res.ok ? <span className="ny-feil">{res.error}</span> : null}
    </>
  )
}
