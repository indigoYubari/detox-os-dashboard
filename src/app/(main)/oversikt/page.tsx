"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { KpiCard } from "@/components/ui/KpiCard"
import { OsCard } from "@/components/ui/OsCard"
import { cx } from "@/lib/utils"
import { kr, num } from "@/components/i-dag/format"

type OversiktData = {
  generatedAt: string
  shopify: {
    revenueToday: number
    orders: number
    aov: number
    currency: string
  } | null
  klaviyo: {
    emailRevenue7d: number
    listSize: number | null
    listName: string | null
  } | null
  errors?: { shopify?: string; klaviyo?: string }
}

const timeFmt = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Oslo",
})

export default function OversiktPage() {
  const [data, setData] = useState<OversiktData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/oversikt", { cache: "no-store" })
      if (!res.ok) throw new Error(`Server svarte ${res.status}`)
      const json = (await res.json()) as OversiktData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="jbm text-lg font-semibold text-[var(--os-text-primary)] sm:text-xl">
            Live oversikt
          </h1>
          <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
            Sanntidsdata fra Shopify og Klaviyo
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={cx(
            "jbm inline-flex items-center gap-x-1.5 rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-3 py-1.5 text-xs text-[var(--os-text-secondary)] outline-none transition-colors",
            "focus-visible:ring-[var(--os-accent)]/40 focus-visible:ring-2",
            loading
              ? "cursor-not-allowed opacity-50"
              : "hover:border-[var(--os-border-accent)] hover:text-[var(--os-text-primary)]",
          )}
        >
          <RefreshCw className={cx("size-3.5", loading && "animate-spin")} />
          Oppdater
        </button>
      </div>

      {error && (
        <div className="border-[var(--os-danger)]/30 bg-[var(--os-danger)]/10 mt-5 rounded-[var(--os-radius-md)] border p-4 text-sm text-[var(--os-danger)]">
          Kunne ikke laste data: {error}
        </div>
      )}

      {/* Shopify */}
      <div className="mt-6">
        <OsCard title="Shopify i dag">
          {data?.errors?.shopify ? (
            <SourceError message={data.errors.shopify} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                label="Omsetning i dag"
                value={loading ? "…" : kr(data?.shopify?.revenueToday ?? 0)}
                width="80%"
              />
              <KpiCard
                label="Ordrer i dag"
                value={loading ? "…" : num(data?.shopify?.orders ?? 0)}
                width="55%"
              />
              <KpiCard
                label="Snittordre"
                value={loading ? "…" : kr(data?.shopify?.aov ?? 0)}
                width="65%"
              />
            </div>
          )}
        </OsCard>
      </div>

      {/* Klaviyo */}
      <div className="mt-5">
        <OsCard title="Klaviyo siste 7 dager">
          {data?.errors?.klaviyo ? (
            <SourceError message={data.errors.klaviyo} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KpiCard
                label="E-post omsetning (7d)"
                value={loading ? "…" : kr(data?.klaviyo?.emailRevenue7d ?? 0)}
                width="70%"
              />
              <KpiCard
                label={
                  data?.klaviyo?.listName
                    ? `Listestørrelse: ${data.klaviyo.listName}`
                    : "Listestørrelse"
                }
                value={
                  loading
                    ? "…"
                    : data?.klaviyo?.listSize != null
                      ? num(data.klaviyo.listSize)
                      : "ikke tilgjengelig"
                }
                width="60%"
              />
            </div>
          )}
        </OsCard>
      </div>

      <p className="jbm mt-4 text-[10px] text-[var(--os-text-muted)]">
        {data?.generatedAt
          ? `Sist oppdatert ${timeFmt.format(new Date(data.generatedAt))}`
          : " "}
      </p>
    </div>
  )
}

function SourceError({ message }: { message: string }) {
  return (
    <p className="text-sm text-[var(--os-danger)]">
      Kilde utilgjengelig: {message}
    </p>
  )
}
