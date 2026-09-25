"use client"

import { Fragment, useEffect, useRef, useState, useTransition } from "react"

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
  decideRequestAction,
  readThreadAction,
  startChatThreadAction,
  type ActionResult,
} from "./actions"
import { Snakk } from "./Snakk"

// Én samtale med Anakin, i den nye flaten. Det siste hun sa staar alltid
// synlig; hele traaden ligger bak «Åpne». Naar vinduet er aapent og traaden
// lever, spoer det basen paa nytt hvert THREAD_POLL_MS, og svaret hennes
// dukker opp av seg selv naar response fylles. Kompositoren legger en ny
// [chat_thread]-rad i samme traad; stengt mens en rad venter — én rad, én
// agent-kjoering. Ingen chatbot: alt her kommer fra requests.

function klokke(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  })
}

/** Eierens egen tekst i en dashbord-melding — resten av kroppen er ramme. */
function eierensTekst(body: string): string {
  const m = /Melding fra eieren: «([\s\S]*?)»\n/.exec(body + "\n")
  return m ? m[1] : parseRequestBody(body).summary
}

function Boble({
  hvem,
  naar,
  children,
}: {
  hvem: string
  naar: string
  children: React.ReactNode
}) {
  const anakin = hvem === ANAKIN_AGENT_ID
  return (
    <div className={anakin ? "ny-boble anakin" : "ny-boble"}>
      <div className="ny-boble-hvem">
        {anakin ? "Anakin" : hvem} · {klokke(naar)}
      </div>
      <p className="ny-boble-tekst">{children}</p>
    </div>
  )
}

export function Samtale({
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
  const [oppe, setOppe] = useState(false)
  const [tekst, setTekst] = useState("")
  const [res, setRes] = useState<ActionResult | null>(null)
  const [lukket, setLukket] = useState<ActionResult | null>(null)
  const [pending, start] = useTransition()
  const inFlight = useRef(false)

  const t = threadsOf(rows).find((x) => x.key === threadKey) ?? threadsOf(rows)[0]
  const meldinger = t?.messages ?? rows
  const rot = t?.root ?? rows[0]
  const parsed = parseRequestBody(rot.body)
  const emne = parsed.type ? REQUEST_TYPES[parsed.type].label : rot.kind
  const siste = t ? latestResponse(t) : null
  const venter = awaitingAnakin(meldinger)
  const status = t?.closeTarget?.status ?? t?.last.status ?? rot.status
  const lever = oppe && (t?.active ?? false)

  useEffect(() => {
    if (!lever) return
    let stopp = false
    async function tikk() {
      if (stopp || inFlight.current || document.visibilityState !== "visible") return
      inFlight.current = true
      try {
        const r = await readThreadAction({ threadKey })
        if (!stopp && r.ok && r.rows.length > 0) setRows(r.rows)
      } finally {
        inFlight.current = false
      }
    }
    void tikk()
    const id = window.setInterval(() => void tikk(), THREAD_POLL_MS)
    return () => {
      stopp = true
      window.clearInterval(id)
    }
  }, [lever, threadKey])

  function send() {
    const melding = tekst.trim()
    if (!melding || !t) return
    start(async () => {
      const r = await startChatThreadAction({
        ref: null,
        period: parsed.period,
        continues: { threadId: threadKey, parentId: t.last.id },
        message: melding,
      })
      setRes(r)
      if (r.ok) {
        setTekst("")
        setRows((prev) => (prev.some((x) => x.id === r.row.id) ? prev : [...prev, r.row]))
      }
    })
  }

  function lukk() {
    const mål = t?.closeTarget
    if (!mål) return
    start(async () => {
      setLukket(await decideRequestAction({ id: mål.id, decision: "godkjenn" }))
    })
  }

  const stengt = pending || venter !== null

  return (
    <div className="ny-samtale">
      <div className="ny-post-topp">
        <span className="ny-lapp">{emne}</span>
        <span>
          {THREAD_STATUS_LABELS[status] ?? status} · {rot.requester} ·{" "}
          {meldinger.length} {meldinger.length === 1 ? "melding" : "meldinger"}
        </span>
      </div>
      <p className="ny-post-tittel">
        {siste ? excerpt(siste.response ?? "") : "Ingen svar ennå — Anakin har saken."}
      </p>
      <button
        type="button"
        className="ny-vis"
        aria-expanded={oppe}
        onClick={() => setOppe((v) => !v)}
      >
        <span className="pil" aria-hidden="true">
          ›
        </span>
        {oppe ? "Skjul samtalen" : "Åpne samtalen"}
      </button>
      {oppe ? (
        <div className="ny-samtale-kropp">
          {meldinger.map((m) => (
            <Fragment key={m.id}>
              <Boble hvem={m.requester} naar={m.created_at}>
                {eierensTekst(m.body)}
              </Boble>
              {hasResponse(m) ? (
                <Boble hvem={ANAKIN_AGENT_ID} naar={m.responded_at ?? m.created_at}>
                  {m.response}
                </Boble>
              ) : null}
            </Fragment>
          ))}
          {venter ? (
            <p className="ny-stille">
              Anakin svarer… {lever ? `Siden spør basen hvert ${THREAD_POLL_MS / 1000}. sekund.` : ""}
            </p>
          ) : null}
          <form
            className="ny-skriv"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <textarea
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              maxLength={MESSAGE_MAX}
              rows={3}
              disabled={stengt}
              placeholder={venter ? "Vent på Anakins svar før du skriver mer." : "Skriv til Anakin…"}
            />
            <div className="ny-knapper">
              <button
                type="submit"
                className="ny-knapp liten primaer"
                disabled={stengt || tekst.trim() === ""}
              >
                {pending ? "Sender…" : "Send til Anakin"}
              </button>
              {t ? (
                <Snakk
                  continues={{ threadId: threadKey, parentId: t.last.id }}
                  period={parsed.period}
                  botHref={botHref}
                  tekst={t.active ? "Fortsett i Telegram" : "Ta opp igjen i Telegram"}
                />
              ) : null}
              {t?.closeTarget && !lukket?.ok ? (
                <button type="button" className="ny-knapp liten" disabled={pending} onClick={lukk}>
                  Lukk tråden
                </button>
              ) : null}
              {lukket?.ok ? <span className="ny-kvittering">Tråden er lukket.</span> : null}
              {lukket && !lukket.ok ? <span className="ny-feil">{lukket.error}</span> : null}
              {res ? (
                res.ok ? (
                  <span className="ny-kvittering">
                    {res.duplicate ? "En melding venter allerede på Anakin." : "Sendt. Svaret kommer her."}
                  </span>
                ) : (
                  <span className="ny-feil">{res.error}</span>
                )
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
