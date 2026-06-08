"use client"

import React from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/Badge"
import { cx } from "@/lib/utils"

type Supplier = {
  id: string
  name: string
  category: string
  country: string
  contact: string
  email: string
  phone: string
  lead_time_days: number
  moq: string
  payment: string
  status: "aktiv" | "pause" | "ny"
  coa: "ok" | "mangler" | "utlopt"
  quality: number
  created_at: string
}

const STATUS_VARIANT: Record<
  Supplier["status"],
  "success" | "warning" | "neutral"
> = {
  aktiv: "success",
  pause: "warning",
  ny: "neutral",
}

const COA_VARIANT: Record<Supplier["coa"], "success" | "error" | "warning"> = {
  ok: "success",
  mangler: "error",
  utlopt: "warning",
}

function QualityBar({ value }: { value: number }) {
  const color =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-yellow-400"
        : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={cx("h-1.5 rounded-full", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
        {value}
      </span>
    </div>
  )
}

export default function LeverandorerPage() {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name")

      if (error) {
        setError(error.message)
      } else {
        setSuppliers(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Laster leverandører…
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            Leverandører
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {suppliers.length} leverandører — COA-er, ledetider og
            batch-historikk
          </p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
          Ingen leverandører registrert ennå
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                {[
                  "Navn",
                  "Kategori",
                  "Land",
                  "Kontakt",
                  "Ledetid",
                  "MOQ",
                  "Status",
                  "COA",
                  "Kvalitet",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-50">
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-400">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {s.category}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {s.country}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700 dark:text-gray-300">
                      {s.contact}
                    </div>
                    <div className="text-xs text-gray-400">{s.phone}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-400">
                    {s.lead_time_days}d
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {s.moq}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={COA_VARIANT[s.coa]}>{s.coa}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <QualityBar value={s.quality} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
