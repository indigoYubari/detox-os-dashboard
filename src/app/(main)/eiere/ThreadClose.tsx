"use client"

import React, { useTransition } from "react"

import { DECISIONS, type RequestRow } from "@/lib/eiere"

import { decideRequestAction, type ActionResult } from "./actions"

// «Lukk tråd»: eieren avslutter samtalen ved aa sette status=done paa den
// nyeste aktive raden i traaden — samme beslutning som Godkjenn i koeen
// (DECISIONS.godkjenn), ingen ny kolonne, ingen auto-utloep. Anakin lukker
// aldri traader selv; hun slaar opp nyeste in_progress-rad naar eieren skriver
// uten saks-id, saa en lukket traad slutter aa vaere «den aktive saken».
export function ThreadClose({ row }: { row: RequestRow }) {
  const [pending, startTransition] = useTransition()
  const [res, setRes] = React.useState<ActionResult | null>(null)

  function close() {
    startTransition(async () => {
      setRes(await decideRequestAction({ id: row.id, decision: "godkjenn" }))
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || (res?.ok ?? false)}
        onClick={close}
        className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-2.5 py-1 text-[11px] text-[var(--os-text-secondary)] transition-colors hover:bg-[var(--os-bg-hover)] hover:text-[var(--os-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        title={`Setter requests.status = ${DECISIONS.godkjenn.status} på ${row.id.slice(0, 8)}… — samtalen er ikke lenger Anakins aktive sak`}
      >
        {pending ? "Lukker…" : "Lukk tråd"}
      </button>
      {res && (
        <span
          className={`jbm text-[10px] ${res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"}`}
        >
          {res.ok
            ? `lukket (status → ${res.row.status})`
            : `Feil (${res.code}): ${res.error}`}
        </span>
      )}
    </span>
  )
}
