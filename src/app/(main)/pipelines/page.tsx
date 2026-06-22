"use client"

import { useEffect, useMemo, useState } from "react"

import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { supabase } from "@/lib/supabase"
import { cx } from "@/lib/utils"

type PipelineStatus =
  | "ikke_startet"
  | "under_bearbeiding"
  | "til_gjennomgang"
  | "godkjent"
  | "publisert"

type Product = {
  id: string
  handle: string | null
  title: string | null
  vendor: string | null
  status: PipelineStatus | string
  notes: string | null
  updated_at: string | null
  created_at: string | null
}

type StatusMeta = {
  value: PipelineStatus
  label: string
  text: string
  dot: string
  bg: string
}

const STATUSES: StatusMeta[] = [
  {
    value: "ikke_startet",
    label: "Ikke startet",
    text: "#94a3b8",
    dot: "#64748b",
    bg: "rgba(100, 116, 139, 0.12)",
  },
  {
    value: "under_bearbeiding",
    label: "Under bearbeiding",
    text: "#fbbf24",
    dot: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
  },
  {
    value: "til_gjennomgang",
    label: "Til gjennomgang",
    text: "#c084fc",
    dot: "#a855f7",
    bg: "rgba(168, 85, 247, 0.12)",
  },
  {
    value: "godkjent",
    label: "Godkjent",
    text: "#00d4aa",
    dot: "#00d4aa",
    bg: "rgba(0, 212, 170, 0.12)",
  },
  {
    value: "publisert",
    label: "Publisert",
    text: "#34d399",
    dot: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
  },
]

const STATUS_BY_VALUE: Record<string, StatusMeta> = Object.fromEntries(
  STATUSES.map((s) => [s.value, s]),
)

const PAGE_SIZE = 50

function statusMeta(value: string): StatusMeta {
  return STATUS_BY_VALUE[value] ?? STATUSES[0]
}

export default function PipelinesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PipelineStatus | "alle">("alle")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: loadError } = await supabase
        .from("product_pipeline")
        .select(
          "id, handle, title, vendor, status, notes, updated_at, created_at",
        )
        .order("title", { ascending: true })

      if (cancelled) return
      if (loadError) setError(loadError.message)
      else setProducts((data ?? []) as Product[])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Nullstill til første side når filter eller søk endres.
  useEffect(() => {
    setPage(0)
  }, [filter, search])

  const counts = useMemo(() => {
    const base: Record<PipelineStatus, number> = {
      ikke_startet: 0,
      under_bearbeiding: 0,
      til_gjennomgang: 0,
      godkjent: 0,
      publisert: 0,
    }
    for (const p of products) {
      if (p.status in base) base[p.status as PipelineStatus] += 1
    }
    return base
  }, [products])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((p) => {
      if (filter !== "alle" && p.status !== filter) return false
      if (query && !(p.title ?? "").toLowerCase().includes(query)) return false
      return true
    })
  }, [products, filter, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  )

  async function changeStatus(product: Product, next: PipelineStatus) {
    if (product.status === next) return
    setSavingId(product.id)
    setRowError(null)
    const updatedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("product_pipeline")
      .update({ status: next, updated_at: updatedAt })
      .eq("id", product.id)
    setSavingId(null)
    if (updateError) {
      setRowError(updateError.message)
      return
    }
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, status: next, updated_at: updatedAt } : p,
      ),
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="jbm text-lg font-semibold text-[var(--os-text-primary)] sm:text-xl">
          Produktpipeline
        </h1>
        <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
          Omskriving av produkttekster for detox.no
        </p>
      </div>

      {error && (
        <div className="border-[var(--os-danger)]/30 bg-[var(--os-danger)]/10 mb-6 rounded-[var(--os-radius-md)] border p-4 text-sm text-[var(--os-danger)]">
          Kunne ikke laste produkter: {error}
        </div>
      )}

      {/* Statistikk-kort */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((s) => {
          const active = filter === s.value
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilter(active ? "alle" : s.value)}
              className={cx(
                "rounded-[var(--os-radius-lg)] border-[0.5px] bg-[var(--os-bg-card)] p-4 text-left outline-none transition-colors duration-150",
                "focus-visible:ring-[var(--os-accent)]/40 focus-visible:ring-2",
                active
                  ? "border-[var(--os-border-accent)]"
                  : "border-[var(--os-border)] hover:border-[var(--os-border-accent)]",
              )}
            >
              <div className="flex items-center gap-x-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: s.dot }}
                  aria-hidden="true"
                />
                <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
                  {s.label}
                </span>
              </div>
              <p className="jbm mt-2 text-2xl font-semibold tabular-nums text-[var(--os-text-primary)]">
                {loading ? "—" : counts[s.value]}
              </p>
            </button>
          )
        })}
      </div>

      {/* Søk */}
      <div className="mt-6">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk på produktnavn…"
          className="max-w-sm"
        />
      </div>

      {/* Filter-piller */}
      <div className="mt-4 flex flex-wrap gap-2">
        <FilterPill
          label="Alle"
          active={filter === "alle"}
          onClick={() => setFilter("alle")}
        />
        {STATUSES.map((s) => (
          <FilterPill
            key={s.value}
            label={s.label}
            active={filter === s.value}
            onClick={() => setFilter(s.value)}
          />
        ))}
      </div>

      {rowError && (
        <p className="mt-4 text-sm text-[var(--os-danger)]">
          Kunne ikke oppdatere status: {rowError}
        </p>
      )}

      {/* Liste */}
      <div className="mt-4 overflow-hidden rounded-[var(--os-radius-lg)] border-[0.5px] border-[var(--os-border)] bg-[var(--os-bg-card)]">
        {loading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--os-text-muted)]">
            Ingen produkter matcher filteret
          </div>
        ) : (
          <ul className="divide-y divide-[var(--os-border)]">
            {pageItems.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                saving={savingId === p.id}
                onChangeStatus={changeStatus}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Paginering */}
      {!loading && filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--os-text-muted)]">
          <span className="tabular-nums">
            Viser {currentPage * PAGE_SIZE + 1}
            {"–"}
            {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} av{" "}
            {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <PagerButton
              label="Forrige"
              disabled={currentPage === 0}
              onClick={() => setPage((n) => Math.max(0, n - 1))}
            />
            <span className="jbm tabular-nums">
              {currentPage + 1} / {pageCount}
            </span>
            <PagerButton
              label="Neste"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((n) => Math.min(pageCount - 1, n + 1))}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border-[0.5px] px-3 py-1 text-xs outline-none transition-colors duration-150",
        "focus-visible:ring-[var(--os-accent)]/40 focus-visible:ring-2",
        active
          ? "border-[var(--os-accent-border)] bg-[var(--os-bg-active)] text-[var(--os-accent)]"
          : "border-[var(--os-border)] text-[var(--os-text-secondary)] hover:border-[var(--os-border-accent)] hover:text-[var(--os-text-primary)]",
      )}
    >
      {label}
    </button>
  )
}

function ProductRow({
  product,
  saving,
  onChangeStatus,
}: {
  product: Product
  saving: boolean
  onChangeStatus: (product: Product, next: PipelineStatus) => void
}) {
  const meta = statusMeta(product.status)
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--os-bg-hover)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--os-text-primary)]">
          {product.title ?? "Uten navn"}
        </p>
        {product.vendor && (
          <p className="truncate text-xs text-[var(--os-text-muted)]">
            {product.vendor}
          </p>
        )}
      </div>

      <span
        className="hidden shrink-0 items-center gap-x-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex"
        style={{ backgroundColor: meta.bg, color: meta.text }}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: meta.dot }}
          aria-hidden="true"
        />
        {meta.label}
      </span>

      <div className="w-[11rem] shrink-0">
        <Select
          value={meta.value}
          onValueChange={(v) => onChangeStatus(product, v as PipelineStatus)}
          disabled={saving}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  )
}

function PagerButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] px-2.5 py-1 outline-none transition-colors",
        "focus-visible:ring-[var(--os-accent)]/40 focus-visible:ring-2",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "text-[var(--os-text-secondary)] hover:border-[var(--os-border-accent)] hover:text-[var(--os-text-primary)]",
      )}
    >
      {label}
    </button>
  )
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-[var(--os-border)]">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 animate-pulse space-y-2">
            <div className="h-4 w-2/5 rounded bg-white/5" />
            <div className="h-3 w-1/5 rounded bg-white/5" />
          </div>
          <div className="h-7 w-[11rem] animate-pulse rounded bg-white/5" />
        </li>
      ))}
    </ul>
  )
}
