"use client"

import React from "react"
import Link from "next/link"
import { subDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import {
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiArrowRightDownLine,
  RiCheckLine,
  RiCloseLine,
  RiPulseLine,
  RiHistoryLine,
} from "@remixicon/react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Filterbar } from "@/components/ui/overview/DashboardFilterbar"
import {
  getMetrics,
  getRecommendations,
  type ChannelMetrics,
  type DeltaValue,
  type MetricsResponse,
  type Recommendation,
  type RecommendationsResponse,
} from "@/lib/detox-api"
import {
  AD_CHANNELS,
  CHANNEL_LABELS,
  HEALTH_DOT,
  HEALTH_LABEL,
  HEALTH_RING,
  HEALTH_TEXT,
  SEVERITY,
  TYPE_LABEL,
  deltaClass,
  healthLevel,
  kr,
  labelFor,
  metricPairs,
  pctLabel,
  roasLabel,
  significantChanges,
  validatedRoas,
} from "@/lib/ad-format"
import { cx } from "@/lib/utils"

const ANBEFALINGER_HREF = "/annonser/anbefalinger"
const FORSLAG_HREF = "/annonser/forslag"

export default function AnnonserBriefing() {
  const today = new Date()
  const [selectedDates, setSelectedDates] = React.useState<
    DateRange | undefined
  >({ from: subDays(today, 30), to: today })

  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null)
  const [recs, setRecs] = React.useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [toast, setToast] = React.useState<string | null>(null)

  React.useEffect(() => {
    const since = selectedDates?.from
      ? format(selectedDates.from, "yyyy-MM-dd")
      : undefined
    const until = selectedDates?.to
      ? format(selectedDates.to, "yyyy-MM-dd")
      : undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getMetrics(since, until),
      getRecommendations({ status: "open", limit: 500 }),
    ])
      .then(([m, r]) => {
        if (cancelled) return
        setMetrics(m)
        setRecs(r)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message ?? "Feil ved lasting av data")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDates])

  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const notifySoon = React.useCallback(() => setToast("Kommer snart"), [])

  // ── derived: channel health (paid/owned media only) ──────────
  const channelHealth = React.useMemo(() => {
    const byChannel = new Map<string, ChannelMetrics>()
    for (const c of metrics?.channels ?? []) byChannel.set(c.channel, c)
    return AD_CHANNELS.map((id) => {
      const c = byChannel.get(id)
      const spend = c?.spend ?? 0
      const revenue = c?.revenue ?? 0
      const roas = c ? validatedRoas(spend, revenue) : null
      return {
        id,
        label: labelFor(CHANNEL_LABELS, id),
        spend,
        roas,
        present: Boolean(c),
        roasDelta: metrics?.comparison?.channels?.[id]?.roas,
      }
    })
  }, [metrics])

  // ── derived: action queue (critical → warning, top 5) ────────
  const actionItems = React.useMemo(() => {
    const open = recs?.recommendations ?? []
    return [
      ...open.filter((r) => r.severity === "critical"),
      ...open.filter((r) => r.severity === "warning"),
    ].slice(0, 5)
  }, [recs])

  const openCount = recs?.counts.total ?? 0

  const changes = React.useMemo(
    () => significantChanges(metrics?.comparison),
    [metrics],
  )

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl dark:text-gray-50">
            Annonser
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Daglig briefing — hva trenger oppmerksomheten din
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <span
              className={cx(
                "inline-block h-1.5 w-1.5 rounded-full",
                loading ? "bg-gray-300" : "bg-emerald-500",
              )}
            />
            {loading ? (
              "Oppdaterer…"
            ) : metrics?.lastSync ? (
              <>
                Sist oppdatert{" "}
                {new Date(metrics.lastSync).toLocaleString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            ) : (
              "Ingen synkroniseringstid"
            )}
          </p>
        </div>
        <Filterbar
          maxDate={today}
          minDate={new Date(2024, 0, 1)}
          selectedDates={selectedDates}
          onDatesChange={(dates) => setSelectedDates(dates)}
        />
      </header>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Section 1 — Helse per kanal ─────────────────────── */}
      <section className="mt-8">
        <SectionHeading icon={RiPulseLine} title="Helse per kanal" />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Plattform-rapporterte tall (retningsgivende) — pålitelig
          Shopify-validert ROAS per kanal er ikke tilgjengelig ennå
          (attribusjonsarbeid gjenstår).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loading
            ? AD_CHANNELS.map((id) => <ChannelHealthSkeleton key={id} />)
            : channelHealth.map((ch) => (
                <ChannelHealthCard key={ch.id} {...ch} />
              ))}
        </div>
      </section>

      {/* ── Section 2 — Krever handling (the heart) ─────────── */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            icon={RiArrowRightUpLine}
            title="Krever handling"
            count={loading ? undefined : actionItems.length}
            subtitle="Åpne anbefalinger, mest kritiske først"
          />
          <Link
            href={ANBEFALINGER_HREF}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Se alle anbefalinger
            {openCount > 0 && (
              <span className="tabular-nums opacity-60">({openCount})</span>
            )}
            <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={FORSLAG_HREF}
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Handlingsforslag
            <RiArrowRightLine className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <>
              <ActionSkeleton />
              <ActionSkeleton />
              <ActionSkeleton />
            </>
          ) : actionItems.length === 0 ? (
            <EmptyActionState />
          ) : (
            actionItems.map((rec) => (
              <ActionCard
                key={rec.id}
                rec={rec}
                onApprove={notifySoon}
                onDismiss={notifySoon}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Section 3 — Siden sist ──────────────────────────── */}
      <section className="mt-12">
        <SectionHeading
          icon={RiHistoryLine}
          title="Siden sist"
          subtitle="Største endringer vs forrige periode"
        />
        <div className="mt-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <ChangesSkeleton />
          ) : changes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Ingen sammenligningsdata for perioden
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {changes.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cx(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        c.good
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                      )}
                    >
                      {c.good ? (
                        <RiArrowRightUpLine className="size-4" />
                      ) : (
                        <RiArrowRightDownLine className="size-4" />
                      )}
                    </span>
                    <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                      {c.sentence}
                    </span>
                  </div>
                  <span
                    className={cx(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      c.good
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400",
                    )}
                  >
                    {c.pctLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Section 4 — Siste handlinger (placeholder) ──────── */}
      <section className="mt-12">
        <SectionHeading icon={RiHistoryLine} title="Siste handlinger" />
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-5 py-8 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ingen handlinger utført ennå — agent-handlinger vises her når
            godkjenning er aktivert.
          </p>
        </div>
      </section>

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-md bg-gray-900 px-3.5 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-50 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Section heading ─────────────────────────────────────────────
function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  count?: number
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="size-[18px] text-gray-400 dark:text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {title}
        </h2>
        {count != null && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {count}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 pl-[26px] text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── Section 1: channel health card ──────────────────────────────
function ChannelHealthCard({
  label,
  spend,
  roas,
  present,
  roasDelta,
}: {
  label: string
  spend: number
  roas: number | null
  present: boolean
  roasDelta?: DeltaValue
}) {
  const level = healthLevel(roas)
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      {/* health accent strip */}
      <span
        className={cx(
          "absolute inset-x-0 top-0 h-0.5 opacity-80",
          HEALTH_DOT[level],
        )}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "size-2.5 shrink-0 rounded-full ring-4",
              HEALTH_DOT[level],
              HEALTH_RING[level],
            )}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
        </div>
        <span className={cx("text-xs font-medium", HEALTH_TEXT[level])}>
          {HEALTH_LABEL[level]}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Plattform-ROAS
          </p>
          <p
            className={cx(
              "mt-0.5 text-2xl font-semibold tabular-nums",
              present
                ? "text-gray-900 dark:text-gray-50"
                : "text-gray-300 dark:text-gray-600",
            )}
          >
            {roasLabel(roas)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Forbruk
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
            {kr(spend)}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-2.5 dark:border-gray-800">
        {roasDelta ? (
          <p
            className={cx(
              "flex items-center gap-1 text-xs tabular-nums",
              deltaClass(roasDelta.dir),
            )}
          >
            {roasDelta.dir === "up" ? (
              <RiArrowRightUpLine className="size-3.5" />
            ) : roasDelta.dir === "down" ? (
              <RiArrowRightDownLine className="size-3.5" />
            ) : (
              <RiArrowRightLine className="size-3.5" />
            )}
            {pctLabel(roasDelta.pct, roasDelta.dir).replace(/^[↑↓→]\s?/, "")}
            <span className="text-gray-400 dark:text-gray-500">
              vs forrige periode
            </span>
          </p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Ingen sammenligning
          </p>
        )}
      </div>
    </div>
  )
}

function ChannelHealthSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-4">
        <div className="flex justify-between">
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="flex justify-between">
          <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-14 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  )
}

// ── Section 2: action card (the affordance is the point) ────────
function ActionCard({
  rec,
  onApprove,
  onDismiss,
}: {
  rec: Recommendation
  onApprove: () => void
  onDismiss: () => void
}) {
  const sev = SEVERITY[rec.severity] ?? {
    label: rec.severity,
    variant: "default" as const,
  }
  const pairs = metricPairs(rec)
  const accent =
    rec.severity === "critical"
      ? "before:bg-red-500"
      : rec.severity === "warning"
        ? "before:bg-amber-500"
        : "before:bg-indigo-500"

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 pl-6 transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        accent,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={sev.variant}>{sev.label}</Badge>
        <Badge variant="neutral">{labelFor(CHANNEL_LABELS, rec.channel)}</Badge>
        <Badge variant="neutral">{labelFor(TYPE_LABEL, rec.type)}</Badge>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-gray-900 dark:text-gray-50">
        {rec.title}
      </h3>

      {rec.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
          {rec.description}
        </p>
      )}

      {pairs.length > 0 && (
        <p className="mt-3 text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {pairs.join("  ·  ")}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2.5">
        <Button
          variant="primary"
          onClick={onApprove}
          title="Kommer snart"
          className="gap-1.5"
        >
          <RiCheckLine className="size-4" />
          Godkjenn
        </Button>
        <Button
          variant="secondary"
          onClick={onDismiss}
          title="Kommer snart"
          className="gap-1.5"
        >
          <RiCloseLine className="size-4" />
          Avvis
        </Button>
      </div>
    </div>
  )
}

function ActionSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 pl-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="animate-pulse space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex gap-2.5 pt-1">
          <div className="h-9 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-24 rounded-md bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  )
}

function EmptyActionState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-10 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
        <RiCheckLine className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
        Ingen kritiske anbefalinger akkurat nå
      </p>
      <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-400/70">
        Alt ser bra ut. Vi gir beskjed når noe trenger oppmerksomhet.
      </p>
    </div>
  )
}

function ChangesSkeleton() {
  return (
    <ul className="animate-pulse divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-4 px-5 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
        </li>
      ))}
    </ul>
  )
}
