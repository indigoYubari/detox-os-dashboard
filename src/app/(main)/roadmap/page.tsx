"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { supabase } from "@/lib/supabase"
import { cx } from "@/lib/utils"

type RoadmapStatus = "active" | "planned" | "completed"

type Pipeline = {
  id: string
  name: string
  description: string | null
  category: string | null
  area: string | null
  status: RoadmapStatus | string
  target_date: string | null
  completed_at: string | null
  links: string[] | null
}

type Comment = {
  id: string
  roadmap_id: string
  content: string
  created_at: string
}

type NewPipeline = {
  name: string
  description: string
  category: string
  area: string
  status: RoadmapStatus
  target_date: string
}

const COLUMNS: { key: RoadmapStatus; title: string }[] = [
  { key: "active", title: "Under bygging" },
  { key: "planned", title: "Neste" },
  { key: "completed", title: "Ferdig" },
]

const EMPTY_FORM: NewPipeline = {
  name: "",
  description: "",
  category: "",
  area: "",
  status: "active",
  target_date: "",
}

const dateFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Oslo",
})

function formatNorsk(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return dateFmt.format(date)
}

export default function RoadmapPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function updateItem(updated: Pipeline) {
    setPipelines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("roadmap")
      .select(
        "id, name, description, category, area, status, target_date, completed_at, links",
      )
      .order("completed_at", { ascending: false, nullsFirst: false })

    if (loadError) setError(loadError.message)
    else setPipelines((data ?? []) as Pipeline[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => {
    const byStatus: Record<RoadmapStatus, Pipeline[]> = {
      active: [],
      planned: [],
      completed: [],
    }
    for (const p of pipelines) {
      if (
        p.status === "active" ||
        p.status === "planned" ||
        p.status === "completed"
      ) {
        byStatus[p.status].push(p)
      }
    }
    // "Ferdig" sorteres på completed_at DESC (nyeste fullførte først)
    byStatus.completed.sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
    )
    return byStatus
  }, [pipelines])

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="jbm text-lg font-semibold text-[var(--os-text-primary)] sm:text-xl">
            Roadmap
          </h1>
          <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
            Hva som er under bygging på tvers av prosjekter
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="hover:bg-[var(--os-accent)]/90 border-transparent bg-[var(--os-accent)] text-[#020508]"
        >
          Legg til
        </Button>
      </div>

      {error && (
        <div className="border-[var(--os-danger)]/30 bg-[var(--os-danger)]/10 mt-5 rounded-[var(--os-radius-md)] border p-4 text-sm text-[var(--os-danger)]">
          Kunne ikke laste roadmap: {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            title={col.title}
            items={grouped[col.key]}
            loading={loading}
            expandedId={expandedId}
            onToggle={toggleExpanded}
            onUpdate={updateItem}
          />
        ))}
      </div>

      <AddDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          setOpen(false)
          void load()
        }}
      />
    </div>
  )
}

function Column({
  title,
  items,
  loading,
  expandedId,
  onToggle,
  onUpdate,
}: {
  title: string
  items: Pipeline[]
  loading: boolean
  expandedId: string | null
  onToggle: (id: string) => void
  onUpdate: (item: Pipeline) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-x-1.5 px-1">
        <span
          className="animate-blink size-1.5 rounded-full bg-[var(--os-accent)]"
          style={{ boxShadow: "0 0 6px var(--os-accent-glow)" }}
          aria-hidden="true"
        />
        <h2 className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          {title}
        </h2>
        <span className="jbm ml-auto text-[10px] tabular-nums text-[var(--os-text-muted)]">
          {loading ? "—" : items.length}
        </span>
      </div>

      {loading ? (
        <ColumnSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-[var(--os-radius-lg)] border border-dashed border-[var(--os-border)] bg-[var(--os-bg-card)] p-8 text-center">
          <p className="text-sm text-[var(--os-text-muted)]">
            Ingen elementer ennå
          </p>
        </div>
      ) : (
        items.map((item) => (
          <Card
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => onToggle(item.id)}
            onUpdate={onUpdate}
          />
        ))
      )}
    </section>
  )
}

function Card({
  item,
  expanded,
  onToggle,
  onUpdate,
}: {
  item: Pipeline
  expanded: boolean
  onToggle: () => void
  onUpdate: (item: Pipeline) => void
}) {
  const targetDate = formatNorsk(item.target_date)
  const completedDate = formatNorsk(item.completed_at)

  return (
    <div
      className={cx(
        "rounded-[var(--os-radius-lg)] border-[0.5px] bg-[var(--os-bg-card)] transition-colors duration-150",
        expanded
          ? "border-[var(--os-border-accent)]"
          : "border-[var(--os-border)] hover:border-[var(--os-border-accent)]",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        className="focus-visible:ring-[var(--os-accent)]/40 cursor-pointer px-4 py-[14px] outline-none focus-visible:ring-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          {item.category && <Badge>{item.category}</Badge>}
          {item.area && (
            <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
              {item.area}
            </span>
          )}
        </div>

        <h3 className="mt-2.5 text-sm font-semibold leading-6 text-[var(--os-text-primary)]">
          {item.name}
        </h3>

        {item.description && !expanded && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--os-text-secondary)]">
            {item.description}
          </p>
        )}

        {(targetDate || completedDate) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--os-text-muted)]">
            {completedDate ? (
              <span className="text-[var(--os-accent)]">
                Fullført {completedDate}
              </span>
            ) : (
              targetDate && <span>Mål: {targetDate}</span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <ExpandedPanel item={item} onClose={onToggle} onUpdate={onUpdate} />
      )}
    </div>
  )
}

function ExpandedPanel({
  item,
  onClose,
  onUpdate,
}: {
  item: Pipeline
  onClose: () => void
  onUpdate: (item: Pipeline) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [savingComment, setSavingComment] = useState(false)
  const [newLink, setNewLink] = useState("")
  const [savingLink, setSavingLink] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCommentsLoading(true)
    supabase
      .from("roadmap_comments")
      .select("id, roadmap_id, content, created_at")
      .eq("roadmap_id", item.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setPanelError(error.message)
        else setComments((data ?? []) as Comment[])
        setCommentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  async function changeStatus(next: RoadmapStatus) {
    if (next === item.status) return
    setPanelError(null)
    const completedAt = next === "completed" ? new Date().toISOString() : null
    const { error } = await supabase
      .from("roadmap")
      .update({ status: next, completed_at: completedAt })
      .eq("id", item.id)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, status: next, completed_at: completedAt })
  }

  async function addComment() {
    const content = newComment.trim()
    if (!content) return
    setSavingComment(true)
    setPanelError(null)
    const { data, error } = await supabase
      .from("roadmap_comments")
      .insert({ roadmap_id: item.id, content })
      .select("id, roadmap_id, content, created_at")
      .single()
    setSavingComment(false)
    if (error) {
      setPanelError(error.message)
      return
    }
    if (data) setComments((prev) => [...prev, data as Comment])
    setNewComment("")
  }

  async function addLink() {
    const url = newLink.trim()
    if (!url) return
    setSavingLink(true)
    setPanelError(null)
    const next = [...(item.links ?? []), url]
    const { error } = await supabase
      .from("roadmap")
      .update({ links: next })
      .eq("id", item.id)
    setSavingLink(false)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, links: next })
    setNewLink("")
  }

  const links = item.links ?? []

  return (
    <div className="border-t-[0.5px] border-[var(--os-border)] px-4 pb-4 pt-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-6 text-[var(--os-text-primary)]">
          {item.description || (
            <span className="text-[var(--os-text-muted)]">
              Ingen beskrivelse
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Lukk"
          className="focus-visible:ring-[var(--os-accent)]/40 -mr-1 -mt-0.5 shrink-0 rounded p-1 text-[var(--os-text-muted)] outline-none transition-colors hover:text-[var(--os-text-primary)] focus-visible:ring-2"
        >
          ✕
        </button>
      </div>

      {/* Status */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Status
        </span>
        <Select
          value={
            item.status === "active" ||
            item.status === "planned" ||
            item.status === "completed"
              ? item.status
              : "active"
          }
          onValueChange={(v) => void changeStatus(v as RoadmapStatus)}
        >
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Under bygging</SelectItem>
            <SelectItem value="planned">Neste</SelectItem>
            <SelectItem value="completed">Ferdig</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lenker */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Lenker
        </span>
        {links.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {links.map((url, i) => (
              <a
                key={`${url}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex max-w-[14rem] items-center truncate rounded-full border border-[var(--os-border-accent)] bg-[var(--os-bg-active)] px-2.5 py-0.5 text-xs text-[var(--os-accent)] transition-colors hover:bg-[var(--os-accent-dim)]"
              >
                {url}
              </a>
            ))}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <Input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void addLink()
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void addLink()}
            isLoading={savingLink}
            disabled={!newLink.trim()}
          >
            Legg til
          </Button>
        </div>
      </div>

      {/* Kommentarer */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Kommentarer
        </span>
        {commentsLoading ? (
          <p className="mt-1.5 text-xs text-[var(--os-text-muted)]">
            Laster kommentarer…
          </p>
        ) : comments.length === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--os-text-muted)]">
            Ingen kommentarer ennå
          </p>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-[var(--os-radius-sm)] border-[0.5px] border-[var(--os-border)] bg-[var(--os-bg-hover)] px-3 py-2"
              >
                <p className="text-sm leading-6 text-[var(--os-text-secondary)]">
                  {c.content}
                </p>
                <span className="mt-0.5 block text-[10px] tabular-nums text-[var(--os-text-muted)]">
                  {formatNorsk(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Skriv en kommentar…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void addComment()
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void addComment()}
            isLoading={savingComment}
            disabled={!newComment.trim()}
          >
            Legg til
          </Button>
        </div>
      </div>

      {panelError && (
        <p className="mt-3 text-sm text-[var(--os-danger)]">{panelError}</p>
      )}
    </div>
  )
}

function ColumnSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--os-radius-lg)] border-[0.5px] border-[var(--os-border)] bg-[var(--os-bg-card)] px-4 py-[14px]"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-16 rounded bg-white/5" />
            <div className="h-4 w-4/5 rounded bg-white/5" />
            <div className="h-3 w-3/5 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </>
  )
}

function AddDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<NewPipeline>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof NewPipeline>(key: K, value: NewPipeline[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Nullstill skjema når dialogen lukkes, slik at neste åpning starter tomt.
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM)
      setError(null)
      setSaving(false)
    }
  }, [open])

  async function submit() {
    if (!form.name.trim()) {
      setError("Navn er påkrevd")
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      area: form.area.trim() || null,
      status: form.status,
      target_date: form.target_date || null,
      completed_at:
        form.status === "completed" ? new Date().toISOString() : null,
    }

    const { error: insertError } = await supabase
      .from("roadmap")
      .insert(payload)

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nytt roadmap-element</DialogTitle>
          <DialogDescription>
            Legg til et element i pipeline. Navn er påkrevd, resten er
            valgfritt.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div>
            <Label htmlFor="rm-name">Navn</Label>
            <Input
              id="rm-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="F.eks. HealthOS-portal"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="rm-description">Beskrivelse</Label>
            <textarea
              id="rm-description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Kort beskrivelse av hva dette er"
              rows={3}
              className={cx(
                "mt-1.5 block w-full rounded-md border px-2.5 py-1.5 text-sm shadow-sm outline-none transition",
                "border-gray-300 bg-white text-gray-900 placeholder-gray-400",
                "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder-gray-500",
                "focus:ring-[var(--os-accent)]/20 focus:border-[var(--os-accent)] focus:ring-2",
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rm-category">Kategori</Label>
              <Input
                id="rm-category"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                placeholder="F.eks. Plattform"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="rm-area">Område</Label>
              <Input
                id="rm-area"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="F.eks. detox.OS"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rm-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v as RoadmapStatus)}
              >
                <SelectTrigger id="rm-status" className="mt-1.5 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Under bygging</SelectItem>
                  <SelectItem value="planned">Neste</SelectItem>
                  <SelectItem value="completed">Ferdig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rm-target">Måldato</Label>
              <Input
                id="rm-target"
                type="date"
                value={form.target_date}
                onChange={(e) => update("target_date", e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[var(--os-danger)]">{error}</p>}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={submit}
            isLoading={saving}
            loadingText="Lagrer"
            className="hover:bg-[var(--os-accent)]/90 border-transparent bg-[var(--os-accent)] text-[#020508]"
          >
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
