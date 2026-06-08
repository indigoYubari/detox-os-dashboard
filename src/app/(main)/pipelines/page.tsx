"use client"

import React from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/Badge"

type Stage = {
  name: string
  status: "ok" | "feil" | "kjorer" | "venter"
  duration?: string
}

type Pipeline = {
  id: string
  name: string
  description: string
  trigger: string
  status: "ok" | "kjorer" | "feil" | "pause"
  last_run: string
  duration: string
  throughput: string
  success_rate: number
  stages: Stage[]
}

const STATUS_VARIANT: Record<
  Pipeline["status"],
  "success" | "default" | "error" | "warning"
> = {
  ok: "success",
  kjorer: "default",
  feil: "error",
  pause: "warning",
}

const STAGE_COLOR: Record<Stage["status"], string> = {
  ok: "bg-emerald-500",
  feil: "bg-red-500",
  kjorer: "bg-blue-500 animate-pulse",
  venter: "bg-gray-300 dark:bg-gray-700",
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("name")

      if (error) setError(error.message)
      else setPipelines(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Laster pipelines…
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
          Pipelines
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {pipelines.length} pipelines — automatiserte dataflyter og prosesser
        </p>
      </div>

      {pipelines.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
          Ingen pipelines registrert ennå
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-50">
                      {p.name}
                    </span>
                    <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {p.description}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-gray-400">
                  <div>{p.last_run}</div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">
                    {p.duration}
                  </div>
                </div>
              </div>

              {p.stages.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-1">
                    {p.stages.map((s, i) => (
                      <React.Fragment key={i}>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`h-2 w-8 rounded-full ${STAGE_COLOR[s.status]}`}
                            title={s.name}
                          />
                          <span className="max-w-[4rem] truncate text-center text-[10px] text-gray-400">
                            {s.name}
                          </span>
                        </div>
                        {i < p.stages.length - 1 && (
                          <div className="mb-3 h-px w-4 bg-gray-200 dark:bg-gray-800" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Trigger:{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {p.trigger}
                  </span>
                </span>
                <span>
                  Gjennomstrømning:{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {p.throughput}
                  </span>
                </span>
                <span>
                  Suksessrate:{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {p.success_rate}%
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
