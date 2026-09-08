"use client"

import React, { useTransition } from "react"

import { REQUEST_TYPES, type RequestType } from "@/lib/eiere"

import { createRequestAction, type ActionResult } from "./actions"

// To knapper, begge legger en rad i `requests`. Ingenting publiseres.
// Knappen er sperret mens handlingen paagaar (dobbeltklikk), og serveren er i
// tillegg idempotent per (type, radar-periode).
export function RequestButtons({ period }: { period: string | null }) {
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = React.useState<RequestType | null>(null)
  const [result, setResult] = React.useState<
    { type: RequestType; res: ActionResult } | null
  >(null)

  function send(type: RequestType) {
    setBusy(type)
    startTransition(async () => {
      const res = await createRequestAction({ type, period })
      setResult({ type, res })
      setBusy(null)
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(REQUEST_TYPES) as RequestType[]).map((type) => (
          <button
            key={type}
            type="button"
            disabled={pending}
            onClick={() => send(type)}
            className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-3 py-1.5 text-xs font-medium text-[var(--os-text-primary)] transition-colors hover:bg-[var(--os-bg-active)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === type ? "Legger i koe…" : `Be Anakin: ${REQUEST_TYPES[type].label.toLowerCase()}`}
          </button>
        ))}
      </div>
      {result && (
        <p
          className={`jbm mt-2 text-[11px] ${
            result.res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"
          }`}
        >
          {result.res.ok
            ? result.res.duplicate
              ? `Fantes allerede i koeen (${result.res.row.id.slice(0, 8)}…, status ${result.res.row.status}). Ingen ny rad.`
              : `Lagt i koeen: requests/${result.res.row.id.slice(0, 8)}… (status ${result.res.row.status}). Anakin plukker den opp i Telegram.`
            : `Feil (${result.res.code}): ${result.res.error}`}
        </p>
      )}
    </div>
  )
}
