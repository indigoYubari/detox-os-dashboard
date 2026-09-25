"use client"

import { useState, useTransition } from "react"

import type { RefTable } from "@/lib/eiere"

import { startChatThreadAction, type ActionResult } from "./actions"

// «Snakk om dette». Ett klikk gjoer to ting, i denne rekkefoelgen: en
// [chat_thread]-rad med konteksten legges i requests (triggeren vekker Anakin
// med én gang), og Telegram aapnes paa vanlig t.me-lenke. Fanen aapnes
// synkront i klikket saa popup-sperren slipper den, og faar adressen naar
// raden er paa plass. Feiler raden, lukkes fanen igjen.
//
// Paagaar det allerede en samtale om elementet, lages ingen ny rad — knappen
// er bare lenken til Telegram. Serveren er i tillegg idempotent.
export function Snakk({
  refTable,
  refId,
  period,
  continues,
  botHref,
  paagaar = false,
  tekst = "Snakk om dette",
}: {
  refTable?: RefTable
  refId?: string
  period: string | null
  continues?: { threadId: string; parentId: string }
  botHref: string | null
  paagaar?: boolean
  tekst?: string
}) {
  const [pending, start] = useTransition()
  const [res, setRes] = useState<ActionResult | null>(null)

  function snakk() {
    const win = botHref ? window.open("about:blank", "_blank") : null
    start(async () => {
      const r = await startChatThreadAction({
        ref: refTable && refId ? { table: refTable, id: refId } : null,
        period,
        continues: continues ?? null,
      })
      setRes(r)
      if (win) {
        if (r.ok && botHref) win.location.href = botHref
        else win.close()
      }
    })
  }

  if (paagaar && botHref && !res) {
    return (
      <a className="ny-knapp liten" href={botHref} target="_blank" rel="noreferrer">
        Samtale pågår · åpne Telegram
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        className="ny-knapp liten"
        disabled={pending || (res?.ok ?? false)}
        onClick={snakk}
        title="Gir Anakin konteksten og åpner Telegram — du skriver fritt der"
      >
        {pending ? "Gir Anakin konteksten…" : tekst}
      </button>
      {res ? (
        res.ok ? (
          <span className="ny-kvittering">
            {res.duplicate ? "Samtalen pågår allerede." : "Anakin har konteksten."}
            {botHref ? (
              <>
                {" "}
                <a href={botHref} target="_blank" rel="noreferrer">
                  Åpne Telegram
                </a>
              </>
            ) : (
              " Telegram-bot er ikke satt opp — åpne Anakin selv."
            )}
          </span>
        ) : (
          <span className="ny-feil">{res.error}</span>
        )
      ) : null}
    </>
  )
}
