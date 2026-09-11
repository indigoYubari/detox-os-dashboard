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
  PULS_KINDS,
  pulsHistoryOf,
  QUEUE_STATUSES,
  RADAR_REPORT_TYPE,
  threadsOf,
  type PulsPoint,
  type RadarFinding,
  type RadarReport,
  type RequestRow,
  type RunStateRow,
  type Thread,
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

export type PulsHistoryResult = { ok: true; points: PulsPoint[] } | ReadError

/** Antall nattlige radarer som leses for trenden — to uker. */
export const PULS_HISTORY_REPORTS = 14

/**
 * Én puls per radar-dag, eldste foerst — grunnlaget for grafen. Leser bare
 * funn av puls-kindene; parsing og dedupe skjer i pulsHistoryOf.
 */
export async function fetchPulsHistory(
  limit: number = PULS_HISTORY_REPORTS,
): Promise<PulsHistoryResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, period, created_at, findings(id, kind, claim, evidence, source_url, confidence, created_at)",
    )
    .eq("agent_id", ANAKIN_AGENT_ID)
    .eq("report_type", RADAR_REPORT_TYPE)
    .in("findings.kind", [...PULS_KINDS])
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return fail(error.message)
  const rows = (data ?? []) as {
    period: string
    findings: RadarFinding[] | null
  }[]
  return {
    ok: true,
    points: pulsHistoryOf(
      rows.map((r) => ({ period: r.period, findings: r.findings ?? [] })),
    ),
  }
}

export type RunStateResult = { ok: true; state: RunStateRow | null } | ReadError

export async function fetchRunState(
  agentId: string = ANAKIN_AGENT_ID,
): Promise<RunStateResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("run_state")
    .select(
      "agent_id, last_successful_run, last_run_status, last_error, updated_at",
    )
    .eq("agent_id", agentId)
    .maybeSingle()
  if (error) return fail(error.message)
  return { ok: true, state: (data as RunStateRow | null) ?? null }
}

export type QueueResult = { ok: true; rows: RequestRow[] } | ReadError

/** Kolonnene slik de ligger i requests per 2026-09-11 (ingen delivery_id). */
export const REQUEST_ROW_COLUMNS =
  "id, requester, kind, body, status, created_at, response, responded_at, thread_id, parent_id"

/**
 * Alt som venter paa Anakin eller paa ja/nei/lest: status open eller
 * in_progress, og uten svar. Rader Anakin har svart paa vises som samtaler
 * (fetchThreads), ikke her — én rad, ett sted.
 */
export async function fetchQueue(): Promise<QueueResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_ROW_COLUMNS)
    .in("status", [...QUEUE_STATUSES])
    .is("response", null)
    .order("created_at", { ascending: false })
  if (error) return fail(error.message)
  return { ok: true, rows: (data ?? []) as RequestRow[] }
}

export type ThreadsResult = { ok: true; threads: Thread[] } | ReadError

/** Hvor mange rader som leses til «Svar og samtaler». */
export const THREAD_ROWS = 60

/**
 * Anakins svar og traadene de hoerer til: rader med svar, eller som peker paa
 * en traad. Gruppert per traad, nyeste aktivitet (responded_at, ellers
 * created_at) foerst — samme regel som Anakins eget oppslag.
 */
export async function fetchThreads(
  limit: number = THREAD_ROWS,
): Promise<ThreadsResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("requests")
    .select(REQUEST_ROW_COLUMNS)
    .or("response.not.is.null,thread_id.not.is.null")
    .order("responded_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return fail(error.message)
  return { ok: true, threads: threadsOf((data ?? []) as RequestRow[]) }
}
