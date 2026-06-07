"use client"

import React from "react"

// ── types ─────────────────────────────────────────────────────
type ContentStatus = "publisert" | "utkast" | "planlagt" | "under arbeid"
type ContentType = "blogg" | "e-post" | "sosial" | "produkttekst"

type ContentItem = {
  id: string
  title: string
  type: ContentType
  status: ContentStatus
  author: string
  date: string
  category?: string
}

// ── mock data ─────────────────────────────────────────────────
const CONTENT_ITEMS: ContentItem[] = [
  { id: "C-041", title: "Glutathion: Kroppens mest undervurderte antioksidant", type: "blogg", status: "publisert", author: "Kim", date: "2026-06-05", category: "Detox" },
  { id: "C-042", title: "Sommernyhetsbrev — juni-tilbud + quiz", type: "e-post", status: "publisert", author: "Kim", date: "2026-06-03", category: "Nyhetsbrev" },
  { id: "C-043", title: "TUDCA og leverhelse — hva sier forskningen?", type: "blogg", status: "under arbeid", author: "Kim", date: "2026-06-10", category: "Fordøyelse" },
  { id: "C-044", title: "Kundehistorie: 90 dager med magnesiumprotokoll", type: "blogg", status: "utkast", author: "Kim", date: "2026-06-12", category: "Søvn & Stress" },
  { id: "C-045", title: "Instagram: NAC vs glutathion sammenligning", type: "sosial", status: "planlagt", author: "Kim", date: "2026-06-08", category: "Detox" },
  { id: "C-046", title: "Produkttekst: Kreatin monohydrat (ny)", type: "produkttekst", status: "under arbeid", author: "Kim", date: "2026-06-09", category: "Energi" },
  { id: "C-047", title: "Klaviyo: Abandoned cart — A/B test emnelinje", type: "e-post", status: "planlagt", author: "Kim", date: "2026-06-11", category: "Automatisering" },
  { id: "C-048", title: "Omega-3 kvalitetsguide — EPA/DHA ratio", type: "blogg", status: "planlagt", author: "Kim", date: "2026-06-16", category: "Immunforsvar" },
  { id: "C-049", title: "Instagram Reels: Morgenrutine for tarmhelse", type: "sosial", status: "utkast", author: "Kim", date: "2026-06-14", category: "Tarmhelse" },
  { id: "C-050", title: "Produkttekst rewrite: Berberine kompleks", type: "produkttekst", status: "planlagt", author: "Kim", date: "2026-06-18", category: "Metabolisme" },
]

// ── constants ─────────────────────────────────────────────────
const STATUS_STYLE: Record<ContentStatus, string> = {
  publisert: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  utkast: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  planlagt: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "under arbeid": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
}

const TYPE_LABELS: Record<ContentType, string> = {
  blogg: "Blogg",
  "e-post": "E-post",
  sosial: "Sosialt",
  produkttekst: "Produkttekst",
}

const TYPE_DOT: Record<ContentType, string> = {
  blogg: "bg-indigo-500",
  "e-post": "bg-amber-500",
  sosial: "bg-pink-500",
  produkttekst: "bg-green-500",
}

// ── component ─────────────────────────────────────────────────
export default function InnholdPage() {
  const [filter, setFilter] = React.useState<ContentType | "alle">("alle")

  const filtered = filter === "alle"
    ? CONTENT_ITEMS
    : CONTENT_ITEMS.filter((item) => item.type === filter)

  const counts = {
    publisert: CONTENT_ITEMS.filter((i) => i.status === "publisert").length,
    underArbeid: CONTENT_ITEMS.filter((i) => i.status === "under arbeid").length,
    utkast: CONTENT_ITEMS.filter((i) => i.status === "utkast").length,
    planlagt: CONTENT_ITEMS.filter((i) => i.status === "planlagt").length,
  }

  const typeCounts = {
    blogg: CONTENT_ITEMS.filter((i) => i.type === "blogg").length,
    "e-post": CONTENT_ITEMS.filter((i) => i.type === "e-post").length,
    sosial: CONTENT_ITEMS.filter((i) => i.type === "sosial").length,
    produkttekst: CONTENT_ITEMS.filter((i) => i.type === "produkttekst").length,
  }

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Innhold
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Redaksjonell kalender og produksjonsstatus — blogg, e-post, sosialt, produkttekster
        </p>
      </div>

      {/* Status KPIs */}
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
            <p className="text-sm text-gray-600 dark:text-gray-400">Publisert</p>
            <p className="mt-2 text-2xl font-semibold text-green-700 dark:text-green-300">{counts.publisert}</p>
            <p className="mt-1 text-xs text-gray-500">denne måneden</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5 dark:border-yellow-800 dark:bg-yellow-950">
            <p className="text-sm text-gray-600 dark:text-gray-400">Under arbeid</p>
            <p className="mt-2 text-2xl font-semibold text-yellow-700 dark:text-yellow-300">{counts.underArbeid}</p>
            <p className="mt-1 text-xs text-gray-500">aktive nå</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Utkast</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{counts.utkast}</p>
            <p className="mt-1 text-xs text-gray-500">venter på ferdigstilling</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-gray-600 dark:text-gray-400">Planlagt</p>
            <p className="mt-2 text-2xl font-semibold text-blue-700 dark:text-blue-300">{counts.planlagt}</p>
            <p className="mt-1 text-xs text-gray-500">i kalenderen</p>
          </div>
        </div>
      </section>

      {/* Content by Type */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Fordeling per type
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(Object.keys(typeCounts) as ContentType[]).map((type) => (
            <div
              key={type}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[type]}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {TYPE_LABELS[type]}
                </span>
              </div>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-50">
                {typeCounts[type]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Filter + Content Table */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Alle innholdselementer
          </h2>
          <div className="flex gap-2">
            {(["alle", "blogg", "e-post", "sosial", "produkttekst"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {f === "alle" ? "Alle" : TYPE_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tittel</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Kategori</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Dato</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-50">{item.title}</p>
                    <p className="text-xs text-gray-400">{item.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[item.type]}`} />
                      <span className="text-gray-600 dark:text-gray-300">{TYPE_LABELS[item.type]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(item.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
