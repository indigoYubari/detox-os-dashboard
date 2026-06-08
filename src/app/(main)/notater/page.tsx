"use client"

import React from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/Badge"

type Note = {
  id: string
  title: string
  excerpt: string
  type: "beslutning" | "forskning" | "ide" | "mote"
  tags: string[]
  project: string
  updated: string
  pinned: boolean
}

const TYPE_VARIANT: Record<
  Note["type"],
  "default" | "success" | "warning" | "neutral"
> = {
  beslutning: "default",
  forskning: "success",
  ide: "warning",
  mote: "neutral",
}

const TYPE_LABEL: Record<Note["type"], string> = {
  beslutning: "Beslutning",
  forskning: "Forskning",
  ide: "Idé",
  mote: "Møte",
}

export default function NotaterPage() {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<Note["type"] | "alle">("alle")

  React.useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("pinned", { ascending: false })
        .order("updated", { ascending: false })

      if (error) setError(error.message)
      else setNotes(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Laster notater…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        Feil: {error}
      </div>
    )
  }

  const filtered =
    filter === "alle" ? notes : notes.filter((n) => n.type === filter)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            Notater
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {notes.length} notater — beslutningslogg og forskningsnotater
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["alle", "beslutning", "forskning", "ide", "mote"] as const).map(
          (t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === t
                  ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {t === "alle" ? "Alle" : TYPE_LABEL[t]}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
          Ingen notater registrert ennå
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border bg-white p-4 dark:bg-gray-950 ${
                n.pinned
                  ? "border-gray-400 dark:border-gray-600"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {n.pinned && (
                    <span className="shrink-0 text-gray-400">📌</span>
                  )}
                  <span className="truncate font-medium text-gray-900 dark:text-gray-50">
                    {n.title}
                  </span>
                </div>
                <Badge variant={TYPE_VARIANT[n.type]} className="shrink-0">
                  {TYPE_LABEL[n.type]}
                </Badge>
              </div>

              <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                {n.excerpt}
              </p>

              {n.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {n.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>{n.project}</span>
                <span>{n.updated}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
