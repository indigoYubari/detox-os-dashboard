"use client"

import React from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/Badge"

type Step = {
  step: number
  title: string
  description?: string
}

type Sop = {
  id: string
  title: string
  category: string
  owner: string
  frequency: string
  last_updated: string
  status: "aktiv" | "utkast" | "utdatert"
  summary: string
  steps: Step[]
}

const STATUS_VARIANT: Record<Sop["status"], "success" | "neutral" | "error"> = {
  aktiv: "success",
  utkast: "neutral",
  utdatert: "error",
}

export default function SopsPage() {
  const [sops, setSops] = React.useState<Sop[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("sops")
        .select("*")
        .order("category")
        .order("title")

      if (error) setError(error.message)
      else setSops(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Laster SOPs…
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

  const byCategory = sops.reduce<Record<string, Sop[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          SOPs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {sops.length} prosedyrer — dokumenterte playbooks og rutiner
        </p>
      </div>

      {sops.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
          Ingen SOPs registrert ennå
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {category}
              </h2>
              <div className="space-y-2">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                  >
                    <button
                      className="w-full px-4 py-3 text-left"
                      onClick={() =>
                        setExpanded(expanded === s.id ? null : s.id)
                      }
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="truncate font-medium text-gray-900 dark:text-gray-50">
                            {s.title}
                          </span>
                          <Badge variant={STATUS_VARIANT[s.status]}>
                            {s.status}
                          </Badge>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 text-xs text-gray-400">
                          <span>{s.owner}</span>
                          <span>{s.frequency}</span>
                          <span>{s.last_updated}</span>
                          <span>{expanded === s.id ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {s.summary}
                      </p>
                    </button>

                    {expanded === s.id && s.steps.length > 0 && (
                      <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                        <ol className="space-y-2">
                          {s.steps.map((step) => (
                            <li key={step.step} className="flex gap-3 text-sm">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                {step.step}
                              </span>
                              <div>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {step.title}
                                </span>
                                {step.description && (
                                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                    {step.description}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
