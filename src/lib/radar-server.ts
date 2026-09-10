// Server-side lesing for /radar. Samme moenster som eiere-server.ts: brukerens
// egen session via createSupabaseServerClient, RLS gjelder, service_role brukes
// aldri. Hvert kall returnerer ok/feil eksplisitt — siden viser feil som feil.
//
// Leser findings ⋈ reports direkte (grants fra migrasjon 0008). Viewene
// v_anakin_content_radar / v_indigo_findings er ikke tilgjengelige for
// authenticated og trengs ikke: story utledes av report_type i radar.ts.

import { createSupabaseServerClient } from "./auth-server"
import { classifyError, type ReadError } from "./eiere-server"
import {
  agentsFor,
  sinceDate,
  type AgentId,
  type FindingRow,
  type RadarFilters,
  type ReportHead,
} from "./radar"

function fail(message: string): ReadError {
  return { ok: false, error: message, code: classifyError(message) }
}

type RawRow = Omit<FindingRow, "report"> & {
  reports: ReportHead | ReportHead[] | null
}

function normalize(row: RawRow): FindingRow | null {
  const rep = Array.isArray(row.reports) ? row.reports[0] : row.reports
  if (!rep) return null
  const { reports: _drop, ...rest } = row
  return { ...rest, report: rep }
}

export type FindingsResult = { ok: true; rows: FindingRow[] } | ReadError

export const FINDINGS_PER_AGENT = 40

/**
 * Siste funn for én agent innenfor periode/kind-filteret, nyeste foerst.
 * Kuttes til FINDINGS_PER_AGENT — kolonnen er en radar, ikke et arkiv.
 */
export async function fetchFindingsForAgent(
  agentId: AgentId,
  filters: RadarFilters,
  limit: number = FINDINGS_PER_AGENT,
  now: Date = new Date(),
): Promise<FindingsResult> {
  const supabase = createSupabaseServerClient()
  let q = supabase
    .from("findings")
    .select(
      "id, kind, claim, evidence, source_url, confidence, created_at, reports!inner(id, agent_id, report_type, period, status, requires_review, created_at)",
    )
    .eq("reports.agent_id", agentId)
    .gte("reports.period", sinceDate(filters.periode, now))
    .order("created_at", { ascending: false })
    .limit(limit)
  if (filters.kind) q = q.eq("kind", filters.kind)

  const { data, error } = await q
  if (error) return fail(error.message)
  const rows = ((data ?? []) as unknown as RawRow[])
    .map(normalize)
    .filter((r): r is FindingRow => r !== null)
  return { ok: true, rows }
}

/** Én spoerring per valgt agent, parallelt. */
export async function fetchFindings(
  filters: RadarFilters,
  limit: number = FINDINGS_PER_AGENT,
): Promise<Record<AgentId, FindingsResult>> {
  const agents = agentsFor(filters.agent)
  const results = await Promise.all(
    agents.map((a) => fetchFindingsForAgent(a, filters, limit)),
  )
  const out = {} as Record<AgentId, FindingsResult>
  agents.forEach((a, i) => {
    out[a] = results[i]
  })
  return out
}

export type LatestReportResult =
  | { ok: true; report: ReportHead | null }
  | ReadError

/** Nyeste rapport for en agent uansett type — grunnlag for ferskhet. */
export async function fetchLatestReportHead(
  agentId: AgentId,
): Promise<LatestReportResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, agent_id, report_type, period, status, requires_review, created_at",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return fail(error.message)
  return { ok: true, report: (data as ReportHead | null) ?? null }
}
