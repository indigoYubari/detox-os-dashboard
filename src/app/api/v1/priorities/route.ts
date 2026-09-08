import { NextResponse } from "next/server"

import {
  authorize,
  createSupabaseServerClient,
  requireDetoxPrincipal,
} from "@/lib/auth-server"
import { createMachineSupabaseClient } from "@/lib/gpt-auth"

// GET /api/v1/priorities - hva som står på Detox' roadmap-tavle akkurat nå.
//
// ÆRLIGHETSKRAV (mandatets §12): tavlen har ingen reell prioritetsmotor.
// Verifisert mot prod 2026-08-22: alle 12 rader har priority = 0, target_date
// = null, og identisk created_at (2026-06-18 11:55:08+00) - én bulk-import som
// ikke er rørt siden. `completed_at` er på alle fullførte rader identisk med
// `created_at`, altså et importartefakt og ikke et observert tidspunkt.
//
// Derfor: ingen rangering, ingen utregnet score, ingen "viktigst først".
// Endepunktet grupperer på status og forteller kalleren rett ut hva dataene
// IKKE kan brukes til. GPT-en skal aldri gjøre skjult matematikk på dette.
export const dynamic = "force-dynamic"

type RoadmapRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  area: string | null
  status: string | null
  target_date: string | null
  completed_at: string | null
  created_at: string | null
}

type PriorityItem = {
  id: string
  name: string
  description: string | null
  category: string | null
  area: string | null
  target_date: string | null
}

function toItem(r: RoadmapRow): PriorityItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    area: r.area,
    target_date: r.target_date,
  }
}

export async function GET() {
  const principal = await requireDetoxPrincipal()
  const denied = authorize(principal, "detox:read")
  if (denied) return denied

  const supabase = principal!.accessToken
    ? createMachineSupabaseClient(principal!.accessToken)
    : createSupabaseServerClient()

  const { data, error } = await supabase
    .from("roadmap")
    .select(
      "id, name, description, category, area, status, target_date, completed_at, created_at",
    )

  if (error) {
    return NextResponse.json(
      { error: "Kunne ikke hente roadmap", code: "query_failed" },
      { status: 502 },
    )
  }

  const rows = (data ?? []) as RoadmapRow[]

  const groups = {
    in_progress: rows.filter((r) => r.status === "active").map(toItem),
    planned: rows.filter((r) => r.status === "planned").map(toItem),
    recently_completed: rows
      .filter((r) => r.status === "completed")
      .map(toItem),
  }

  // Siste faktiske endring på tavlen. Beregnes server-side slik at GPT-en ikke
  // trenger å utlede ferskhet selv.
  const timestamps = rows
    .flatMap((r) => [r.created_at, r.completed_at])
    .filter((t): t is string => Boolean(t))
    .sort()
  const boardLastChanged = timestamps.length
    ? timestamps[timestamps.length - 1]
    : null

  const hasRealPriority = rows.some(
    (r) => r.target_date !== null && r.target_date !== "",
  )

  return NextResponse.json({
    data_source: "live",
    source: "detox-os roadmap (Dashboard-DB)",
    total: rows.length,
    counts: {
      in_progress: groups.in_progress.length,
      planned: groups.planned.length,
      recently_completed: groups.recently_completed.length,
    },
    groups,
    // Kontrakten som hindrer oppdiktet rangering.
    priority_available: hasRealPriority,
    ordering: "ingen",
    board_last_changed: boardLastChanged,
    caveat:
      "Roadmap-tavlen har ingen prioritetsverdier og ingen måldatoer. Radene er ikke rangert, og rekkefølgen i listene er vilkårlig. Tavlen er ikke oppdatert siden board_last_changed. Presenter dette som en statusoversikt, aldri som en prioritert liste.",
  })
}
