"use client"

import React from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/Badge"

type Agent = {
  id: string
  name: string
  type: string
  description: string
  status: "kjorer" | "inaktiv" | "feil" | "planlagt"
  schedule: string
  last_run: string
  next_run: string
  runs_today: number
  success_rate: number
  avg_duration: string
  last_message: string
}

const STATUS_VARIANT: Record<
  Agent["status"],
  "success" | "neutral" | "error" | "warning"
> = {
  kjorer: "success",
  inaktiv: "neutral",
  feil: "error",
  planlagt: "warning",
}

const STATUS_DOT: Record<Agent["status"], string> = {
  kjorer: "bg-emerald-500",
  inaktiv: "bg-gray-400",
  feil: "bg-red-500",
  planlagt: "bg-yellow-400",
}

export default function AgenterPage() {
  const [agents, setAgents] = React.useState<Agent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("name")

      if (error) setError(error.message)
      else setAgents(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Laster agenter…
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          Agenter
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {agents.length} agenter — autonome prosesser som overvåker og handler
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
          Ingen agenter registrert ennå
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[a.status]}`}
                    />
                    <span className="truncate font-medium text-gray-900 dark:text-gray-50">
                      {a.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{a.type}</p>
                </div>
                <Badge variant={STATUS_VARIANT[a.status]} className="shrink-0">
                  {a.status}
                </Badge>
              </div>

              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {a.description}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <span className="block text-gray-400">Siste kjøring</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {a.last_run}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400">Neste kjøring</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {a.next_run}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400">Kjøringer i dag</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {a.runs_today}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400">Suksessrate</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {a.success_rate}%
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400">Snitt varighet</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {a.avg_duration}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400">Intervall</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {a.schedule}
                  </span>
                </div>
              </div>

              {a.last_message && (
                <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {a.last_message}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
