// Eier-oversikt (/eiere). Rene typer, parsere og mapping — ingen Next- eller
// Supabase-importer, slik at klientkomponenter og tester kan bruke fila.
// Databasen leses i eiere-server.ts, skrives i app/(main)/eiere/actions.ts.
//
// Kilde for alt her er det som FAKTISK ligger i Detox-basen
// (kwrjhyytvbcaiszbfria) per 2026-09-08 — se supabase/migrations/0008 og
// grok/inbox/fra-claude-eiere-v1-2026-09-08.md i mindmatter-icm.

export const DETOX_PROJECT_REF = "kwrjhyytvbcaiszbfria"
export const ANAKIN_AGENT_ID = "agent-anakinbot"
export const RADAR_REPORT_TYPE = "content-radar"

// ── Rader slik de ligger i basen ─────────────────────────────────────────────

export type RadarFinding = {
  id: string
  kind: string
  claim: string
  evidence: string | null
  source_url: string | null
  confidence: number | string | null
  created_at: string
}

export type RadarRecommendation = {
  id: string
  kind: string
  action: string
  status: "pending" | "approved" | "rejected" | "deferred" | string
  owner: string | null
  created_at: string
}

export type RadarReport = {
  id: string
  agent_id: string
  report_type: string
  period: string
  status: string
  requires_review: boolean
  created_at: string
  findings: RadarFinding[]
  recommendations: RadarRecommendation[]
}

export type RequestRow = {
  id: string
  requester: string
  kind: "research" | "content" | "followup" | string
  body: string
  status: "open" | "in_progress" | "done" | "cancelled" | string
  created_at: string
}

export type RunStateRow = {
  agent_id: string
  last_successful_run: string | null
  last_run_status: string | null
  last_error: string | null
  updated_at: string
}

// ── PULS ─────────────────────────────────────────────────────────────────────
// Anakin skriver salgspulsen som prosa i ett findings-element (kind=signal):
//   "Detox.no salgspuls (LIVE via Shopify, 05:30 UTC 2026-09-08): siste 7 dager
//    (01.09-08.09, Europe/Amsterdam) 174 ordrer / 195 408,30 NOK mot 179 ordrer
//    / 193 818,05 NOK uken før (25.08-01.09) — omsetning +0,8 %, ordrer -2,8 %, …"
// Fra 2026-09-10 skriver Anakin ogsaa en kortform som kind=data:
//   "Salgspuls ned denne uken: 03.09–10.09 = 165 ordrer / 181 704 NOK / AOV
//    1 101 NOK vs forrige uke 27.08–03.09 = 183 / 206 724 (−9,8 % ordrer,
//    −12,1 % omsetning). …"
// Basen har ingen strukturert kolonne for dette. Vi parser defensivt (begge
// formatene) og viser raa tekst naar ingen treffer — aldri et gjettet tall.

export type Puls = {
  orders7d: number
  revenue7d: number
  ordersPrev: number
  revenuePrev: number
  /** Prosent slik Anakin oppgir den, f.eks. 0.8 eller -2.8. null = ikke oppgitt. */
  revenueDeltaPct: number | null
  ordersDeltaPct: number | null
}

export type PulsResult =
  | { ok: true; puls: Puls; findingId: string; raw: string }
  | { ok: false; reason: "no_signal" }
  | { ok: false; reason: "unparsable"; findingId: string; raw: string }

const NBSP = /[\s  ]/g

/** "195 408,30" -> 195408.3, "+0,8" -> 0.8, "−2,8" -> -2.8 */
export function parseNorwegianNumber(s: string): number | null {
  const cleaned = s.replace(NBSP, "").replace("−", "-").replace(",", ".")
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const PULS_RE =
  /siste 7 dager\s*(?:\([^)]*\))?\s*(\d[\d\s  ]*)\s*ordrer\s*\/\s*([\d\s  ]+(?:,\d+)?)\s*NOK\s+mot\s+(\d[\d\s  ]*)\s*ordrer\s*\/\s*([\d\s  ]+(?:,\d+)?)\s*NOK\s+uken f[øo]r/i
// Kortformen (2026-09-10+): "dd.mm–dd.mm = N ordrer / X NOK [/ AOV Y NOK]
// vs forrige uke [dd.mm–dd.mm] = M [ordrer] / Z [NOK]".
const PULS_RE_V2 =
  /\d{2}\.\d{2}\s*[–-]\s*\d{2}\.\d{2}\s*=\s*(\d[\d\s  ]*)\s*ordrer\s*\/\s*([\d\s  ]+(?:,\d+)?)\s*NOK(?:\s*\/\s*AOV\s*[\d\s  ]+(?:,\d+)?\s*NOK)?\s*vs\.?\s*forrige uke\s*(?:\d{2}\.\d{2}\s*[–-]\s*\d{2}\.\d{2})?\s*=\s*(\d[\d\s  ]*?)\s*(?:ordrer\s*)?\/\s*([\d\s  ]+(?:,\d+)?)/i

// Prosent kan staa etter ordet ("omsetning +0,8 %") eller foer ("−12,1 % omsetning").
const PCT = "([+\\-−]?\\d+(?:,\\d+)?)\\s*%"
const REVENUE_DELTA_RE = new RegExp(`omsetning\\s*${PCT}|${PCT}\\s*omsetning`, "i")
const ORDERS_DELTA_RE = new RegExp(`ordrer\\s*${PCT}|${PCT}\\s*ordrer`, "i")

function deltaOf(re: RegExp, claim: string): number | null {
  const m = re.exec(claim)
  if (!m) return null
  const raw = m[1] ?? m[2]
  return raw ? parseNorwegianNumber(raw) : null
}

export function parsePulsClaim(claim: string): Puls | null {
  const m = PULS_RE.exec(claim) ?? PULS_RE_V2.exec(claim)
  if (!m) return null
  const orders7d = parseNorwegianNumber(m[1])
  const revenue7d = parseNorwegianNumber(m[2])
  const ordersPrev = parseNorwegianNumber(m[3])
  const revenuePrev = parseNorwegianNumber(m[4])
  if (
    orders7d === null ||
    revenue7d === null ||
    ordersPrev === null ||
    revenuePrev === null
  )
    return null
  return {
    orders7d,
    revenue7d,
    ordersPrev,
    revenuePrev,
    revenueDeltaPct: deltaOf(REVENUE_DELTA_RE, claim),
    ordersDeltaPct: deltaOf(ORDERS_DELTA_RE, claim),
  }
}

/** Pulsen ligger som kind=signal (klassisk) eller kind=data (kortform fra 10.09). */
export const PULS_KINDS = ["signal", "data"] as const

export function isPulsFinding(f: Pick<RadarFinding, "kind" | "claim">): boolean {
  return (PULS_KINDS as readonly string[]).includes(f.kind) && /salgspuls/i.test(f.claim)
}

export function findPuls(findings: readonly RadarFinding[]): PulsResult {
  const f = findings.find(isPulsFinding)
  if (!f) return { ok: false, reason: "no_signal" }
  const puls = parsePulsClaim(f.claim)
  if (!puls) return { ok: false, reason: "unparsable", findingId: f.id, raw: f.claim }
  return { ok: true, puls, findingId: f.id, raw: f.claim }
}

/** "+0,8 %" / "-2,8 %" / "—" for visning. */
export function pctLabel(pct: number | null): string {
  if (pct === null) return "—"
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : ""
  return `${sign}${Math.abs(pct).toLocaleString("nb-NO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

// ── Briefing: funn + spor A/B + neste steg ───────────────────────────────────
// Spor staar som prefiks i recommendations.action ("A1 refleksiv …",
// "B2 tillits-karusell …"), eventuelt bak "[KREVER GODKJENNING] ". Rapporter
// 01.–06.09 har ikke prefiks; de havner i "uten spor" og skjules ikke.

export const APPROVAL_MARK = "[KREVER GODKJENNING]"
const APPROVAL_RE = /^\s*\[KREVER GODKJENNING\]\s*/i
const TRACK_RE = /^([AB])\d/

export function requiresApproval(text: string): boolean {
  return text.toUpperCase().includes(APPROVAL_MARK)
}

export function stripApprovalMark(text: string): string {
  return text.replace(APPROVAL_RE, "")
}

export type Track = "A" | "B" | null

export function trackOf(action: string): Track {
  const m = TRACK_RE.exec(stripApprovalMark(action))
  return m ? (m[1] as "A" | "B") : null
}

export type Briefing = {
  funn: RadarFinding[]
  sporA: RadarRecommendation[]
  sporB: RadarRecommendation[]
  nesteSteg: RadarRecommendation[]
}

function confidenceOf(f: RadarFinding): number {
  const n = typeof f.confidence === "string" ? Number(f.confidence) : f.confidence
  return typeof n === "number" && Number.isFinite(n) ? n : -1
}

/** Tre viktigste funn = hoeyest confidence, pulsen unntatt; likt = innsettingsrekkefoelge. */
export function briefingOf(report: RadarReport): Briefing {
  const funn = report.findings
    .filter((f) => !isPulsFinding(f))
    .map((f, i) => ({ f, i }))
    .sort((a, b) => confidenceOf(b.f) - confidenceOf(a.f) || a.i - b.i)
    .slice(0, 3)
    .map(({ f }) => f)

  const sporA: RadarRecommendation[] = []
  const sporB: RadarRecommendation[] = []
  const nesteSteg: RadarRecommendation[] = []
  for (const r of report.recommendations) {
    const t = trackOf(r.action)
    if (t === "A") sporA.push(r)
    else if (t === "B") sporB.push(r)
    else nesteSteg.push(r)
  }
  return { funn, sporA, sporB, nesteSteg }
}

// ── Forespoersler (requests) ─────────────────────────────────────────────────
// requests har kolonnene requester, kind (research|content|followup), body,
// status (open|in_progress|done|cancelled). Typen generate_week / draft_email
// finnes ikke som kolonne og kodes derfor i body-ens foerste linje. Ingen
// skjema-endring for dette i v1.

export const REQUEST_TYPES = {
  generate_week: {
    label: "Neste ukes innhold",
    kind: "content",
    prompt:
      "Lag forslag til neste ukes innhold (spor A Anniken / spor B Detox) basert paa siste Content Radar. Kun utkast — publiser ingenting.",
  },
  draft_email: {
    label: "E-postutkast",
    kind: "content",
    prompt:
      "Lag utkast til neste Klaviyo-e-post basert paa siste Content Radar. Kun utkast — ikke send, ikke opprett kampanje.",
  },
} as const

export type RequestType = keyof typeof REQUEST_TYPES

export function isRequestType(v: unknown): v is RequestType {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(REQUEST_TYPES, v)
}

const BODY_HEAD_RE = /^\[([a-z_]+)\]\s+til:\s*(\S+)(?:\s+·\s+radar\s+(\S+))?/i

/** Foerste linje er den deterministiske noekkelen; resten er tekst til Anakin. */
export function requestBodyHead(type: RequestType, period: string | null): string {
  return `[${type}] til: ${ANAKIN_AGENT_ID}${period ? ` · radar ${period}` : ""}`
}

export function buildRequestBody(input: {
  type: RequestType
  period: string | null
  requestedBy: string
}): string {
  const def = REQUEST_TYPES[input.type]
  return [
    requestBodyHead(input.type, input.period),
    def.prompt,
    `Bestilt fra detox-os-dashboard /eiere av ${input.requestedBy}.`,
  ].join("\n")
}

export type ParsedRequestBody = {
  type: RequestType | null
  to: string | null
  period: string | null
  summary: string
}

export function parseRequestBody(body: string): ParsedRequestBody {
  const lines = body.split("\n")
  const m = BODY_HEAD_RE.exec(lines[0] ?? "")
  if (!m) {
    return { type: null, to: null, period: null, summary: body.trim() }
  }
  const type = isRequestType(m[1]) ? m[1] : null
  return {
    type,
    to: m[2] ?? null,
    period: m[3] ?? null,
    summary: lines.slice(1).join(" ").trim() || lines[0],
  }
}

export const QUEUE_STATUSES = ["open", "in_progress"] as const

export function isInQueue(r: Pick<RequestRow, "status">): boolean {
  return (QUEUE_STATUSES as readonly string[]).includes(r.status)
}

/**
 * Idempotens mot dobbeltklikk og mot to eiere som trykker samme dag: finnes det
 * allerede en aapen/paagaaende forespoersel med samme hode (type + radar-periode),
 * returneres den i stedet for aa lage en ny. Basen har ingen unik noekkel paa
 * dette, saa sjekken gjoeres foer insert (read-then-write; to eiere paa samme
 * millisekund er en akseptert rest-risiko for v1).
 */
export function findDuplicateRequest(
  rows: readonly RequestRow[],
  type: RequestType,
  period: string | null,
): RequestRow | null {
  const head = requestBodyHead(type, period)
  return rows.find((r) => isInQueue(r) && r.body.split("\n")[0] === head) ?? null
}

// ── Beslutninger paa koeen: kun status-kolonnen roeres ──────────────────────

export const DECISIONS = {
  godkjenn: { status: "done", label: "Godkjenn", scope: "action:approve" },
  avvis: { status: "cancelled", label: "Avvis", scope: "action:approve" },
  lest: { status: "in_progress", label: "Marker lest", scope: "work:write" },
} as const

export type Decision = keyof typeof DECISIONS

export function isDecision(v: unknown): v is Decision {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(DECISIONS, v)
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "venter",
  in_progress: "lest / paagaar",
  done: "godkjent",
  cancelled: "avvist",
}

// ── Telegram: lenke eller ferdig tekst — dashboardet sender aldri selv ──────

export function telegramHref(botUsername: string | undefined | null): string | null {
  const u = (botUsername ?? "").trim().replace(/^@/, "")
  return /^[A-Za-z0-9_]{3,64}$/.test(u) ? `https://t.me/${u}` : null
}

export function telegramText(r: RequestRow): string {
  const p = parseRequestBody(r.body)
  const label = p.type ? REQUEST_TYPES[p.type].label : r.kind
  return `Anakin, se request ${r.id} (${label}): ${p.summary}`
}

// ── Uken: content_items ──────────────────────────────────────────────────────
// content_items har ingen planlagt dato (kun created/updated/synced_at), saa
// "neste 7–14 dager" kan ikke utledes. Vi viser alle elementer under arbeid,
// buntet etter stage_status, og sier det rett ut i UI.

export type WeekBucket = "planlagt" | "venter" | "blokkert"

export function weekBucketOf(stageStatus: string): WeekBucket {
  if (stageStatus === "complete") return "planlagt"
  if (stageStatus === "blocked") return "blokkert"
  return "venter"
}

export const WEEK_BUCKET_LABELS: Record<WeekBucket, string> = {
  planlagt: "planlagt",
  venter: "venter",
  blokkert: "blokkert",
}
