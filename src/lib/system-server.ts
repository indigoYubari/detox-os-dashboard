// Server-side lesing av run_state for forsiden: naar kjoerte hver agent sist,
// og gikk det bra. Brukerens egen session, grants fra migrasjon 0008.
// Radene skrives av agentene selv (ingest_report-RPC-en) — dashbordet paastaar
// ingenting om en kjoering det ikke finnes en rad for.

import { createSupabaseServerClient } from "./auth-server"
import { classifyError, type ReadError } from "./eiere-server"

export type RunStateRad = {
  agent_id: string
  last_successful_run: string | null
  last_run_status: string | null
  last_error: string | null
  updated_at: string
}

export type RunStateResult = { ok: true; rows: RunStateRad[] } | ReadError

export async function fetchRunState(): Promise<RunStateResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("run_state")
    .select("agent_id, last_successful_run, last_run_status, last_error, updated_at")
    .order("agent_id", { ascending: true })
  if (error) {
    return { ok: false, error: error.message, code: classifyError(error.message) }
  }
  return { ok: true, rows: (data ?? []) as RunStateRad[] }
}
