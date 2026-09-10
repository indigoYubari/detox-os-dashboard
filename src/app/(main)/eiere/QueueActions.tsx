"use client"

import React, { useTransition } from "react"

import {
  DECISIONS,
  telegramText,
  type Decision,
  type RequestRow,
} from "@/lib/eiere"

import { decideRequestAction, type ActionResult } from "./actions"

// Handlinger per rad i godkjenningskøen. Skriver kun status i `requests`.
// Telegram er den fremste knappen: lenke til boten hvis
// NEXT_PUBLIC_DETOX_TELEGRAM_BOT er satt (teksten kopieres samtidig), ellers
// ferdig tekst med request-id til å lime inn. Dashboardet sender aldri selv.
export function QueueActions({
  row,
  telegramHref,
}: {
  row: RequestRow
  telegramHref: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [res, setRes] = React.useState<ActionResult | null>(null)
  const [copied, setCopied] = React.useState(false)
  const text = telegramText(row)

  function decide(decision: Decision) {
    startTransition(async () => {
      setRes(await decideRequestAction({ id: row.id, decision }))
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const btn =
    "rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-2.5 py-1 text-[11px] text-[var(--os-text-secondary)] transition-colors hover:bg-[var(--os-bg-hover)] hover:text-[var(--os-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
  const primary =
    "rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-3 py-1 text-[11px] font-medium text-[var(--os-text-primary)] transition-colors hover:bg-[var(--os-bg-active)]"

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {telegramHref ? (
        <a
          href={telegramHref}
          target="_blank"
          rel="noopener noreferrer"
          className={primary}
          onClick={() => void copy()}
          title="Åpner Anakin i Telegram og kopierer teksten med request-id"
        >
          Åpne i Telegram {copied ? "· kopiert" : ""}
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => void copy()}
        className={telegramHref ? btn : primary}
      >
        {copied ? "Kopiert" : "Kopier Telegram-tekst"}
      </button>
      {(Object.keys(DECISIONS) as Decision[]).map((d) => (
        <button
          key={d}
          type="button"
          disabled={pending || (res?.ok ?? false)}
          onClick={() => decide(d)}
          className={btn}
          title={`Setter requests.status = ${DECISIONS[d].status}`}
        >
          {DECISIONS[d].label}
        </button>
      ))}
      {res && (
        <span
          className={`jbm text-[11px] ${res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"}`}
        >
          {res.ok
            ? `status → ${res.row.status}`
            : `Feil (${res.code}): ${res.error}`}
        </span>
      )}
    </div>
  )
}
