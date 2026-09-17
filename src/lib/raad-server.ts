// Server-side lesing av annonse-raadene for forsiden. Samme moenster som
// radar-server.ts: brukerens egen session via createSupabaseServerClient, RLS
// gjelder, service_role brukes aldri. Grants: migrasjon 0008 (SELECT paa
// recommendations og reports for authenticated).
//
// Radene skrives av post_ads_report.py paa hub-en (mindmatter-brain), som
// henter fra ad-agenten hver natt. Dashbordet viser det systemet har levert —
// det gaar ikke selv til ad-agenten for raad. Det er forskjellen paa «Annonser»
// (tallene, via ad-backenden) og raadene (basen).

import { createSupabaseServerClient } from "./auth-server"
import { classifyError, type ReadError } from "./eiere-server"

export const ADS_AGENT_ID = "agent-ads"

/** Hvor mange ventende raad som leses. Forsiden viser de faa som er verdt et menneske. */
export const RAAD_ROWS = 60

export type RaadReport = {
  id: string
  agent_id: string
  report_type: string | null
  period: string | null
  created_at: string
}

export type RaadRad = {
  id: string
  kind: string
  action: string
  status: string
  owner: string | null
  created_at: string
  report: RaadReport
}

type RawRow = Omit<RaadRad, "report"> & {
  reports: RaadReport | RaadReport[] | null
}

function normalize(row: RawRow): RaadRad | null {
  const rep = Array.isArray(row.reports) ? row.reports[0] : row.reports
  if (!rep) return null
  const { reports: _drop, ...rest } = row
  return { ...rest, report: rep }
}

export type RaadResult = { ok: true; rows: RaadRad[] } | ReadError

/** Ventende raad fra annonsemotoren, nyeste foerst. Rangeringen gjoeres i dagens.ts. */
export async function fetchAnnonseRaad(
  limit: number = RAAD_ROWS,
): Promise<RaadResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("recommendations")
    .select(
      "id, kind, action, status, owner, created_at, reports!inner(id, agent_id, report_type, period, created_at)",
    )
    .eq("reports.agent_id", ADS_AGENT_ID)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return { ok: false, error: error.message, code: classifyError(error.message) }
  }
  const rows = ((data ?? []) as unknown as RawRow[])
    .map(normalize)
    .filter((r): r is RaadRad => r !== null)
  return { ok: true, rows }
}
