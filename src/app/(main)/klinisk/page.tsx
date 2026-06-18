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

type ClientStatus =
  | "inntak"
  | "analyse"
  | "mote_planlagt"
  | "protokoll"
  | "levert"
  | "oppfolging"

type Client = {
  id: string
  first_name: string
  last_name_initial: string | null
  status: ClientStatus | string
  tests_received: string[] | null
  meeting_date: string | null
  notes: string | null
  zoom_summary: string | null
  created_at: string
}

type NewClient = {
  first_name: string
  last_name_initial: string
  status: ClientStatus
  tests_received: string[]
}

const COLUMNS: { key: ClientStatus; title: string }[] = [
  { key: "inntak", title: "Inntak" },
  { key: "analyse", title: "Analyse" },
  { key: "mote_planlagt", title: "Møte planlagt" },
  { key: "protokoll", title: "Protokoll" },
  { key: "levert", title: "Levert" },
  { key: "oppfolging", title: "Oppfølging" },
]

const TESTS: { key: string; label: string }[] = [
  { key: "blod", label: "Blod" },
  { key: "genetisk", label: "Genetisk" },
  { key: "htma", label: "HTMA" },
  { key: "dutch", label: "DUTCH" },
  { key: "sporreskjema", label: "Spørreskjema" },
]

const STATUS_KEYS = COLUMNS.map((c) => c.key)

const STATUS_TITLE: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c.title]),
)

const EMPTY_FORM: NewClient = {
  first_name: "",
  last_name_initial: "",
  status: "inntak",
  tests_received: [],
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

function displayName(client: Client): string {
  const initial = client.last_name_initial?.trim()
  return initial ? `${client.first_name} ${initial}.` : client.first_name
}

// Inndata til <input type="date"> krever YYYY-MM-DD.
function toDateInputValue(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export default function KliniskPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function updateItem(updated: Client) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("clients")
      .select(
        "id, first_name, last_name_initial, status, tests_received, meeting_date, notes, zoom_summary, created_at",
      )
      .order("created_at", { ascending: false })

    if (loadError) setError(loadError.message)
    else setClients((data ?? []) as Client[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => {
    const byStatus: Record<ClientStatus, Client[]> = {
      inntak: [],
      analyse: [],
      mote_planlagt: [],
      protokoll: [],
      levert: [],
      oppfolging: [],
    }
    for (const c of clients) {
      // Ukjent eller manglende status havner i Inntak, slik at ingen klient blir borte.
      const key = STATUS_KEYS.includes(c.status as ClientStatus)
        ? (c.status as ClientStatus)
        : "inntak"
      byStatus[key].push(c)
    }
    return byStatus
  }, [clients])

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="jbm text-lg font-semibold text-[var(--os-text-primary)] sm:text-xl">
            Klinisk
          </h1>
          <p className="mt-1 text-sm text-[var(--os-text-secondary)]">
            Klientadministrasjon fra inntak til oppfølging
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="hover:bg-[var(--os-accent)]/90 border-transparent bg-[var(--os-accent)] text-[#020508]"
        >
          Legg til klient
        </Button>
      </div>

      {error && (
        <div className="border-[var(--os-danger)]/30 bg-[var(--os-danger)]/10 mt-5 rounded-[var(--os-radius-md)] border p-4 text-sm text-[var(--os-danger)]">
          Kunne ikke laste klienter: {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
  items: Client[]
  loading: boolean
  expandedId: string | null
  onToggle: (id: string) => void
  onUpdate: (item: Client) => void
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
            Ingen klienter ennå
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
  item: Client
  expanded: boolean
  onToggle: () => void
  onUpdate: (item: Client) => void
}) {
  const meetingDate = formatNorsk(item.meeting_date)
  const received = item.tests_received ?? []
  const statusTitle = STATUS_TITLE[item.status] ?? "Inntak"

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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold leading-6 text-[var(--os-text-primary)]">
            {displayName(item)}
          </h3>
          <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--os-border-accent)] bg-[var(--os-bg-active)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--os-accent)]">
            {statusTitle}
          </span>
        </div>

        {received.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TESTS.filter((t) => received.includes(t.key)).map((t) => (
              <Badge key={t.key}>{t.label}</Badge>
            ))}
          </div>
        )}

        {meetingDate && (
          <div className="mt-3 text-xs text-[var(--os-text-muted)]">
            Møte: {meetingDate}
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
  item: Client
  onClose: () => void
  onUpdate: (item: Client) => void
}) {
  const [notes, setNotes] = useState(item.notes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [zoomSummary, setZoomSummary] = useState(item.zoom_summary ?? "")
  const [savingZoom, setSavingZoom] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)

  const received = item.tests_received ?? []

  async function changeStatus(next: ClientStatus) {
    if (next === item.status) return
    setPanelError(null)
    const { error } = await supabase
      .from("clients")
      .update({ status: next })
      .eq("id", item.id)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, status: next })
  }

  async function toggleTest(key: string) {
    setPanelError(null)
    const next = received.includes(key)
      ? received.filter((t) => t !== key)
      : [...received, key]
    const { error } = await supabase
      .from("clients")
      .update({ tests_received: next })
      .eq("id", item.id)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, tests_received: next })
  }

  async function changeMeetingDate(value: string) {
    setPanelError(null)
    const next = value || null
    const { error } = await supabase
      .from("clients")
      .update({ meeting_date: next })
      .eq("id", item.id)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, meeting_date: next })
  }

  async function saveNotes() {
    setSavingNotes(true)
    setPanelError(null)
    const next = notes.trim() || null
    const { error } = await supabase
      .from("clients")
      .update({ notes: next })
      .eq("id", item.id)
    setSavingNotes(false)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, notes: next })
  }

  async function saveZoomSummary() {
    setSavingZoom(true)
    setPanelError(null)
    const next = zoomSummary.trim() || null
    const { error } = await supabase
      .from("clients")
      .update({ zoom_summary: next })
      .eq("id", item.id)
    setSavingZoom(false)
    if (error) {
      setPanelError(error.message)
      return
    }
    onUpdate({ ...item, zoom_summary: next })
  }

  const notesDirty = (notes.trim() || null) !== (item.notes ?? null)
  const zoomDirty = (zoomSummary.trim() || null) !== (item.zoom_summary ?? null)

  return (
    <div className="border-t-[0.5px] border-[var(--os-border)] px-4 pb-4 pt-3">
      <div className="flex items-start justify-between gap-3">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Detaljer
        </span>
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
      <div className="mt-3">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Status
        </span>
        <Select
          value={
            STATUS_KEYS.includes(item.status as ClientStatus)
              ? (item.status as ClientStatus)
              : "inntak"
          }
          onValueChange={(v) => void changeStatus(v as ClientStatus)}
        >
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {COLUMNS.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tester mottatt */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Tester mottatt
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2">
          {TESTS.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center gap-2 text-sm text-[var(--os-text-secondary)]"
            >
              <input
                type="checkbox"
                checked={received.includes(t.key)}
                onChange={() => void toggleTest(t.key)}
                className="size-4 cursor-pointer rounded border-[var(--os-border)] bg-[var(--os-bg-hover)] text-[var(--os-accent)] accent-[var(--os-accent)]"
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {/* Møtedato */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Møtedato
        </span>
        <Input
          type="date"
          value={toDateInputValue(item.meeting_date)}
          onChange={(e) => void changeMeetingDate(e.target.value)}
          className="mt-1.5"
        />
      </div>

      {/* Notater */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Notater
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notater om klienten…"
          rows={4}
          className={cx(
            "mt-1.5 block w-full rounded-md border px-2.5 py-1.5 text-sm shadow-sm outline-none transition",
            "border-gray-300 bg-white text-gray-900 placeholder-gray-400",
            "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder-gray-500",
            "focus:ring-[var(--os-accent)]/20 focus:border-[var(--os-accent)] focus:ring-2",
          )}
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void saveNotes()}
            isLoading={savingNotes}
            loadingText="Lagrer"
            disabled={!notesDirty}
          >
            Lagre notat
          </Button>
        </div>
      </div>

      {/* Zoom-referat */}
      <div className="mt-4">
        <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
          Zoom-referat
        </span>
        <textarea
          value={zoomSummary}
          onChange={(e) => setZoomSummary(e.target.value)}
          placeholder="Lim inn Zoom-referat her..."
          rows={8}
          className={cx(
            "mt-1.5 block w-full rounded-md border px-2.5 py-1.5 text-sm shadow-sm outline-none transition",
            "border-gray-300 bg-white text-gray-900 placeholder-gray-400",
            "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50 dark:placeholder-gray-500",
            "focus:ring-[var(--os-accent)]/20 focus:border-[var(--os-accent)] focus:ring-2",
          )}
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void saveZoomSummary()}
            isLoading={savingZoom}
            loadingText="Lagrer"
            disabled={!zoomDirty}
          >
            Lagre referat
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
            <div className="h-4 w-2/3 rounded bg-white/5" />
            <div className="h-3 w-1/2 rounded bg-white/5" />
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
  const [form, setForm] = useState<NewClient>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof NewClient>(key: K, value: NewClient[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleTest(key: string) {
    setForm((prev) => ({
      ...prev,
      tests_received: prev.tests_received.includes(key)
        ? prev.tests_received.filter((t) => t !== key)
        : [...prev.tests_received, key],
    }))
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
    if (!form.first_name.trim()) {
      setError("Fornavn er påkrevd")
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      first_name: form.first_name.trim(),
      last_name_initial: form.last_name_initial.trim() || null,
      status: form.status,
      tests_received: form.tests_received,
    }

    const { error: insertError } = await supabase
      .from("clients")
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
          <DialogTitle>Ny klient</DialogTitle>
          <DialogDescription>
            Registrer en ny klient. Fornavn er påkrevd, resten er valgfritt.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cl-first">Fornavn</Label>
              <Input
                id="cl-first"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                placeholder="F.eks. Kari"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cl-initial">Etternavn initial</Label>
              <Input
                id="cl-initial"
                value={form.last_name_initial}
                onChange={(e) => update("last_name_initial", e.target.value)}
                placeholder="F.eks. N"
                maxLength={2}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cl-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v as ClientStatus)}
            >
              <SelectTrigger id="cl-status" className="mt-1.5 w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="jbm text-[10px] uppercase tracking-wide text-[var(--os-text-muted)]">
              Tester mottatt
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2">
              {TESTS.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-[var(--os-text-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={form.tests_received.includes(t.key)}
                    onChange={() => toggleTest(t.key)}
                    className="size-4 cursor-pointer rounded border-[var(--os-border)] bg-[var(--os-bg-hover)] text-[var(--os-accent)] accent-[var(--os-accent)]"
                  />
                  {t.label}
                </label>
              ))}
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
