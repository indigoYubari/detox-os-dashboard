"use client"

import React from "react"
import { StatTooltip } from "@/components/ui/StatTooltip"

type GmailMelding = {
  id: string
  subject: string
  from: string
  fromName: string
  date: string
  snippet: string
  unread: boolean
  kategori: string
}

type KundeserviceData = {
  meldinger: GmailMelding[]
  totalt: number
  kategorier: Record<string, number>
}

// Ruta gir 503 (Gmail ikke konfigurert) eller 502 (Gmail nede). Tidligere ga
// begge en tom innboks med status 200, som er en helt annen beskjed enn
// "vi klarte ikke aa lese den".
type KildeFeil = "ikke_konfigurert" | "utilgjengelig"

const KATEGORI_FARGE: Record<string, string> = {
  Levering: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Retur/bytte": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Produktinfo: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  Betaling: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Abonnement: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Generelt: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

function formatDato(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffH = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60))
    if (diffH < 1) return "Akkurat na"
    if (diffH < 24) return diffH + "t siden"
    if (diffH < 48) return "I gar"
    return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })
  } catch {
    return ""
  }
}

function gmailLink(id: string): string {
  return "https://mail.google.com/mail/u/0/#inbox/" + id
}

export default function KundeservicePage() {
  const [data, setData] = React.useState<KundeserviceData | null>(null)
  const [feil, setFeil] = React.useState<KildeFeil | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [kategoriFilter, setKategoriFilter] = React.useState<string>("alle")
  const [visUleste, setVisUleste] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/gmail/kundeservice", { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) {
          setFeil(r.status === 503 ? "ikke_konfigurert" : "utilgjengelig")
          setLoading(false)
          return
        }
        setData((await r.json()) as KundeserviceData)
        setFeil(null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setFeil("utilgjengelig")
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const meldinger = data?.meldinger ?? []
  const uleste = meldinger.filter((m) => m.unread).length
  const kategorier = data?.kategorier ?? {}

  const filtrert = meldinger.filter((m) => {
    if (visUleste && !m.unread) return false
    if (kategoriFilter !== "alle" && m.kategori !== kategoriFilter) return false
    return true
  })

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Kundeservice
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Live innboks fra kontakt@detox.no
        </p>
      </div>

      {feil !== null && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">
            {feil === "ikke_konfigurert"
              ? "Gmail er ikke koblet til"
              : "Gmail er utilgjengelig akkurat nå"}
          </p>
          <p className="mt-1 text-xs">
            Innboksen kunne ikke leses. Tallene under er ikke en måling — de er
            tomme fordi vi ikke fikk svar.
          </p>
        </div>
      )}

      {/* KPIer */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <StatTooltip explanation="Totalt antall e-poster i innboksen til kontakt@detox.no (siste 50).">
                Meldinger
              </StatTooltip>
            </p>
            {loading ? (
              <div className="mt-2 h-7 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            ) : (
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {data?.totalt ?? 0}
              </p>
            )}
          </div>
          <div className={`rounded-lg border p-5 ${uleste > 0 ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <StatTooltip explanation="Uleste e-poster i innboksen. Disse trenger rask oppfolging.">
                Uleste
              </StatTooltip>
            </p>
            {loading ? (
              <div className="mt-2 h-7 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            ) : (
              <p className={`mt-2 text-2xl font-semibold ${uleste > 0 ? "text-yellow-700 dark:text-yellow-300" : "text-gray-900 dark:text-gray-50"}`}>
                {uleste}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <StatTooltip explanation="Storste kategori blant innkommende henvendelser.">
                Topp kategori
              </StatTooltip>
            </p>
            {loading ? (
              <div className="mt-2 h-7 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            ) : (
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-50">
                {Object.entries(kategorier).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <StatTooltip explanation="Antall ulike emne-kategorier blant henvendelsene.">
                Kategorier
              </StatTooltip>
            </p>
            {loading ? (
              <div className="mt-2 h-7 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            ) : (
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {Object.keys(kategorier).length}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Filtre */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setVisUleste(!visUleste)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${visUleste ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}
        >
          Kun uleste
        </button>
        <button
          onClick={() => setKategoriFilter("alle")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${kategoriFilter === "alle" ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}
        >
          Alle
        </button>
        {Object.entries(kategorier)
          .sort((a, b) => b[1] - a[1])
          .map(([kat, antall]) => (
            <button
              key={kat}
              onClick={() => setKategoriFilter(kat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${kategoriFilter === kat ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}
            >
              {kat} ({antall})
            </button>
          ))}
      </div>

      {/* Meldingsliste */}
      <section className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : filtrert.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">Ingen meldinger for valgt filter</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Avsender</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Emne</th>
                  <th className="hidden px-4 py-3 font-medium text-gray-500 sm:table-cell dark:text-gray-400">Kategori</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {filtrert.map((m) => (
                  <tr
                    key={m.id}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${m.unread ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}
                    onClick={() => window.open(gmailLink(m.id), "_blank")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.unread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                        <span className={`truncate max-w-[120px] ${m.unread ? "font-semibold text-gray-900 dark:text-gray-50" : "text-gray-700 dark:text-gray-300"}`}>
                          {m.fromName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`truncate max-w-xs ${m.unread ? "font-medium text-gray-900 dark:text-gray-50" : "text-gray-700 dark:text-gray-300"}`}>
                        {m.subject}
                      </p>
                      <p className="mt-0.5 truncate max-w-xs text-xs text-gray-400 dark:text-gray-500">
                        {m.snippet}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${KATEGORI_FARGE[m.kategori] ?? KATEGORI_FARGE.Generelt}`}>
                        {m.kategori}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                      {formatDato(m.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </>
  )
}
