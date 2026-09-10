// Radar (/radar). Rene typer og hjelpere — ingen Next- eller Supabase-importer,
// slik at sidens tester kan bruke fila. Databasen leses i radar-server.ts.
//
// Kilden er det som FAKTISK ligger i Detox-basen (kwrjhyytvbcaiszbfria) per
// 2026-09-10: findings + reports (lest med eierens session, migrasjon 0008).
// Viewene v_anakin_content_radar / v_indigo_findings har kun grants til
// postgres + service_role, og brukes derfor ikke herfra — samme rader naas
// via findings ⋈ reports uten ny migrasjon.

export const DETOX_PROJECT_REF = "kwrjhyytvbcaiszbfria"

export const AGENTS = {
  "agent-anakinbot": { key: "anakin", label: "Anakin", role: "marked" },
  "agent-indigobot": { key: "indigo", label: "Indigo", role: "research" },
} as const

export type AgentId = keyof typeof AGENTS
export const AGENT_IDS = Object.keys(AGENTS) as AgentId[]

export type AgentFilter = "alle" | "anakin" | "indigo"
export type PeriodFilter = "7d" | "30d"

export const PERIOD_DAYS: Record<PeriodFilter, number> = { "7d": 7, "30d": 30 }

/** Indigos research-kinds + Anakins content-radar-kinds, slik de finnes i basen. */
export const KINDS = [
  "change",
  "breakthrough",
  "contradiction",
  "emerging",
  "watch",
  "gap",
  "trend",
  "signal",
  "risk",
  "competitor",
] as const

export const KIND_LABELS: Record<string, string> = {
  change: "endring",
  breakthrough: "gjennombrudd",
  contradiction: "motsigelse",
  emerging: "paa vei",
  watch: "foelg med",
  gap: "hull",
  trend: "trend",
  signal: "signal",
  risk: "risiko",
  competitor: "konkurrent",
}

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

export type RadarFilters = {
  agent: AgentFilter
  periode: PeriodFilter
  kind: string | null
}

export const DEFAULT_FILTERS: RadarFilters = {
  agent: "alle",
  periode: "7d",
  kind: null,
}

type SearchParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === "string" && s.length > 0 ? s : null
}

/** Ukjente verdier faller tilbake til default — aldri en feil paa en lesing. */
export function parseFilters(sp: SearchParams | undefined): RadarFilters {
  const agent = first(sp?.agent)
  const periode = first(sp?.periode)
  const kind = first(sp?.kind)
  return {
    agent: agent === "anakin" || agent === "indigo" ? agent : "alle",
    periode: periode === "30d" ? "30d" : "7d",
    kind:
      kind !== null && (KINDS as readonly string[]).includes(kind)
        ? kind
        : null,
  }
}

export function agentsFor(filter: AgentFilter): AgentId[] {
  if (filter === "anakin") return ["agent-anakinbot"]
  if (filter === "indigo") return ["agent-indigobot"]
  return [...AGENT_IDS]
}

/** YYYY-MM-DD, `days` dager tilbake fra `now` (UTC-dato — samme som reports.period). */
export function sinceDate(
  periode: PeriodFilter,
  now: Date = new Date(),
): string {
  const d = new Date(now.getTime() - PERIOD_DAYS[periode] * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** Lenke med filtre — bare avvik fra default havner i URL-en. */
export function filterHref(filters: RadarFilters, base = "/radar"): string {
  const q = new URLSearchParams()
  if (filters.agent !== "alle") q.set("agent", filters.agent)
  if (filters.periode !== "7d") q.set("periode", filters.periode)
  if (filters.kind) q.set("kind", filters.kind)
  const s = q.toString()
  return s ? `${base}?${s}` : base
}

// ── Rader slik de kommer fra findings ⋈ reports ─────────────────────────────

export type ReportHead = {
  id: string
  agent_id: string
  report_type: string
  period: string
  status: string
  requires_review: boolean
  created_at: string
}

export type FindingRow = {
  id: string
  kind: string
  claim: string
  evidence: string | null
  source_url: string | null
  confidence: number | string | null
  created_at: string
  report: ReportHead
}

/** "nightly-harvest:magnesium-sleep" → "magnesium-sleep"; alt annet → null. */
export function storyOf(reportType: string | null | undefined): string | null {
  if (!reportType) return null
  const i = reportType.indexOf(":")
  return i > 0 && i < reportType.length - 1 ? reportType.slice(i + 1) : null
}

export function confidenceLabel(c: FindingRow["confidence"]): string | null {
  if (c === null || c === undefined || c === "") return null
  const n = typeof c === "string" ? Number(c) : c
  if (!Number.isFinite(n)) return String(c)
  return n <= 1 ? `${Math.round(n * 100)} %` : String(n)
}

export function groupByAgent(
  rows: readonly FindingRow[],
): Record<AgentId, FindingRow[]> {
  const out: Record<AgentId, FindingRow[]> = {
    "agent-anakinbot": [],
    "agent-indigobot": [],
  }
  for (const r of rows) {
    const a = r.report.agent_id as AgentId
    if (a in out) out[a].push(r)
  }
  return out
}

// ── Ferskhet ─────────────────────────────────────────────────────────────────

export type Freshness = {
  variant: "success" | "warning" | "error"
  label: string
  ageH: number | null
}

/** Fersk ≤ 24 t, eldre ≤ 48 t, ellers STALE. Ingen rapport = STALE. */
export function freshnessOf(
  lastCreatedAt: string | null,
  nowMs: number = Date.now(),
): Freshness {
  if (!lastCreatedAt)
    return { variant: "error", label: "STALE — ingen rapport", ageH: null }
  const t = new Date(lastCreatedAt).getTime()
  if (Number.isNaN(t))
    return { variant: "error", label: "STALE — ukjent tidspunkt", ageH: null }
  const ageH = (nowMs - t) / 3_600_000
  if (ageH <= 24) return { variant: "success", label: "Fersk", ageH }
  if (ageH <= 48) return { variant: "warning", label: "Eldre enn 24 t", ageH }
  return { variant: "error", label: "STALE — ingen rapport siste 48 t", ageH }
}

export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "ukjent"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "ukjent" : d.toLocaleString("nb-NO")
}
