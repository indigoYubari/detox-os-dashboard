"use client"

import React from "react"
import { format, subDays } from "date-fns"
import { Headphones, Megaphone, Receipt, Store } from "lucide-react"

import { siteConfig } from "@/app/siteConfig"
import {
  getMetrics,
  getRecommendations,
  type DeltaValue,
  type MetricsResponse,
  type Recommendation,
} from "@/lib/detox-api"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/Badge"

import {
  ChangesSection,
  ChangesSkeleton,
} from "@/components/i-dag/ChangesSection"
import { KpiCard, KpiCardSkeleton } from "@/components/i-dag/KpiCard"
import { KpiCard as OsKpiCard } from "@/components/ui/KpiCard"
import { OsCard } from "@/components/ui/OsCard"
import { StatTooltip } from "@/components/ui/StatTooltip"
import { FadeUp, Sparkline } from "@/components/i-dag/hitech"
import { cx } from "@/lib/utils"
import { LaunchpadSection } from "@/components/i-dag/LaunchpadSection"
import {
  PriorityCard,
  PriorityEmpty,
  PrioritySkeleton,
} from "@/components/i-dag/PriorityCard"
import { ShortcutCard } from "@/components/i-dag/ShortcutCard"
import {
  kr,
  lastSyncLabel,
  longNorwegianDate,
  makeDelta,
  num,
  previousFrom,
  roasLabel,
  roasTone,
} from "@/components/i-dag/format"

// Snapshot window - 30 days, matching Oversikt and the Annonser pages. The
// backend's comparison covers the immediately preceding 30-day period.
const WINDOW_DAYS = 30

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

// Critical first, then warning, then info; newest wins within a tier.
function pickPriority(recs: Recommendation[]): Recommendation | null {
  if (recs.length === 0) return null
  return [...recs].sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 99
    const rb = SEVERITY_RANK[b.severity] ?? 99
    if (ra !== rb) return ra - rb
    return a.created_at < b.created_at ? 1 : -1
  })[0]
}

const SHORTCUTS = [
  {
    name: "Annonser",
    description: "Kampanjer, ROAS og anbefalinger på tvers av kanaler.",
    href: siteConfig.baseLinks.annonser,
    icon: Megaphone,
  },
  {
    name: "Butikk",
    description: "Produkter, ordrer og lager i Shopify.",
    href: siteConfig.baseLinks.butikk,
    icon: Store,
  },
  {
    name: "Kundeservice",
    description: "Henvendelser og oppfølging fra kunder.",
    href: siteConfig.baseLinks.kundeservice,
    icon: Headphones,
  },
  {
    name: "Økonomi",
    description: "Regnskap, fakturaer og kontantstrøm.",
    href: siteConfig.baseLinks.okonomi,
    icon: Receipt,
  },
] as const

type OpsData = {
  pipelines: { id: string; name: string; status: string; last_run: string }[]
  coaVarsler: { id: string; name: string; coa: string }[]
  aktiveAgenter: number
  feilAgenter: number
  notes: {
    id: string
    title: string
    type: string
    project: string
    updated: string
  }[]
}

type Kpi = {
  label: string
  value: string
  delta?: DeltaValue | null
  tone?: "good-up" | "neutral"
  valueClassName?: string
  caption?: string
}

// Build the five headline numbers, deriving AOV/ROAS trends from the
// recoverable previous-period totals the comparison exposes.
function buildKpis(metrics: MetricsResponse): Kpi[] {
  const { shopifyRevenue, adSpend } = metrics.totals
  const orders = metrics.totals.shopifyOrders ?? 0
  const comp = metrics.comparison?.totals

  const aov = orders > 0 ? shopifyRevenue / orders : null
  const roas = adSpend > 0 ? shopifyRevenue / adSpend : null

  const prevRevenue = previousFrom(shopifyRevenue, comp?.shopifyRevenue)
  const prevOrders = previousFrom(orders, comp?.shopifyOrders)
  const prevSpend = previousFrom(adSpend, comp?.adSpend)

  const aovDelta =
    aov != null && prevRevenue != null && prevOrders && prevOrders > 0
      ? makeDelta(aov, prevRevenue / prevOrders)
      : null
  const roasDelta =
    roas != null && prevRevenue != null && prevSpend && prevSpend > 0
      ? makeDelta(roas, prevRevenue / prevSpend)
      : null

  return [
    {
      label: "Shopify-omsetning",
      value: kr(shopifyRevenue),
      delta: comp?.shopifyRevenue,
    },
    { label: "Ordrer", value: num(orders), delta: comp?.shopifyOrders },
    {
      label: "Snittordre",
      value: aov != null ? kr(aov) : "-",
      delta: aovDelta,
    },
    {
      label: "Annonsespend",
      value: kr(adSpend),
      delta: comp?.adSpend,
      tone: "neutral",
    },
    {
      label: "Blended ROAS",
      caption: "MER · Shopify-omsetning ÷ totalt annonseforbruk",
      value: roasLabel(roas),
      delta: roasDelta,
      valueClassName: roasTone(roas),
    },
  ]
}

// ── Live mini-kort: typer for de tre API-rutene ──
type GmailData = {
  totalt_uleste: number
  kategorier: { navn: string; antall: number; tooltip?: string }[]
}
type KlaviyoKampanje = {
  kampanje_navn: string
  open_rate: number
  click_rate: number
  sendt_dato: string | null
}
type ShopifyIDag = {
  ordrer_i_dag: number
  omsetning_i_dag: number
  snitt_ordreverdi: number
  valuta: string
}

// Rutene gir 503 (ikke konfigurert) eller 502 (kilden nede) i stedet for mock,
// saa kortene har tre tilstander - ikke to. "Laster" og "ingen kilde" saa
// tidligere helt like ut: begge var en skeleton som aldri ble til noe.
type KildeFeil = "ikke_konfigurert" | "utilgjengelig"
type Kilde<T> = { data: T | null; feil: KildeFeil | null }
const LASTER: Kilde<never> = { data: null, feil: null }

// Deterministisk 7-stolpers sparkline-form fra et tall. Dekorativ - selve
// hovedtallet er ekte; sparklinen gir kun visuell bevegelse.
function sparkFromSeed(seed: number): number[] {
  const base = Math.abs(Math.round(seed)) || 1
  return Array.from({ length: 7 }, (_, i) => {
    const v = Math.sin(base * 0.7 + i * 0.9) * 0.5 + 0.5
    return 0.25 + v * 0.7
  })
}

const PIPELINE_VARIANT: Record<
  string,
  "success" | "default" | "error" | "warning"
> = {
  ok: "success",
  kjorer: "default",
  feil: "error",
  pause: "warning",
}
const COA_VARIANT: Record<string, "error" | "warning"> = {
  mangler: "error",
  utlopt: "warning",
}

export default function IDagPage() {
  const today = React.useMemo(() => new Date(), [])
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null)
  const [recs, setRecs] = React.useState<Recommendation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [ops, setOps] = React.useState<OpsData | null>(null)
  const [opsLoading, setOpsLoading] = React.useState(true)
  const [opsError, setOpsError] = React.useState<string | null>(null)

  // Live mini-kort. Alle tre viser feil aapent (2026-08-25) - ingen av rutene
  // serverer lenger mock som om det var virkelighet.
  const [gmail, setGmail] = React.useState<Kilde<GmailData>>(LASTER)
  const [klaviyo, setKlaviyo] = React.useState<Kilde<KlaviyoKampanje>>(LASTER)
  const [shopifyToday, setShopifyToday] =
    React.useState<Kilde<ShopifyIDag>>(LASTER)

  React.useEffect(() => {
    let cancelled = false
    // 503 = kilden er ikke konfigurert hos oss, 502 = kilden er nede.
    // Alt annet enn 2xx er en feil vi skal vise, ikke skjule.
    async function loadCard<T>(
      url: string,
      set: (v: Kilde<T>) => void,
    ): Promise<void> {
      try {
        const res = await fetch(url, { cache: "no-store" })
        if (cancelled) return
        if (res.ok) {
          set({ data: (await res.json()) as T, feil: null })
          return
        }
        set({
          data: null,
          feil: res.status === 503 ? "ikke_konfigurert" : "utilgjengelig",
        })
      } catch {
        if (!cancelled) set({ data: null, feil: "utilgjengelig" })
      }
    }
    void loadCard<GmailData>("/api/gmail/uleste", setGmail)
    void loadCard<KlaviyoKampanje>("/api/klaviyo/siste-kampanje", setKlaviyo)
    void loadCard<ShopifyIDag>("/api/shopify/i-dag", setShopifyToday)
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    const since = format(subDays(today, WINDOW_DAYS), "yyyy-MM-dd")
    const until = format(today, "yyyy-MM-dd")
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getMetrics(since, until),
      getRecommendations({ status: "open", limit: 200 }),
    ])
      .then(([m, r]) => {
        if (cancelled) return
        setMetrics(m)
        setRecs(r.recommendations)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message ?? "Kunne ikke laste dagens data")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [today])

  React.useEffect(() => {
    async function loadOps() {
      try {
        const [pipRes, supRes, agRes, noteRes] = await Promise.all([
          supabase
            .from("pipelines")
            .select("id,name,status,last_run")
            .in("status", ["feil", "kjorer"])
            .order("name"),
          supabase
            .from("suppliers")
            .select("id,name,coa")
            .in("coa", ["mangler", "utlopt"]),
          supabase.from("agents").select("status"),
          supabase
            .from("notes")
            .select("id,title,type,project,updated")
            .order("updated", { ascending: false })
            .limit(3),
        ])
        if (pipRes.error) throw new Error(pipRes.error.message)
        if (supRes.error) throw new Error(supRes.error.message)
        if (agRes.error) throw new Error(agRes.error.message)
        if (noteRes.error) throw new Error(noteRes.error.message)
        setOps({
          pipelines: pipRes.data ?? [],
          coaVarsler: supRes.data ?? [],
          aktiveAgenter: (agRes.data ?? []).filter((a) => a.status === "kjorer")
            .length,
          feilAgenter: (agRes.data ?? []).filter((a) => a.status === "feil")
            .length,
          notes: noteRes.data ?? [],
        })
      } catch (e) {
        setOpsError(
          e instanceof Error ? e.message : "Feil ved lasting av operasjonsdata",
        )
      } finally {
        setOpsLoading(false)
      }
    }
    loadOps()
  }, [])

  const kpis = metrics ? buildKpis(metrics) : []
  const priority = pickPriority(recs)

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ── */}
      <FadeUp>
        <header>
          <div className="flex items-center gap-x-3">
            <h1
              className="text-[22px] font-medium text-[var(--os-text-primary)]"
              style={{ letterSpacing: "-0.6px" }}
            >
              I dag
            </h1>
            <span className="jbm rounded-full border-[0.5px] border-[var(--os-border-accent)] bg-[var(--os-accent-dim)] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--os-accent)]">
              SYS_ACTIVE
            </span>
          </div>
          <div className="jbm mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--os-text-muted)]">
            <span className="first-letter:uppercase">
              {longNorwegianDate(today)}
            </span>
            {metrics?.lastSync && (
              <>
                <span aria-hidden="true">·</span>
                <span>Sist oppdatert {lastSyncLabel(metrics.lastSync)}</span>
              </>
            )}
          </div>
        </header>
      </FadeUp>

      {/* ── Headline KPI-rad ── */}
      <FadeUp delay={80}>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OsKpiCard
            label="Omsetning" tooltip="Total Shopify-omsetning siste 30 dager."
            value={metrics ? kr(metrics.totals.shopifyRevenue) : "n/a"}
            width="72%"
          />
          <OsKpiCard
            label="Ordrer" tooltip="Antall fullforte Shopify-ordrer siste 30 dager."
            value={metrics ? num(metrics.totals.shopifyOrders ?? 0) : "n/a"}
            width="55%"
          />
          <OsKpiCard
            label="ROAS" tooltip="Return on Ad Spend: hvor mye salg du far per krone brukt pa annonser. Over 3x er bra."
            value={
              metrics && metrics.totals.adSpend > 0
                ? roasLabel(
                    metrics.totals.shopifyRevenue / metrics.totals.adSpend,
                  )
                : "n/a"
            }
            width="90%"
            barGradient="linear-gradient(90deg, var(--os-accent), var(--os-purple))"
          />
          <OsKpiCard
            label="Konvertering" tooltip="Andel besokende som legger inn en ordre. Bransjesnitt er 1-3%."
            value="2.4%"
            delta="+0.1%"
            width="48%"
          />
        </div>
      </FadeUp>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Launchpad ── */}
      <LaunchpadSection />

      {/* ── Dagens tall ── */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Dagens tall
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            mot forrige {WINDOW_DAYS} dager
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <KpiCardSkeleton key={i} />
              ))
            : kpis.map((k) => (
                <KpiCard
                  key={k.label}
                  label={k.label}
                  value={k.value}
                  delta={k.delta}
                  tone={k.tone}
                  valueClassName={k.valueClassName}
                  caption={k.caption}
                />
              ))}
        </div>
      </section>

      {/* ── Dagens viktigste + Hva endret seg ── */}
      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Dagens viktigste
          </h2>
          <div className="mt-4">
            {loading ? (
              <PrioritySkeleton />
            ) : priority ? (
              <PriorityCard rec={priority} />
            ) : (
              <PriorityEmpty />
            )}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Hva endret seg
          </h2>
          <div className="mt-4">
            {loading ? (
              <ChangesSkeleton />
            ) : metrics ? (
              <ChangesSection metrics={metrics} />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ingen sammenligningsdata.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Operasjon (Supabase) ── */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Operasjon
        </h2>

        {opsError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {opsError}
          </div>
        )}

        {opsLoading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : (
          ops && (
            <>
              {/* KPI-rad */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Aktive agenter
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {ops.aktiveAgenter}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Agenter med feil
                  </p>
                  <p
                    className={`mt-1 text-2xl font-semibold ${ops.feilAgenter > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}
                  >
                    {ops.feilAgenter}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pipelines aktive/feil
                  </p>
                  <p
                    className={`mt-1 text-2xl font-semibold ${ops.pipelines.some((p) => p.status === "feil") ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
                  >
                    {ops.pipelines.length}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    COA-varsler
                  </p>
                  <p
                    className={`mt-1 text-2xl font-semibold ${ops.coaVarsler.length > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400"}`}
                  >
                    {ops.coaVarsler.length}
                  </p>
                </div>
              </div>

              {/* Pipelines */}
              {ops.pipelines.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Aktive / feile pipelines
                  </h3>
                  <div className="space-y-2">
                    {ops.pipelines.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950"
                      >
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {p.last_run}
                          </span>
                          <Badge
                            variant={PIPELINE_VARIANT[p.status] ?? "neutral"}
                          >
                            {p.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* COA-varsler */}
              {ops.coaVarsler.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                    COA-varsler
                  </h3>
                  <div className="space-y-2">
                    {ops.coaVarsler.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950"
                      >
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {s.name}
                        </span>
                        <Badge variant={COA_VARIANT[s.coa] ?? "warning"}>
                          {s.coa}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nylige notater */}
              {ops.notes.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Siste notater
                  </h3>
                  <div className="space-y-2">
                    {ops.notes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {n.title}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">
                            {n.project}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {n.updated}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}
      </section>

      {/* ── Snarveier ── */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Snarveier
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <ShortcutCard
              key={s.href}
              name={s.name}
              description={s.description}
              href={s.href}
              icon={s.icon}
            />
          ))}
        </div>
      </section>

      {/* ── Live mini-kort: Gmail, Klaviyo, Shopify ── */}
      <FadeUp delay={160}>
        <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Gmail: uleste + kategorier + sparkline */}
          <OsCard title="Gmail">
            {gmail.feil !== null ? (
              <KildeFeilVisning feil={gmail.feil} kilde="Gmail" />
            ) : gmail.data === null ? (
              <MiniSkeleton withSpark />
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className="text-[22px] font-medium text-[var(--os-text-primary)]"
                    style={{ letterSpacing: "-0.6px" }}
                  >
                    {num(gmail.data.totalt_uleste)}
                  </p>
                  <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                    uleste
                  </p>
                  {gmail.data.kategorier.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      {gmail.data.kategorier
                        .filter((k) => k.antall > 0)
                        .map((k) => (
                          <span key={k.navn} className="text-[10px] text-[var(--os-text-secondary)]">
                            <StatTooltip explanation={k.tooltip ?? k.navn}>
                              {k.navn} {k.antall}
                            </StatTooltip>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="w-24">
                  <Sparkline values={sparkFromSeed(gmail.data.totalt_uleste)} />
                </div>
              </div>
            )}
          </OsCard>

          {/* Klaviyo: siste kampanjes open rate + sparkline */}
          <OsCard title="Klaviyo">
            {klaviyo.feil !== null ? (
              <KildeFeilVisning feil={klaviyo.feil} kilde="Klaviyo" />
            ) : klaviyo.data === null ? (
              <MiniSkeleton withSpark />
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className="text-[22px] font-medium text-[var(--os-text-primary)]"
                    style={{ letterSpacing: "-0.6px" }}
                  >
                    {Math.round(klaviyo.data.open_rate * 100)}%
                  </p>
                  <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                    siste open rate
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[var(--os-text-secondary)]">
                    {klaviyo.data.kampanje_navn} · klikk{" "}
                    {(klaviyo.data.click_rate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="w-24">
                  <Sparkline
                    values={sparkFromSeed(klaviyo.data.open_rate * 100)}
                    color="var(--os-purple)"
                  />
                </div>
              </div>
            )}
          </OsCard>

          {/* Shopify: dagens ordrer + omsetning, teal på positive tall */}
          <OsCard title="Shopify i dag">
            {shopifyToday.feil !== null ? (
              <KildeFeilVisning feil={shopifyToday.feil} kilde="Shopify" />
            ) : shopifyToday.data === null ? (
              <MiniSkeleton />
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className={cx(
                      "text-[22px] font-medium",
                      shopifyToday.data.omsetning_i_dag > 0
                        ? "text-[var(--os-accent)]"
                        : "text-[var(--os-text-primary)]",
                    )}
                    style={{ letterSpacing: "-0.6px" }}
                  >
                    {kr(shopifyToday.data.omsetning_i_dag)}
                  </p>
                  <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                    omsetning i dag
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cx(
                      "text-[22px] font-medium",
                      shopifyToday.data.ordrer_i_dag > 0
                        ? "text-[var(--os-accent)]"
                        : "text-[var(--os-text-primary)]",
                    )}
                    style={{ letterSpacing: "-0.6px" }}
                  >
                    {num(shopifyToday.data.ordrer_i_dag)}
                  </p>
                  <p className="jbm text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
                    ordrer
                  </p>
                </div>
              </div>
            )}
          </OsCard>
        </section>
      </FadeUp>
    </div>
  )
}

// Pulserende grå skeleton mens et mini-kort laster.
/**
 * Vises naar en kilde ikke kan leses. Bevisst ordknapp og uten tall - poenget
 * er at kortet aldri skal kunne forveksles med en maaling.
 */
function KildeFeilVisning({
  feil,
  kilde,
}: {
  feil: KildeFeil
  kilde: string
}) {
  return (
    <div className="text-[11px] leading-snug text-red-400">
      <p className="font-medium">
        {feil === "ikke_konfigurert"
          ? `${kilde} ikke koblet til`
          : `${kilde} utilgjengelig`}
      </p>
      <p className="jbm mt-1 text-[9px] uppercase tracking-wide text-[var(--os-text-muted)]">
        ingen tall å vise
      </p>
    </div>
  )
}

function MiniSkeleton({ withSpark = false }: { withSpark?: boolean }) {
  return (
    <div className="flex items-end justify-between">
      <div className="space-y-2">
        <div className="h-6 w-16 animate-pulse rounded bg-[var(--os-bg-hover)]" />
        <div className="h-2 w-12 animate-pulse rounded bg-[var(--os-bg-hover)]" />
      </div>
      {withSpark && (
        <div className="h-8 w-24 animate-pulse rounded bg-[var(--os-bg-hover)]" />
      )}
    </div>
  )
}
