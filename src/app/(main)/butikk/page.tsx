"use client"

import React from "react"
import { format } from "date-fns"

import { KpiCard } from "@/components/ui/KpiCard"
import { OsCard } from "@/components/ui/OsCard"
import { deltaLabel, kr, num } from "@/components/i-dag/format"
import {
  ApiError,
  getInventory,
  getMetrics,
  getShopifyDetail,
  type DeltaValue,
} from "@/lib/detox-api"
import {
  butikkVindu,
  IKKE_KOBLET,
  lesButikkTall,
  lesLagerTall,
  lesProduktTall,
  vurderFriskhet,
  type ButikkTall,
  type Datafriskhet,
  type LagerTall,
  type ProduktTall,
} from "@/lib/butikk"
import { cx } from "@/lib/utils"

// Siden viste fram til 2026-08-25 fire hardkodede konstanter uten en eneste
// fetch. Fra 2026-08-25 leste den ekte tall via ad-agent-proxyen, men sto med
// aatte "ikke tilgjengelig"-kort skrevet paa utviklerspraak - for eierne det
// samme som en tom side (Orion 2026-09-15). Naa: tre kilder (metrics,
// metrics/shopify, metrics/inventory), en kort-stil (KpiCard/OsCard), og det
// som fortsatt mangler staar paa en linje hver, med detaljene bak "Vis
// detaljer". Ingen mock, ingen fallback: mangler kilden, sier kortet det.

const WINDOW_DAYS = 30

type Kilde<T> =
  | { status: "laster" }
  | { status: "feil"; hint: string }
  | { status: "tom" }
  | { status: "ok"; data: T }

const LASTER = { status: "laster" } as const

function hintFra(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.hint) return e.hint
  return fallback
}

// KpiCard utleder retning fra om teksten starter med "-"; deltaLabel starter
// med en pil, saa retningen maa sendes eksplisitt - ellers blir et fall groent.
function deltaProps(
  d: DeltaValue | null | undefined,
): { delta?: string; trend?: "up" | "down" } {
  if (!d || d.pct == null) return {}
  return {
    delta: `${deltaLabel(d)} mot forrige ${WINDOW_DAYS} d`,
    trend: d.dir === "down" ? "down" : "up",
  }
}

function andel(a: number | null): string {
  return a == null ? "–" : `${Math.round(a * 100)} %`
}

export default function ButikkPage() {
  const [hoved, setHoved] = React.useState<
    Kilde<{ tall: ButikkTall; friskhet: Datafriskhet }>
  >(LASTER)
  const [detalj, setDetalj] = React.useState<Kilde<ProduktTall>>(LASTER)
  const [lager, setLager] = React.useState<Kilde<LagerTall>>(LASTER)

  React.useEffect(() => {
    let cancelled = false
    // Til og med i gaar: dagens tall finnes ikke foer synken 04:00 i morgen.
    const { since, until } = butikkVindu(new Date(), WINDOW_DAYS)

    getMetrics(since, until)
      .then((m) => {
        if (cancelled) return
        const friskhet = vurderFriskhet(m.lastSync, new Date())
        const tall = lesButikkTall(m)
        // Ingen Shopify-kanal i svaret er en aerlig tomtilstand, ikke nuller.
        setHoved(tall === null ? { status: "tom" } : { status: "ok", data: { tall, friskhet } })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setHoved({ status: "feil", hint: hintFra(e, "Shopify-tallene kunne ikke leses akkurat nå.") })
      })

    getShopifyDetail(since, until, 10)
      .then((d) => {
        if (cancelled) return
        const tall = lesProduktTall(d)
        setDetalj(tall === null ? { status: "tom" } : { status: "ok", data: tall })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setDetalj({ status: "feil", hint: hintFra(e, "Produkt- og kundetall kunne ikke leses akkurat nå.") })
      })

    getInventory()
      .then((d) => {
        if (!cancelled) setLager({ status: "ok", data: lesLagerTall(d) })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLager({ status: "feil", hint: hintFra(e, "Lagerstatus kunne ikke leses fra Shopify akkurat nå.") })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const friskhet = hoved.status === "ok" ? hoved.data.friskhet : null
  const tall = hoved.status === "ok" ? hoved.data.tall : null
  const laster = hoved.status === "laster"

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <header>
        <h1
          className="text-[22px] font-medium text-[var(--os-text-primary)]"
          style={{ letterSpacing: "-0.6px" }}
        >
          Butikk
        </h1>
        <p className="jbm mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--os-text-muted)]">
          <span>Shopify · siste {WINDOW_DAYS} hele dager, til og med i går</span>
          {friskhet && (
            <>
              <span aria-hidden="true">·</span>
              <Friskhet friskhet={friskhet} />
            </>
          )}
        </p>
      </header>

      {hoved.status === "feil" && <Feilkort tittel="Shopify-tall" hint={hoved.hint} />}
      {hoved.status === "tom" && (
        <Feilkort tittel="Shopify-tall" hint="Ingen ordrer registrert i perioden." stille />
      )}

      {/* KPI-rad: en stil, ett tall per kort, ingen gjentakelse lenger ned */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Omsetning"
          tooltip={`Sum ordreverdi fra Shopify siste ${WINDOW_DAYS} hele dager, alle ordrestatuser (brutto).`}
          value={laster ? "…" : tall ? kr(tall.omsetning) : "n/a"}
          {...deltaProps(tall?.delta.omsetning)}
          width="72%"
        />
        <KpiCard
          label="Netto omsetning"
          tooltip="Omsetning uten refunderte og annullerte ordrer. Delvis refunderte ordrer er med, siden refundert beløp ikke er tilgjengelig ennå."
          value={
            detalj.status === "laster"
              ? "…"
              : detalj.status === "ok"
                ? kr(detalj.data.netto.omsetning)
                : "n/a"
          }
          delta={
            detalj.status === "ok" && detalj.data.netto.utelatt > 0
              ? `${num(detalj.data.netto.utelatt)} ordrer holdt utenfor`
              : undefined
          }
          trend="up"
          width="64%"
        />
        <KpiCard
          label="Ordrer"
          tooltip={`Antall Shopify-ordrer siste ${WINDOW_DAYS} hele dager, alle statuser.`}
          value={laster ? "…" : tall ? num(tall.ordrer) : "n/a"}
          {...deltaProps(tall?.delta.ordrer)}
          width="55%"
        />
        <KpiCard
          label="Snittordre"
          tooltip="Omsetning delt på antall ordrer i perioden."
          value={laster ? "…" : tall ? kr(tall.snittordre) : "n/a"}
          {...deltaProps(tall?.delta.snittordre)}
          width="48%"
        />
        <KpiCard
          label="Solgte enheter"
          tooltip="Antall solgte enheter i perioden, summert fra ordrelinjene."
          value={laster ? "…" : tall ? num(tall.enheter) : "n/a"}
          delta={
            detalj.status === "ok"
              ? `${num(detalj.data.ulikeProdukter)} ulike produkter`
              : undefined
          }
          trend="up"
          width="40%"
        />
      </div>

      {/* Produkter · Kunder · Lager */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OsCard title="Topprodukter" className="lg:col-span-1">
          {detalj.status === "laster" ? (
            <Skeleton rader={5} />
          ) : detalj.status !== "ok" ? (
            <Tomt hint={detalj.status === "feil" ? detalj.hint : "Ingen salg i perioden."} />
          ) : (
            <ol className="space-y-1.5">
              {detalj.data.topp.map((p, i) => (
                <li
                  key={`${p.navn}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                >
                  <span className="min-w-0 truncate text-[var(--os-text-secondary)]">
                    <span className="jbm mr-1.5 text-[10px] text-[var(--os-text-muted)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {p.navn}
                  </span>
                  <span className="jbm shrink-0 tabular-nums text-[var(--os-text-primary)]">
                    {kr(p.omsetning)}
                    <span className="ml-1.5 text-[10px] text-[var(--os-text-muted)]">
                      {num(p.enheter)} stk
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </OsCard>

        <OsCard title="Kunder">
          {detalj.status === "laster" ? (
            <Skeleton rader={3} />
          ) : detalj.status !== "ok" ? (
            <Tomt hint={detalj.status === "feil" ? detalj.hint : "Ingen ordrer i perioden."} />
          ) : (
            <div className="space-y-3">
              <Segment
                navn="Nye kunder"
                ordrer={detalj.data.kunder.nye.ordrer}
                andel={detalj.data.kunder.nye.andel}
              />
              <Segment
                navn="Returnerende"
                ordrer={detalj.data.kunder.returnerende.ordrer}
                andel={detalj.data.kunder.returnerende.andel}
                farge="var(--os-purple)"
              />
              {detalj.data.kunder.ukjent.ordrer > 0 && (
                <p className="jbm text-[10px] text-[var(--os-text-muted)]">
                  {num(detalj.data.kunder.ukjent.ordrer)} ordrer uten kundeprofil
                </p>
              )}
            </div>
          )}
        </OsCard>

        <OsCard title="Lager">
          {lager.status === "laster" ? (
            <Skeleton rader={3} />
          ) : lager.status !== "ok" ? (
            <Tomt hint={lager.status === "feil" ? lager.hint : "Ingen lagerdata."} />
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-2">
                <MiniTall navn="produkter" verdi={num(lager.data.produkter)} />
                <MiniTall navn="på lager" verdi={num(lager.data.enheter)} />
                <MiniTall
                  navn="utsolgt"
                  verdi={num(lager.data.utsolgt)}
                  varsel={lager.data.utsolgt > 0}
                />
              </div>
              {lager.data.lavtListe.length > 0 ? (
                <div className="mt-3">
                  <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                    Lav beholdning (≤ {lager.data.terskel})
                  </p>
                  <ul className="mt-1 space-y-1">
                    {lager.data.lavtListe.slice(0, 6).map((p) => (
                      <li
                        key={p.navn}
                        className="flex items-baseline justify-between gap-3 text-[12px]"
                      >
                        <span className="min-w-0 truncate text-[var(--os-text-secondary)]">
                          {p.navn}
                        </span>
                        <span
                          className={cx(
                            "jbm shrink-0 tabular-nums",
                            p.antall <= 0
                              ? "text-[var(--os-danger)]"
                              : "text-[var(--os-warning)]",
                          )}
                        >
                          {num(p.antall)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {lager.data.lavt > 6 && (
                    <p className="jbm mt-1 text-[10px] text-[var(--os-text-muted)]">
                      + {num(lager.data.lavt - 6)} til
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-[var(--os-text-secondary)]">
                  Ingen produkter under {lager.data.terskel} på lager.
                </p>
              )}
              <p className="jbm mt-3 text-[10px] text-[var(--os-text-muted)]">
                Lest {format(new Date(lager.data.hentet), "d. MMM HH:mm")}
              </p>
            </div>
          )}
        </OsCard>
      </div>

      {/* Det som fortsatt mangler - en linje hver, detaljer bak en utvidelse */}
      <section className="mt-8">
        <div className="flex items-center gap-x-1.5 px-1">
          <span
            className="size-1.5 rounded-full bg-[var(--os-text-muted)]"
            aria-hidden="true"
          />
          <h2 className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
            Ikke koblet til ennå
          </h2>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {IKKE_KOBLET.map((rad) => (
            <OsCard key={rad.navn}>
              <p className="text-[13px] font-medium text-[var(--os-text-primary)]">
                {rad.navn}
              </p>
              <p className="mt-1 text-[12px] text-[var(--os-text-secondary)]">
                {rad.status}
              </p>
              <details className="mt-2">
                <summary className="jbm cursor-pointer text-[10px] uppercase tracking-wide text-[var(--os-text-muted)] hover:text-[var(--os-accent)]">
                  Vis detaljer
                </summary>
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--os-text-muted)]">
                  {rad.detaljer}
                </p>
              </details>
            </OsCard>
          ))}
        </div>
      </section>
    </div>
  )
}

function Friskhet({ friskhet }: { friskhet: Datafriskhet }) {
  const stale = friskhet.data_mode === "stale"
  if (friskhet.sist_synket === null) {
    return <span className="text-[var(--os-warning)]">ingen synk registrert</span>
  }
  return (
    <span className={stale ? "text-[var(--os-warning)]" : undefined}>
      synket {format(new Date(friskhet.sist_synket), "d. MMM HH:mm")}
      {stale && " · eldre enn normalt"}
    </span>
  )
}

function Feilkort({
  tittel,
  hint,
  stille = false,
}: {
  tittel: string
  hint: string
  stille?: boolean
}) {
  return (
    <div
      className={cx(
        "mt-4 rounded-[var(--os-radius-md)] border-[0.5px] px-4 py-3 text-[12px]",
        stille
          ? "border-[var(--os-border)] text-[var(--os-text-secondary)]"
          : "border-[var(--os-danger)]/40 bg-[var(--os-danger)]/10 text-[var(--os-danger)]",
      )}
    >
      <span className="font-medium">{tittel}:</span> {hint}
    </div>
  )
}

function Tomt({ hint }: { hint: string }) {
  return (
    <p className="text-[12px] leading-snug text-[var(--os-text-secondary)]">
      {hint}
    </p>
  )
}

function Skeleton({ rader }: { rader: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rader }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-[var(--os-bg-hover)]"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  )
}

function Segment({
  navn,
  ordrer,
  andel: a,
  farge = "var(--os-accent)",
}: {
  navn: string
  ordrer: number
  andel: number | null
  farge?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-[var(--os-text-secondary)]">{navn}</span>
        <span className="jbm tabular-nums text-[var(--os-text-primary)]">
          {andel(a)}
          <span className="ml-1.5 text-[10px] text-[var(--os-text-muted)]">
            {num(ordrer)} ordrer
          </span>
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-[var(--os-bg-hover)]">
        <div
          className="h-full rounded"
          style={{ width: `${Math.round((a ?? 0) * 100)}%`, background: farge }}
        />
      </div>
    </div>
  )
}

function MiniTall({
  navn,
  verdi,
  varsel = false,
}: {
  navn: string
  verdi: string
  varsel?: boolean
}) {
  return (
    <div>
      <p
        className={cx(
          "text-[18px] font-medium tabular-nums leading-tight",
          varsel ? "text-[var(--os-warning)]" : "text-[var(--os-text-primary)]",
        )}
        style={{ letterSpacing: "-0.4px" }}
      >
        {verdi}
      </p>
      <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
        {navn}
      </p>
    </div>
  )
}
