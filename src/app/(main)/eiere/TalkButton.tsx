"use client"

import React, { useTransition } from "react"

import { type RefTable } from "@/lib/eiere"

import { startChatThreadAction, type ActionResult } from "./actions"

// «Snakk om dette» — Vei A. Ett klikk gjoer to ting, i denne rekkefoelgen:
// 1) en [chat_thread]-rad med konteksten legges i requests (triggeren vekker
//    Anakin med én gang), 2) Telegram aapnes paa vanlig t.me-lenke, uten
//    payload (deep-link med ?start= kvitteres uten svar av Hermes). Fanen
//    aapnes synkront i klikket saa popup-sperren slipper den, og faar adressen
//    naar raden er paa plass. Feiler raden, lukkes fanen igjen.
//
// Er det allerede en aapen samtale om elementet (active), lages ingen ny rad —
// knappen er da bare lenken til Telegram. Serveren er i tillegg idempotent.
export function TalkButton({
  refTable,
  refId,
  period,
  continues,
  botHref,
  active = false,
  label = "Snakk om dette",
}: {
  refTable?: RefTable
  refId?: string
  period: string | null
  /** Fortsett en eksisterende traad i stedet for aa starte en om et element. */
  continues?: { threadId: string; parentId: string }
  botHref: string | null
  active?: boolean
  label?: string
}) {
  const [pending, startTransition] = useTransition()
  const [res, setRes] = React.useState<ActionResult | null>(null)

  function talk() {
    const win = botHref ? window.open("about:blank", "_blank") : null
    startTransition(async () => {
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

  const cls =
    "rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-2.5 py-1 text-[11px] font-medium text-[var(--os-text-primary)] transition-colors hover:bg-[var(--os-bg-active)] disabled:cursor-not-allowed disabled:opacity-50"

  if (active && botHref && !res) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <a
          href={botHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
          title="Det pågår allerede en samtale om dette — fortsett i Telegram"
        >
          Samtale pågår · åpne Telegram
        </a>
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || (res?.ok ?? false)}
        onClick={talk}
        className={cls}
        title="Gir Anakin konteksten (rad i requests) og åpner Telegram — du skriver fritt der"
      >
        {pending ? "Gir Anakin konteksten…" : label}
      </button>
      {res && (
        <span
          className={`jbm text-[10px] ${res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"}`}
        >
          {res.ok ? (
            <>
              {res.duplicate
                ? `Samtalen pågår allerede (${res.row.id.slice(0, 8)}…)`
                : `Anakin har konteksten (${res.row.id.slice(0, 8)}…)`}
              {botHref ? (
                <>
                  {" · "}
                  <a
                    href={botHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    åpne Telegram
                  </a>
                </>
              ) : (
                " · Telegram-bot ikke konfigurert — åpne Anakin manuelt"
              )}
            </>
          ) : (
            `Feil (${res.code}): ${res.error}`
          )}
        </span>
      )}
    </span>
  )
}
