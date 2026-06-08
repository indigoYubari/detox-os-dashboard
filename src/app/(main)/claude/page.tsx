"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"

// ── types ─────────────────────────────────────────────────────
type Role = "user" | "assistant"
type Message = { role: Role; text: string; time: string }
type Conversation = {
  id: string
  title: string
  project: string
  updated: string
  model: string
  messages: Message[]
}

// ── helpers ───────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  })
}

// ── mock data ─────────────────────────────────────────────────
const CONVERSATIONS: Conversation[] = [
  {
    id: "c-1",
    title: "Metafield-struktur for nytt produkt",
    project: "Shopify-tema",
    updated: "2026-06-05",
    model: "Sonnet 4.6",
    messages: [
      {
        role: "user",
        text: "Hvordan bør jeg strukturere metafields for et nytt magnesiumprodukt?",
        time: "14:02",
      },
      {
        role: "assistant",
        text: "Bruk namespace `detox` med faste keys: short_description, benefits, dosage, full_ingredients, certifications. INCI-listen limes inn verbatim i full_ingredients — aldri omskriv.",
        time: "14:02",
      },
      { role: "user", text: "Og helsepåstandene?", time: "14:05" },
      {
        role: "assistant",
        text: "Hold dem innenfor Forbrukertilsynets regelverk. Ingen sykdomsrelaterte påstander. Bruk godkjente formuleringer for mineraler — jeg kan sjekke hver enkelt mot listen.",
        time: "14:05",
      },
    ],
  },
  {
    id: "c-2",
    title: "ROAS-terskel for kald trafikk",
    project: "Ad agent",
    updated: "2026-06-04",
    model: "Opus 4.8",
    messages: [
      {
        role: "user",
        text: "Bør cold-segmentet ha lavere ROAS-terskel?",
        time: "09:11",
      },
      {
        role: "assistant",
        text: "Ja. [COLD] tåler 1.5x fordi den bygger toppen av trakten. [WARM] bør ligge på 2.5x og [EMAIL] 4x. Cold-start-guard hindrer pausing før 50 visninger.",
        time: "09:12",
      },
    ],
  },
  {
    id: "c-3",
    title: "Nyhetsbrev — emnefelt-varianter",
    project: "detox.OS",
    updated: "2026-06-03",
    model: "Sonnet 4.6",
    messages: [
      {
        role: "user",
        text: "Gi meg 3 emnefelt for nyhetsbrevet om søvn.",
        time: "11:40",
      },
      {
        role: "assistant",
        text: "1) «Sover du dårlig? Start her» 2) «Kroppens nattskift trenger dette» 3) «3 grep for dypere søvn». A/B-test de to første mot hverandre.",
        time: "11:40",
      },
    ],
  },
  {
    id: "c-4",
    title: "Bankavstemming juni — MVA-spørsmål",
    project: "detox.OS",
    updated: "2026-05-30",
    model: "Haiku 4.5",
    messages: [
      {
        role: "user",
        text: "Hvilken MVA-sats gjelder frakt på kosttilskudd?",
        time: "16:20",
      },
      {
        role: "assistant",
        text: "Frakt følger varens sats — 25% for kosttilskudd i Norge. Bokfør fraktinntekt med samme sats som varelinjen i Fiken.",
        time: "16:20",
      },
    ],
  },
]

// ── component ─────────────────────────────────────────────────
export default function Claude() {
  const [activeId, setActiveId] = React.useState(CONVERSATIONS[0].id)
  const [query, setQuery] = React.useState("")
  const [draft, setDraft] = React.useState("")

  const visible = CONVERSATIONS.filter((c) => {
    const q = query.trim().toLowerCase()
    return (
      q === "" ||
      c.title.toLowerCase().includes(q) ||
      c.project.toLowerCase().includes(q)
    )
  })
  const active = CONVERSATIONS.find((c) => c.id === activeId) ?? null

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Claude
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tilgang til samtaler og prosjekter
          </p>
        </div>
        <Badge variant="neutral">{CONVERSATIONS.length} samtaler</Badge>
      </div>

      {/* ── Split ── */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* conversation list */}
        <div className="lg:col-span-1">
          <div className="mb-3">
            <Input
              type="search"
              placeholder="Søk samtaler…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {visible.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
                Ingen samtaler.
              </p>
            ) : (
              visible.map((c) => {
                const isActive = c.id === activeId
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`block w-full rounded-lg border p-3 text-left transition ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/30 dark:ring-emerald-700"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                      {c.title}
                    </p>
                    <p className="mt-1 flex items-center justify-between text-xs text-gray-400">
                      <span>{c.project}</span>
                      <span>{fmtDate(c.updated)}</span>
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* thread */}
        <div className="lg:col-span-2">
          {active ? (
            <div className="flex h-[36rem] flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              {/* thread header */}
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                    {active.title}
                  </p>
                  <p className="text-xs text-gray-400">{active.project}</p>
                </div>
                <Badge variant="success">{active.model}</Badge>
              </div>

              {/* messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {active.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                      }`}
                    >
                      <p>{m.text}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          m.role === "user"
                            ? "text-gray-300 dark:text-gray-500"
                            : "text-gray-400"
                        }`}
                      >
                        {m.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* composer */}
              <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-end gap-2">
                  <Input
                    placeholder="Skriv til Claude…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1"
                  />
                  <button
                    disabled={draft.trim() === ""}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
              Velg en samtale.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
