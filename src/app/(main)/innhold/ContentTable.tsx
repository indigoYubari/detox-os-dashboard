"use client"

import React from "react"

import {
  CONTENT_STAGES,
  STAGE_DOT,
  STAGE_LABELS,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_STYLE,
  type ContentItem,
  type ContentStage,
} from "@/lib/content"

export function ContentTable({ items }: { items: ContentItem[] }) {
  const [filter, setFilter] = React.useState<ContentStage | "alle">("alle")

  const filtered =
    filter === "alle" ? items : items.filter((item) => item.stage === filter)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Alle innholdselementer
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["alle", ...CONTENT_STAGES] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {f === "alle" ? "Alle" : STAGE_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                Tittel
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                Stage
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                Kanaler
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                Bestilt av
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                >
                  Ingen innholdselementer i denne stagen.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-50">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.source_repo}:{item.source_path}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[item.stage]}`}
                      />
                      <span className="text-gray-600 dark:text-gray-300">
                        {STAGE_LABELS[item.stage]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.channels.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        item.channels.map((channel) => (
                          <span
                            key={channel}
                            className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          >
                            {channel}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {item.requested_by ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STATUS_STYLE[item.stage_status]}`}
                    >
                      {STAGE_STATUS_LABELS[item.stage_status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
