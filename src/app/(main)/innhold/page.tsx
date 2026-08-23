import React from "react"

import {
  CONTENT_STAGES,
  countByStage,
  freshnessOf,
  latestSyncedAt,
  STAGE_DOT,
  STAGE_LABELS,
  type ContentItem,
} from "@/lib/content"
import { fetchContentItems } from "@/lib/content-server"

import { ContentTable } from "./ContentTable"

// Denne siden leser ekte state fra content_items med brukerens egen session.
// Den hadde ti hardkodede elementer fram til 2026-08-23; de er fjernet, ikke
// beholdt som fallback. Tom tabell skal se tom ut, ikke travel.
export const dynamic = "force-dynamic"

const KPI_CARD_STYLE =
  "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"

function Header() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
        Innhold
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Produksjonsstatus for content-workflowen — brief, draft, claim-check,
        voice/kanal
      </p>
    </div>
  )
}

function Provenance({ items }: { items: ContentItem[] }) {
  const syncedAt = latestSyncedAt(items)
  const freshness = freshnessOf(syncedAt)

  const tone =
    freshness.mode === "live"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : freshness.mode === "stale"
        ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"

  const label =
    freshness.mode === "live"
      ? "LIVE"
      : freshness.mode === "stale"
        ? "STALE"
        : "UKJENT FERSKHET"

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex rounded-md px-2 py-1 font-semibold ${tone}`}
      >
        {label}
      </span>
      <span className="text-gray-500 dark:text-gray-400">
        Kilde: detox-vault{" "}
        <code className="text-gray-400">
          workflows/content/stages/*/output/
        </code>
        {syncedAt
          ? ` — synkronisert ${new Date(syncedAt).toLocaleString("nb-NO")}`
          : " — aldri synkronisert"}
      </span>
    </div>
  )
}

export default async function InnholdPage() {
  const result = await fetchContentItems()

  if (!result.ok) {
    return (
      <>
        <Header />
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
          <p className="font-medium text-red-800 dark:text-red-200">
            Kunne ikke hente innholdsstate
          </p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {result.error}
          </p>
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            Siden viser ingen tall framfor aa vise gamle eller oppdiktede. Sjekk
            tilgang til content_items, eller kjor synken paa nytt.
          </p>
        </div>
      </>
    )
  }

  const items = result.items
  const counts = countByStage(items)

  if (items.length === 0) {
    return (
      <>
        <Header />
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="font-medium text-gray-900 dark:text-gray-50">
            Ingen innholdselementer enda
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
            Content-workflowen i detox-vault har ingen filer i{" "}
            <code>workflows/content/stages/*/output/</code>, eller synken har
            ikke kjort. Kjor{" "}
            <code>node scripts/sync-content-from-vault.mjs</code> for aa hente
            inn dagens state.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <Provenance items={items} />

      {/* Stage-KPI-er: de fire stagene som faktisk finnes i workflowen. */}
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CONTENT_STAGES.map((stage) => (
            <div key={stage} className={KPI_CARD_STYLE}>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${STAGE_DOT[stage]}`}
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {STAGE_LABELS[stage]}
                </p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {counts[stage]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <ContentTable items={items} />
      </section>
    </>
  )
}
