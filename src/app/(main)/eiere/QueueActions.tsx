"use client"

import React, { useTransition } from "react"

import { DECISIONS, telegramText, type Decision, type RequestRow } from "@/lib/eiere"

import { decideRequestAction, type ActionResult } from "./actions"

// Handlinger per rad i godkjenningskoeen. Skriver kun status i `requests`.
// Telegram: lenke til boten hvis NEXT_PUBLIC_DETOX_TELEGRAM_BOT er satt, ellers
// ferdig tekst med request-id til aa lime inn. Dashboardet sender aldri selv.
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

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
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
      {telegramHref ? (
        <a
          href={telegramHref}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          onClick={() => void copy()}
          title="Aapner boten i Telegram og kopierer teksten under"
        >
          Aapne i Telegram
        </a>
      ) : null}
      <button type="button" onClick={() => void copy()} className={btn}>
        {copied ? "Kopiert" : "Kopier Telegram-tekst"}
      </button>
      {res && (
        <span
          className={`jbm text-[11px] ${res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"}`}
        >
          {res.ok ? `status → ${res.row.status}` : `Feil (${res.code}): ${res.error}`}
        </span>
      )}
    </div>
  )
}
