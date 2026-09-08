// Server-side lesing for /eiere. Samme moenster som content-server.ts: brukerens
// egen session via createSupabaseServerClient, RLS gjelder, service_role brukes
// aldri. Hvert kall returnerer ok/feil eksplisitt — siden viser feil som feil.
//
// Tabellene reports/findings/recommendations/requests ble opprettet med RLS paa
// og null policyer (shared-state 0001, service_role-only). Lesing fra en
// innlogget eier krever migrasjon 0008 (supabase/migrations/0008_*). Foer den
// er kjoert svarer PostgREST "permission denied" — og det er det siden skal si.

import { createSupabaseServerClient } from "./auth-server"
import {
  ANAKIN_AGENT_ID,
  QUEUE_STATUSES,
  RADAR_REPORT_TYPE,
  type RadarReport,
  type RequestRow,
  type RunStateRow,
} from "./eiere"

export type ReadError = {
  ok: false
  error: string
  /** no_access = grants/policyer mangler (0008 ikke kjoert). other = alt annet. */
  code: "no_access" | "other"
}

export function classifyError(message: string): ReadError["code"] {
  return /permission denied|42501/i.test(message) ? "no_access" : "other"
}

function fail(message: string): ReadError {
  return { ok: false, error: message, code: classifyError(message) }
}

export type RadarResult = { ok: true; report: RadarReport | null } | ReadError

/** Siste Content Radar fra Anakin med funn og anbefalinger — null hvis ingen. */
export async function fetchLatestRadar(): Promise<RadarResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, agent_id, report_type, period, status, requires_review, created_at, findings(id, kind, claim, evidence, source_url, confidence, created_at), recommendations(id, kind, action, status, owner, created_at)",
    )
    .eq("agent_id", ANAKIN_AGENT_ID)
    .eq("report_type", RADAR_REPORT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) return fail(error.message)
  const row = (data ?? [])[0] as RadarReport | undefined
  if (!row) return { ok: true, report: null }
  // Stabil rekkefoelge: slik radene ble skrevet (PostgREST-embedding garanterer
  // ingen rekkefoelge).
  const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
    a.created_at.localeCompare(b.created_at)
  return {
    ok: true,
    report: {
      ...row,
      findings: [...(row.findings ?? [])].sort(byCreated),
      recommendations: [...(row.recommendations ?? [])].sort(byCreated),
    },
  }
}

export type RunStateResult = { ok: true; state: RunStateRow | null } | ReadError

export async function fetchRunState(
  agentId: string = ANAKIN_AGENT_ID,
): Promise<RunStateResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("run_state")
    .select("agent_id, last_successful_run, last_run_status, last_error, updated_at")
    .eq("agent_id", agentId)
    .maybeSingle()
  if (error) return fail(error.message)
  return { ok: true, state: (data as RunStateRow | null) ?? null }
}

export type QueueResult = { ok: true; rows: RequestRow[] } | ReadError

/** Alt som venter paa ja/nei/lest: status open eller in_progress. */
export async function fetchQueue(): Promise<QueueResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("requests")
    .select("id, requester, kind, body, status, created_at")
    .in("status", [...QUEUE_STATUSES])
    .order("created_at", { ascending: false })
  if (error) return fail(error.message)
  return { ok: true, rows: (data ?? []) as RequestRow[] }
}
