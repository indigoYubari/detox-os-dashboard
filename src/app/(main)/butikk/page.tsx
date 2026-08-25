"use client"

import React from "react"
import { format, subDays } from "date-fns"

import { StatTooltip } from "@/components/ui/StatTooltip"
import { deltaClass, kr, num, pctLabel } from "@/lib/ad-format"
import { getMetrics, type DeltaValue } from "@/lib/detox-api"
import {
  IKKE_TILGJENGELIG,
  lesButikkTall,
  vurderFriskhet,
  type ButikkTall,
  type Datafriskhet,
} from "@/lib/butikk"

// Siden viste fram til 2026-08-25 fire hardkodede konstanter - 186 ordrer og
// kr 312 400 MTD, topprodukter med oppdiktede SKU-er, lagertall og en
// ordreliste datert 7. juni - uten en eneste fetch. Den leser naa Shopify via
// den samme autentiserte ad-agent-proxyen som /annonser allerede bruker.
//
// Det som ikke finnes i noen ekte kilde er fjernet, ikke erstattet med nye
// tall. Se IKKE_TILGJENGELIG nederst paa siden.

const WINDOW_DAYS = 30

type Tilstand =
  | { status: "laster" }
  | { status: "feil"; melding: string }
  | { status: "tom"; friskhet: Datafriskhet }
  | { status: "ok"; tall: ButikkTall; friskhet: Datafriskhet }

function Delta({ verdi }: { verdi: DeltaValue | null }) {
  if (!verdi) return null
  return (
    <p className={`mt-1 text-xs ${deltaClass(verdi.dir)}`}>
      {pctLabel(verdi.pct, verdi.dir)} mot forrige {WINDOW_DAYS} dager
    </p>
  )
}

function Kpi({
  navn,
  forklaring,
  verdi,
  delta,
  fremhevet = false,
}: {
  navn: string
  forklaring: string
  verdi: string
  delta?: DeltaValue | null
  fremhevet?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        fremhevet
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <StatTooltip explanation={forklaring}>{navn}</StatTooltip>
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          fremhevet
            ? "text-green-700 dark:text-green-300"
            : "text-gray-900 dark:text-gray-50"
        }`}
      >
        {verdi}
      </p>
      {delta !== undefined && <Delta verdi={delta} />}
    </div>
  )
}

function Kildelinje({ friskhet }: { friskhet: Datafriskhet }) {
  const stale = friskhet.data_mode === "stale"
  return (
    <div
      className={`mt-4 rounded-xl border p-3 text-sm ${
        stale
          ? "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
          : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
      }`}
    >
      <span className="font-medium">
        Kilde: Shopify via ad-agent · {friskhet.data_mode}
      </span>
      {friskhet.sist_synket === null ? (
        <span> · ingen synk registrert</span>
      ) : (
        <span>
          {" "}
          · sist synket{" "}
          {format(new Date(friskhet.sist_synket), "d. MMM HH:mm")}
          {friskhet.timer_siden !== null && ` (${friskhet.timer_siden}t siden)`}
        </span>
      )}
      {stale && (
        <p className="mt-1 text-xs">
          Synken har ikke kjørt som normalt. Tallene under er ekte, men kan
          være utdaterte.
        </p>
      )}
    </div>
  )
}

export default function ButikkPage() {
  const [tilstand, setTilstand] = React.useState<Tilstand>({ status: "laster" })

  React.useEffect(() => {
    let cancelled = false
    const naa = new Date()
    const since = format(subDays(naa, WINDOW_DAYS), "yyyy-MM-dd")
    const until = format(naa, "yyyy-MM-dd")

    getMetrics(since, until)
      .then((m) => {
        if (cancelled) return
        const friskhet = vurderFriskhet(m.lastSync, new Date())
        const tall = lesButikkTall(m)
        // Ingen Shopify-kanal i svaret er en aerlig tomtilstand, ikke nuller.
        setTilstand(
          tall === null
            ? { status: "tom", friskhet }
            : { status: "ok", tall, friskhet },
        )
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setTilstand({
            status: "feil",
            melding: e instanceof Error ? e.message : "Ukjent feil",
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Butikk
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Shopify · siste {WINDOW_DAYS} dager
        </p>
      </div>

      {tilstand.status === "feil" && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Kunne ikke lese Shopify-tall</p>
          <p className="mt-1 text-xs">
            {tilstand.melding} · ingen tall vises, siden vi ikke har noen.
          </p>
        </div>
      )}

      {(tilstand.status === "ok" || tilstand.status === "tom") && (
        <Kildelinje friskhet={tilstand.friskhet} />
      )}

      {tilstand.status === "tom" && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Ingen Shopify-data registrert i denne perioden.
        </div>
      )}

      {/* KPIer */}
      <section className="mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tilstand.status === "laster"
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="mt-3 h-7 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              ))
            : tilstand.status === "ok" && (
                <>
                  <Kpi
                    navn="Omsetning"
                    forklaring={`Sum omsetning fra Shopify-ordrer siste ${WINDOW_DAYS} dager. Kansellerte ordrer er ikke med.`}
                    verdi={kr(tilstand.tall.omsetning)}
                    delta={tilstand.tall.delta.omsetning}
                  />
                  <Kpi
                    navn="Ordrer"
                    forklaring={`Antall Shopify-ordrer siste ${WINDOW_DAYS} dager.`}
                    verdi={num(tilstand.tall.ordrer)}
                    delta={tilstand.tall.delta.ordrer}
                  />
                  <Kpi
                    navn="Snittordre"
                    forklaring="Omsetning delt på antall ordrer i perioden."
                    verdi={kr(tilstand.tall.snittordre)}
                    delta={tilstand.tall.delta.snittordre}
                    fremhevet
                  />
                  <Kpi
                    navn="Produkter solgt"
                    forklaring="Antall ulike produkter med minst ett salg i perioden, og totalt antall solgte enheter."
                    verdi={`${num(tilstand.tall.produkter)} / ${num(
                      tilstand.tall.enheter,
                    )} enh.`}
                  />
                </>
              )}
        </div>
      </section>

      {/* Ærlig gjeldsliste - erstatter det mocken pleide aa vise */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Ikke tilgjengelig ennå
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Dette viste den gamle siden med oppdiktede tall. Det er fjernet
          framfor erstattet, og står her til kilden faktisk finnes.
        </p>
        <div className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {IKKE_TILGJENGELIG.map((rad) => (
            <div key={rad.navn} className="bg-white p-4 dark:bg-gray-900">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                {rad.navn}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {rad.hvorfor}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
