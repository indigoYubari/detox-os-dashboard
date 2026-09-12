"use client"

import React, { useEffect, useRef, useState, useTransition } from "react"

import {
  ANAKIN_AGENT_ID,
  awaitingAnakin,
  excerpt,
  hasResponse,
  latestResponse,
  MESSAGE_MAX,
  parseRequestBody,
  REQUEST_TYPES,
  THREAD_POLL_MS,
  THREAD_STATUS_LABELS,
  threadsOf,
  type RequestRow,
} from "@/lib/eiere"

import {
  readThreadAction,
  startChatThreadAction,
  type ActionResult,
} from "./actions"
import { TalkButton } from "./TalkButton"
import { ThreadClose } from "./ThreadClose"

// Chat-vinduet: én traad som samtale, eldste oeverst. Rendres ferdig fra
// serveren med radene siden hadde; naar eieren aapner vinduet spoer det basen
// paa nytt hvert THREAD_POLL_MS saa lenge traaden lever (en rad venter paa
// Anakin, eller traaden er aapen), og Anakins svar dukker opp av seg selv naar
// response fylles. Kompositoren legger en ny [chat_thread]-rad i samme traad
// (thread_id = roten, parent_id = siste melding); triggeren vekker Anakin, og
// hun svarer i response paa den raden. Stengt mens en rad venter — én rad,
// én agent-kjoering. Ingen chatbot: alt som staar her kommer fra requests.

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("nb-NO", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  })
}

function Bubble({
  who,
  at,
  note,
  children,
}: {
  who: string
  at: string
  note?: string
  children: React.ReactNode
}) {
  const anakin = who === ANAKIN_AGENT_ID
  return (
    <div
      className={`rounded-[var(--os-radius-sm)] border-[0.5px] p-2 ${
        anakin
          ? "border-[var(--os-border-accent)] bg-[var(--os-accent-dim)]"
          : "border-[var(--os-border)]"
      }`}
    >
      <p className="jbm text-[10px] text-[var(--os-text-muted)]">
        {anakin ? "Anakin" : who} · {timeLabel(at)}
        {note ? ` · ${note}` : ""}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-[var(--os-text-secondary)]">
        {children}
      </p>
    </div>
  )
}

/** Eierens egen tekst i en dashbord-melding — resten av kroppen er ramme. */
function ownerText(body: string): string {
  const m = /Melding fra eieren: «([\s\S]*?)»\n/.exec(body + "\n")
  return m ? m[1] : body
}

const SUMMARY_BTN =
  "inline-flex shrink-0 cursor-pointer select-none items-center rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-2 py-0.5 text-[10px] text-[var(--os-text-secondary)] transition-colors hover:bg-[var(--os-bg-hover)] hover:text-[var(--os-text-primary)] [&::-webkit-details-marker]:hidden"

export function ThreadChat({
  threadKey,
  initial,
  botHref,
}: {
  threadKey: string
  /** Radene siden hadde ved rendering, i skriverekkefoelge. */
  initial: RequestRow[]
  botHref: string | null
}) {
  const [rows, setRows] = useState<RequestRow[]>(initial)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [res, setRes] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [polledAt, setPolledAt] = useState<string | null>(null)
  const inFlight = useRef(false)

  const t =
    threadsOf(rows).find((x) => x.key === threadKey) ?? threadsOf(rows)[0]
  const messages = t?.messages ?? rows
  const root = t?.root ?? rows[0]
  const parsed = parseRequestBody(root.body)
  const label = parsed.type ? REQUEST_TYPES[parsed.type].label : root.kind
  const latest = t ? latestResponse(t) : null
  const waiting = awaitingAnakin(messages)
  const status = t?.closeTarget?.status ?? t?.last.status ?? root.status
  const live = open && (t?.active ?? false)

  // Polling: kun mens vinduet er aapent og traaden lever, og fanen er synlig.
  useEffect(() => {
    if (!live) return
    let stop = false
    async function tick() {
      if (stop || inFlight.current || document.visibilityState !== "visible")
        return
      inFlight.current = true
      try {
        const r = await readThreadAction({ threadKey })
        if (!stop && r.ok && r.rows.length > 0) {
          setRows(r.rows)
          setPolledAt(new Date().toISOString())
        }
      } finally {
        inFlight.current = false
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), THREAD_POLL_MS)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [live, threadKey])

  function send() {
    const message = text.trim()
    if (!message || !t) return
    startTransition(async () => {
      const r = await startChatThreadAction({
        ref: null,
        period: parsed.period,
        continues: { threadId: threadKey, parentId: t.last.id },
        message,
      })
      setRes(r)
      if (r.ok) {
        setText("")
        setRows((prev) =>
          prev.some((x) => x.id === r.row.id) ? prev : [...prev, r.row],
        )
      }
    })
  }

  const composerDisabled = pending || waiting !== null

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="jbm rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
          {label}
        </span>
        <span className="jbm text-[10px] text-[var(--os-text-muted)]">
          {THREAD_STATUS_LABELS[status] ?? status} · fra {root.requester} ·
          siste aktivitet {timeLabel(t?.lastActivity ?? root.created_at)} ·{" "}
          {messages.length} {messages.length === 1 ? "melding" : "meldinger"} ·
          id {threadKey.slice(0, 8)}…
        </span>
      </div>
      <details
        className="group"
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex list-none items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm text-[var(--os-text-primary)]">
              {latest
                ? excerpt(latest.response ?? "")
                : "Ingen svar ennå — Anakin har saken."}
            </span>
          </span>
          <span className={SUMMARY_BTN} aria-hidden="true">
            <span className="group-open:hidden">Åpne</span>
            <span className="hidden group-open:inline">Lukk</span>
          </span>
        </summary>
        <div className="mt-2 space-y-2">
          {messages.map((m) => (
            <React.Fragment key={m.id}>
              <Bubble
                who={m.requester}
                at={m.created_at}
                note={
                  m.parent_id
                    ? `svar på ${m.parent_id.slice(0, 8)}…`
                    : undefined
                }
              >
                {ownerText(m.body)}
              </Bubble>
              {hasResponse(m) ? (
                <Bubble
                  who={ANAKIN_AGENT_ID}
                  at={m.responded_at ?? m.created_at}
                >
                  {m.response}
                </Bubble>
              ) : null}
            </React.Fragment>
          ))}
          {waiting ? (
            <p className="jbm text-[10px] text-[var(--os-text-muted)]">
              Anakin svarer… (rad {waiting.id.slice(0, 8)}… er{" "}
              {THREAD_STATUS_LABELS[waiting.status] ?? waiting.status}
              {live
                ? `, oppdateres hvert ${THREAD_POLL_MS / 1000}. sekund`
                : ""}
              )
            </p>
          ) : null}
        </div>

        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <label className="jbm block text-[10px] text-[var(--os-text-muted)]">
            Svar i tråden — Anakin får meldingen med én gang og svarer her
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={3}
            disabled={composerDisabled}
            placeholder={
              waiting
                ? "Vent på Anakins svar før du skriver mer."
                : "Skriv til Anakin…"
            }
            className="mt-1 w-full rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] bg-transparent p-2 text-sm text-[var(--os-text-primary)] placeholder:text-[var(--os-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={composerDisabled || text.trim() === ""}
              className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-2.5 py-1 text-[11px] font-medium text-[var(--os-text-primary)] transition-colors hover:bg-[var(--os-bg-active)] disabled:cursor-not-allowed disabled:opacity-50"
              title="Legger en ny [chat_thread]-rad i samme tråd (thread_id/parent_id); Anakin svarer i response"
            >
              {pending ? "Sender…" : "Send til Anakin"}
            </button>
            <span className="jbm text-[10px] text-[var(--os-text-muted)]">
              {text.length}/{MESSAGE_MAX}
            </span>
            {res && (
              <span
                className={`jbm text-[10px] ${res.ok ? "text-[var(--os-accent)]" : "text-[var(--os-danger)]"}`}
              >
                {res.ok
                  ? res.duplicate
                    ? `En rad venter allerede på Anakin (${res.row.id.slice(0, 8)}…)`
                    : `Sendt (${res.row.id.slice(0, 8)}…) — svaret kommer her`
                  : `Feil (${res.code}): ${res.error}`}
              </span>
            )}
          </div>
        </form>

        <p className="jbm mt-2 text-[10px] text-[var(--os-text-muted)]">
          requests/{root.id}
          {messages.length > 1 ? ` · thread_id ${threadKey}` : ""}
          {parsed.ref ? ` · ref ${parsed.ref}` : ""}
          {parsed.period ? ` · radar ${parsed.period}` : ""}
          {polledAt ? ` · sist hentet ${timeLabel(polledAt)}` : ""}
        </p>
      </details>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {t ? (
          <TalkButton
            continues={{ threadId: threadKey, parentId: t.last.id }}
            period={parsed.period}
            botHref={botHref}
            label={t.active ? "Fortsett i Telegram" : "Ta opp igjen i Telegram"}
          />
        ) : null}
        {t?.closeTarget ? <ThreadClose row={t.closeTarget} /> : null}
      </div>
    </li>
  )
}
