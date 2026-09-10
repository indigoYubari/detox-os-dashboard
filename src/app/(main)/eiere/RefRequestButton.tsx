"use client"

import React, { useTransition } from "react"

import { REQUEST_TYPES, type RefRequestType } from "@/lib/eiere"

import { createRefRequestAction, type ActionResult } from "./actions"

// Én knapp som peker paa én rad (anbefaling, funn eller innholdselement) og
// legger en forespoersel i `requests`. Klienten sender bare id-en; serveren
// leser teksten fra basen. Ingenting publiseres. Sperret mens den paagaar og
// etter at den har lyktes (serveren er i tillegg idempotent per rad).
export function RefRequestButton({
  type,
  refId,
  period,
  label,
}: {
  type: RefRequestType
  refId: string
  period: string | null
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [res, setRes] = React.useState<ActionResult | null>(null)

  function send() {
    startTransition(async () => {
      setRes(await createRefRequestAction({ type, refId, period }))
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || (res?.ok ?? false)}
        onClick={send}
        className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-2.5 py-1 text-[11px] font-medium text-[var(--os-text-primary)] transition-colors hover:bg-[var(--os-bg-active)] disabled:cursor-not-allowed disabled:opacity-50"
        title={`Legger en «${REQUEST_TYPES[type].label}»-forespørsel til Anakin i køen`}
      >
        {pending ? "Legger i kø…" : label}
      </button>
      {res && (
        <span
          className={`jbm text-[10px] ${res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"}`}
        >
          {res.ok
            ? res.duplicate
              ? `Ligger allerede i køen (${res.row.id.slice(0, 8)}…)`
              : `I køen: requests/${res.row.id.slice(0, 8)}… — Anakin plukker den opp i Telegram`
            : `Feil (${res.code}): ${res.error}`}
        </span>
      )}
    </span>
  )
}
