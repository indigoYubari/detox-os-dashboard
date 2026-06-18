"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { siteConfig } from "@/app/siteConfig"
import { getProposals } from "@/lib/detox-api"
import { supabase } from "@/lib/supabase"
import { cx } from "@/lib/utils"

// Antall dager fram i tid som regnes som "neste 7 dager" for møter.
const MEETING_WINDOW_DAYS = 7

type ConnectionState = "loading" | "online" | "offline"

type ClinicalCounts = {
  awaitingProtocol: number
  meetingsNext7Days: number
}

// Teller klienter med status 'protokoll' og møter innenfor de neste 7 dagene.
function countClinical(
  rows: { status: string | null; meeting_date: string | null }[],
): ClinicalCounts {
  const now = new Date()
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + MEETING_WINDOW_DAYS)

  let awaitingProtocol = 0
  let meetingsNext7Days = 0

  for (const row of rows) {
    if (row.status === "protokoll") awaitingProtocol += 1

    if (row.meeting_date) {
      const meeting = new Date(row.meeting_date)
      if (
        !Number.isNaN(meeting.getTime()) &&
        meeting >= now &&
        meeting <= horizon
      ) {
        meetingsNext7Days += 1
      }
    }
  }

  return { awaitingProtocol, meetingsNext7Days }
}

export default function StatusPage() {
  const [supabaseState, setSupabaseState] = useState<ConnectionState>("loading")
  const [clinical, setClinical] = useState<ClinicalCounts | null>(null)
  const [pendingProposals, setPendingProposals] = useState<number | null>(null)
  const [proposalsFailed, setProposalsFailed] = useState(false)
  const [proposalsLoading, setProposalsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadClinical() {
      const { data, error } = await supabase
        .from("clients")
        .select("status, meeting_date")

      if (cancelled) return
      if (error) {
        setSupabaseState("offline")
        setClinical(null)
        return
      }
      setSupabaseState("online")
      setClinical(countClinical(data ?? []))
    }

    async function loadProposals() {
      try {
        const res = await getProposals({ status: "pending" })
        if (cancelled) return
        setPendingProposals(res.counts.total)
        setProposalsFailed(false)
      } catch {
        if (cancelled) return
        setProposalsFailed(true)
        setPendingProposals(null)
      } finally {
        if (!cancelled) setProposalsLoading(false)
      }
    }

    void loadClinical()
    void loadProposals()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-6">
      <div>
        <h1 className="jbm text-lg font-semibold text-[var(--os-text-primary)] sm:text-xl">
          Status
        </h1>
        <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
          Helsesjekk av infrastruktur, klinikk og annonser
        </p>
      </div>

      <Section title="Infrastruktur">
        <StatusCard
          title="Supabase"
          badge={
            supabaseState === "loading" ? (
              <Badge tone="neutral">Sjekker</Badge>
            ) : supabaseState === "online" ? (
              <Badge tone="online">Tilkoblet</Badge>
            ) : (
              <Badge tone="offline">Frakoblet</Badge>
            )
          }
        />
        <StatusCard
          title="Obsidian-sync"
          badge={<Badge tone="online">Aktiv</Badge>}
        />
      </Section>

      <Section title="Klinisk">
        <CountCard
          title="Venter på protokoll"
          value={clinical?.awaitingProtocol ?? null}
          loading={supabaseState === "loading"}
          failed={supabaseState === "offline"}
          href={siteConfig.baseLinks.klinisk}
        />
        <CountCard
          title="Møter neste 7 dager"
          value={clinical?.meetingsNext7Days ?? null}
          loading={supabaseState === "loading"}
          failed={supabaseState === "offline"}
          href={siteConfig.baseLinks.klinisk}
        />
      </Section>

      <Section title="Annonser">
        <CountCard
          title="Ventende forslag"
          value={pendingProposals}
          loading={proposalsLoading}
          failed={proposalsFailed}
          href={siteConfig.baseLinks.annonserForslag}
        />
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-x-1.5 px-1">
        <span
          className="size-1.5 rounded-full bg-[var(--os-accent)]"
          style={{ boxShadow: "0 0 6px var(--os-accent-glow)" }}
          aria-hidden="true"
        />
        <h2 className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          {title}
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[7.5rem] flex-col justify-between rounded-[var(--os-radius-lg)] border-[0.5px] border-[var(--os-border)] bg-[var(--os-bg-card)] p-4 transition-colors duration-150 hover:border-[var(--os-border-accent)]">
      {children}
    </div>
  )
}

function StatusCard({
  title,
  badge,
}: {
  title: string
  badge: React.ReactNode
}) {
  return (
    <CardShell>
      <h3 className="text-sm font-semibold text-[var(--os-text-primary)]">
        {title}
      </h3>
      <div className="mt-3">{badge}</div>
    </CardShell>
  )
}

function CountCard({
  title,
  value,
  loading,
  failed,
  href,
}: {
  title: string
  value: number | null
  loading: boolean
  failed: boolean
  href: string
}) {
  return (
    <CardShell>
      <h3 className="text-sm font-semibold text-[var(--os-text-primary)]">
        {title}
      </h3>
      <div className="mt-2 flex items-end justify-between gap-3">
        {loading ? (
          <div className="h-9 w-12 animate-pulse rounded bg-white/5" />
        ) : failed ? (
          <span className="text-sm text-[var(--os-text-muted)]">
            Kunne ikke hente
          </span>
        ) : (
          <span
            className={cx(
              "jbm text-3xl font-semibold tabular-nums leading-none",
              value && value > 0
                ? "text-[#00d4aa]"
                : "text-[var(--os-text-muted)]",
            )}
          >
            {value ?? 0}
          </span>
        )}
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs text-[var(--os-text-muted)] transition-colors hover:text-[var(--os-accent)]"
        >
          Se mer
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </CardShell>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: "online" | "offline" | "neutral"
  children: React.ReactNode
}) {
  const styles: Record<typeof tone, string> = {
    online:
      "border-[var(--os-accent)]/30 bg-[var(--os-accent-dim)] text-[var(--os-accent)]",
    offline:
      "border-[var(--os-danger)]/30 bg-[var(--os-danger)]/10 text-[var(--os-danger)]",
    neutral:
      "border-[var(--os-border)] bg-[var(--os-bg-hover)] text-[var(--os-text-muted)]",
  }
  return (
    <span
      className={cx(
        "jbm inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        styles[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}
