"use client"

import React from "react"
import { Badge } from "@/components/Badge"
import { Input } from "@/components/Input"

// ── types ─────────────────────────────────────────────────────
type NoteType = "beslutning" | "forskning" | "ide" | "mote"

type Note = {
  id: string
  title: string
  excerpt: string
  type: NoteType
  tags: string[]
  project: string
  updated: string
  pinned: boolean
}

// ── helpers ───────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
const TYPE_BADGE: Record<
  NoteType,
  { label: string; variant: "default" | "success" | "warning" | "neutral" }
> = {
  beslutning: { label: "Beslutning", variant: "default" },
  forskning: { label: "Forskning", variant: "success" },
  ide: { label: "Idé", variant: "warning" },
  mote: { label: "Møte", variant: "neutral" },
}

// ── mock data ─────────────────────────────────────────────────
const NOTES: Note[] = [
  {
    id: "n-1",
    title: "Valg av metafield-struktur for produkter",
    excerpt:
      "Besluttet namespace `detox` med faste keys: short_description, benefits, ingredients, dosage, full_ingredients, certifications. INCI lagres verbatim i full_ingredients.",
    type: "beslutning",
    tags: ["shopify", "produkt", "metafields"],
    project: "Shopify-tema",
    updated: "2026-06-02",
    pinned: true,
  },
  {
    id: "n-2",
    title: "ROAS-terskler per segment",
    excerpt:
      "[COLD] krever 1.5x før skalering, [WARM] 2.5x, [EMAIL] 4x. Cold-start-guard hindrer pausing før 50 visninger. Validert mot Q1-data.",
    type: "beslutning",
    tags: ["ads", "roas", "railway"],
    project: "Ad agent",
    updated: "2026-05-28",
    pinned: true,
  },
  {
    id: "n-3",
    title: "Bioflavonoider og C-vitamin opptak",
    excerpt:
      "Forskningsnotat: sitrusbioflavonoider kan støtte opptak av askorbinsyre. Må verifisere kildegrunnlag før evt. bruk i produkttekst — helsepåstand-regelverk gjelder.",
    type: "forskning",
    tags: ["ingrediens", "vitamin-c", "compliance"],
    project: "detox.OS",
    updated: "2026-05-20",
    pinned: false,
  },
  {
    id: "n-4",
    title: "Leverandør-onboarding sjekkpunkter",
    excerpt:
      "Krev COA før første batch godkjennes. Karantene-status til kvalitetsscore > 75. Sahel Adaptogens mangler COA — følges opp.",
    type: "mote",
    tags: ["leverandør", "kvalitet"],
    project: "detox.OS",
    updated: "2026-05-15",
    pinned: false,
  },
  {
    id: "n-5",
    title: "Idé: quiz-resultat → automatisk Klaviyo-segment",
    excerpt:
      "Når kunde fullfører produktquiz, push svar som segment-tagger til Klaviyo. Muliggjør målrettet oppfølging på behovskategori.",
    type: "ide",
    tags: ["quiz", "klaviyo", "automatisering"],
    project: "Shopify-tema",
    updated: "2026-05-12",
    pinned: false,
  },
  {
    id: "n-6",
    title: "MVA-håndtering kosttilskudd",
    excerpt:
      "Kosttilskudd: 25% MVA i Norge. Bekreftet med Iman. Frakt følger varens sats. Dokumentert for Fiken-mapping i bankavstemming-SOP.",
    type: "beslutning",
    tags: ["mva", "fiken", "økonomi"],
    project: "detox.OS",
    updated: "2026-05-08",
    pinned: false,
  },
  {
    id: "n-7",
    title: "OutOfStock-bug i strukturert data",
    excerpt:
      "Rich Results feiler når produkt er utsolgt — schema setter availability feil. Foreslått fiks: map Shopify inventory til schema.org/InStock|OutOfStock eksplisitt.",
    type: "forskning",
    tags: ["seo", "schema", "bug"],
    project: "Shopify-tema",
    updated: "2026-04-30",
    pinned: false,
  },
  {
    id: "n-8",
    title: "Tone of voice — kundeservice",
    excerpt:
      "Varm, faglig, ikke selgende. Aldri diagnostisere. Ved helsespørsmål: henvis til kvalifisert behandler. Norsk bokmål, du-form.",
    type: "mote",
    tags: ["kundeservice", "brand", "tone"],
    project: "detox.OS",
    updated: "2026-04-22",
    pinned: false,
  },
]

const ALL_TAGS = ["Alle", ...Array.from(new Set(NOTES.flatMap((n) => n.tags)))]

// ── component ─────────────────────────────────────────────────
export default function Notater() {
  const [query, setQuery] = React.useState("")
  const [tag, setTag] = React.useState("Alle")

  const visible = NOTES.filter((n) => {
    const matchTag = tag === "Alle" || n.tags.includes(tag)
    const q = query.trim().toLowerCase()
    const matchQuery =
      q === "" ||
      n.title.toLowerCase().includes(q) ||
      n.excerpt.toLowerCase().includes(q) ||
      n.tags.some((t) => t.includes(q))
    return matchTag && matchQuery
  })

  const pinned = visible.filter((n) => n.pinned)
  const rest = visible.filter((n) => !n.pinned)

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Notater
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Beslutningslogg og forskningsnotater
          </p>
        </div>
        <Badge variant="neutral">{NOTES.length} notater</Badge>
      </div>

      {/* ── Toolbar ── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tag === t
                  ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {t === "Alle" ? t : `#${t}`}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Søk i notater…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          Ingen notater matcher.
        </div>
      )}

      {/* ── Pinned ── */}
      {pinned.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            📌 Festet
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pinned.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        </section>
      )}

      {/* ── Rest ── */}
      {rest.length > 0 && (
        <section className="mt-8">
          {pinned.length > 0 && (
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Alle notater
            </h2>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// ── small parts ───────────────────────────────────────────────
function NoteCard({ note }: { note: Note }) {
  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-start justify-between gap-2">
        <Badge variant={TYPE_BADGE[note.type].variant}>
          {TYPE_BADGE[note.type].label}
        </Badge>
        <span className="text-xs text-gray-400">{fmtDate(note.updated)}</span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
        {note.title}
      </h3>
      <p className="mt-1.5 line-clamp-4 flex-1 text-sm text-gray-600 dark:text-gray-300">
        {note.excerpt}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        <span className="mr-1 text-xs text-gray-400">{note.project}</span>
        {note.tags.map((t) => (
          <span
            key={t}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          >
            #{t}
          </span>
        ))}
      </div>
    </article>
  )
}
