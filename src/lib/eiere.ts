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
  /** Anakins svar (PATCH fra Hermes). Kolonnene kom 2026-09-11; eldre
   *  lesninger kan mangle dem, derfor valgfrie. responded_at settes av
   *  trigger trg_set_responded_at i basen — aldri av dashboardet. */
  response?: string | null
  responded_at?: string | null
  /** Tråd: rot-raden har thread_id null; svar i tråden peker på roten
   *  (thread_id) og på raden de svarer på (parent_id). */
  thread_id?: string | null
  parent_id?: string | null
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
const REVENUE_DELTA_RE = new RegExp(
  `omsetning\\s*${PCT}|${PCT}\\s*omsetning`,
  "i",
)
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

export function isPulsFinding(
  f: Pick<RadarFinding, "kind" | "claim">,
): boolean {
  return (
    (PULS_KINDS as readonly string[]).includes(f.kind) &&
    /salgspuls/i.test(f.claim)
  )
}

export function findPuls(findings: readonly RadarFinding[]): PulsResult {
  const f = findings.find(isPulsFinding)
  if (!f) return { ok: false, reason: "no_signal" }
  const puls = parsePulsClaim(f.claim)
  if (!puls)
    return { ok: false, reason: "unparsable", findingId: f.id, raw: f.claim }
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

/** Prosent endring fra prev til cur, i prosentenheter. null naar prev er 0. */
export function deltaPct(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

// ── Profitt: snittordreverdi (AOV) beregnet av pulsen ────────────────────────
// Anakin oppgir AOV bare noen dager, og aldri for forrige uke. Vi regner den
// ut av tallene som finnes (omsetning / ordrer) og merker den som beregnet.

export type Aov = {
  aov: number | null
  aovPrev: number | null
  aovDeltaPct: number | null
}

export function aovOf(p: Puls): Aov {
  const aov = p.orders7d > 0 ? p.revenue7d / p.orders7d : null
  const aovPrev = p.ordersPrev > 0 ? p.revenuePrev / p.ordersPrev : null
  return {
    aov,
    aovPrev,
    aovDeltaPct:
      aov !== null && aovPrev !== null ? deltaPct(aov, aovPrev) : null,
  }
}

// ── PULS-historikk: én puls per radar-dag ────────────────────────────────────
// Hver nattlige radar baerer sin egen "siste 7 dager"-puls. Lagt etter
// hverandre gir de en rullerende ukestrend. Rapporter uten parsebar puls
// hoppes over, og en gjentatt identisk maaling (Anakin gjentok 08.09-pulsen
// ordrett 09.09) telles én gang — en kopi er ikke en ny lesing.

export type PulsPoint = { period: string; puls: Puls }

export function samePuls(a: Puls, b: Puls): boolean {
  return (
    a.orders7d === b.orders7d &&
    a.revenue7d === b.revenue7d &&
    a.ordersPrev === b.ordersPrev &&
    a.revenuePrev === b.revenuePrev
  )
}

export function pulsHistoryOf(
  reports: readonly { period: string; findings: readonly RadarFinding[] }[],
): PulsPoint[] {
  // Foerste rapport per periode vinner (input er nyeste foerst).
  const byPeriod = new Map<string, Puls>()
  for (const r of reports) {
    if (byPeriod.has(r.period)) continue
    const res = findPuls(r.findings)
    if (res.ok) byPeriod.set(r.period, res.puls)
  }
  const sorted = Array.from(byPeriod.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  const out: PulsPoint[] = []
  for (const [period, puls] of sorted) {
    const prev = out[out.length - 1]
    if (prev && samePuls(prev.puls, puls)) continue
    out.push({ period, puls })
  }
  return out
}

/** "2026-09-10" -> "10.09" for akser. Ukjent format vises som det er. */
export function shortDate(period: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(period)
  return m ? `${m[2]}.${m[1]}` : period
}

// ── Grafgeometri (ren matematikk, SVG tegnes i PulsChart.tsx) ────────────────

/** Soeylehoeyder proporsjonalt med stoerste verdi; alle 0 naar ingenting er > 0. */
export function scaleBars(values: readonly number[], height: number): number[] {
  const max = Math.max(0, ...values)
  return values.map((v) => (max > 0 && v > 0 ? (v / max) * height : 0))
}

export type LinePath = {
  d: string
  coords: [number, number][]
  min: number
  max: number
}

/**
 * Polylinje for en serie i et w×h-omraade. Flat serie legges midt i hoeyden.
 * null ved faerre enn to punkter — da finnes det ingen linje aa tegne.
 */
export function linePath(
  values: readonly number[],
  width: number,
  height: number,
  pad = 4,
): LinePath | null {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const coords: [number, number][] = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * innerW
    const y = span > 0 ? pad + (1 - (v - min) / span) * innerH : height / 2
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
  })
  const d = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ")
  return { d, coords, min, max }
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
  const n =
    typeof f.confidence === "string" ? Number(f.confidence) : f.confidence
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

// ── Plan: neste trekk + resten av anbefalingene ──────────────────────────────
// recommendations har ingen prioritetskolonne. Prioritet utledes av tallet i
// spor-prefikset (A1/B1 foer A2/B2); anbefalinger uten prefiks er Anakins
// konkrete, ofte tidskritiske punkter og rangeres foerst, i den rekkefoelgen
// de ble skrevet. Kun pending vises som plan — avgjorte telles.

const TRACK_NUM_RE = /^[AB](\d+)/

/** 0 for anbefalinger uten spor-prefiks, ellers tallet i prefikset. */
export function trackRank(action: string): number {
  const m = TRACK_NUM_RE.exec(stripApprovalMark(action))
  return m ? Number(m[1]) : 0
}

export const NEXT_MOVES = 3

export type Plan = {
  neste: RadarRecommendation[]
  sporA: RadarRecommendation[]
  sporB: RadarRecommendation[]
  utenSpor: RadarRecommendation[]
  /** approved/rejected/deferred — vises som tall, ikke som liste. */
  avgjort: number
}

export function planOf(report: RadarReport, n: number = NEXT_MOVES): Plan {
  const pending = report.recommendations
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "pending")
    .sort((a, b) => trackRank(a.r.action) - trackRank(b.r.action) || a.i - b.i)
    .map(({ r }) => r)
  const neste = pending.slice(0, n)
  const rest = pending.slice(n)
  const sporA: RadarRecommendation[] = []
  const sporB: RadarRecommendation[] = []
  const utenSpor: RadarRecommendation[] = []
  for (const r of rest) {
    const t = trackOf(r.action)
    if (t === "A") sporA.push(r)
    else if (t === "B") sporB.push(r)
    else utenSpor.push(r)
  }
  return {
    neste,
    sporA,
    sporB,
    utenSpor,
    avgjort: report.recommendations.length - pending.length,
  }
}

// ── Forespoersler (requests) ─────────────────────────────────────────────────
// requests har kolonnene requester, kind (research|content|followup), body,
// status (open|in_progress|done|cancelled). Typen (generate_week …) finnes
// ikke som kolonne og kodes derfor i body-ens foerste linje. Ingen
// skjema-endring for dette.
//
// Typer med `ref` peker paa én konkret rad (anbefaling, funn eller
// innholdselement). Teksten leses av serveren fra basen — klienten sender
// bare id-en. Typer uten ref er generelle knapper.

export const REQUEST_TYPES = {
  generate_week: {
    label: "Neste ukes innhold",
    kind: "content",
    ref: null,
    prompt:
      "Lag forslag til neste ukes innhold (spor A Anniken / spor B Detox) basert på siste Content Radar. Kun utkast — publiser ingenting.",
  },
  draft_email: {
    label: "E-postutkast",
    kind: "content",
    ref: null,
    prompt:
      "Lag utkast til neste Klaviyo-e-post basert på siste Content Radar. Kun utkast — ikke send, ikke opprett kampanje.",
  },
  find_idea: {
    label: "Finn neste idé",
    kind: "research",
    ref: null,
    prompt:
      "Finn den neste innholdsidéen (spor A Anniken eller spor B Detox) ut fra siste Content Radar og salgspuls. Kun forslag med begrunnelse — publiser ingenting.",
  },
  refresh_puls: {
    label: "Oppdater salgspuls",
    kind: "followup",
    ref: null,
    prompt:
      "Les Shopify på nytt og skriv en fersk salgspuls (siste 7 dager mot uken før: ordrer, omsetning, snittordreverdi) som nytt funn. Kun lesing — endre ingenting i Shopify.",
  },
  do_recommendation: {
    label: "Gjør anbefaling",
    kind: "content",
    ref: "recommendations",
    prompt:
      "Gjør denne anbefalingen fra Content Radar: forbered og lag utkast. Publiser og send ingenting uten godkjenning.",
  },
  explain_finding: {
    label: "Forklar funn",
    kind: "research",
    ref: "findings",
    prompt:
      "Forklar dette funnet fra Content Radar for eierne: hva betyr det for Detox, og hva bør vi gjøre? Kun forklaring — ingen handling.",
  },
  draft_content: {
    label: "Utkast til innhold",
    kind: "content",
    ref: "content_items",
    prompt:
      "Lag utkast til dette innholdselementet i Annikens stemme. Kun utkast — publiser ingenting.",
  },
  // «Snakk om dette» (Vei A): raden er kontekst-baereren for en samtale som
  // fortsetter i Telegram. Anakin holder den in_progress og slaar opp nyeste
  // aktive traad naar eieren skriver uten saks-id. Eieren lukker den (done)
  // fra dashboardet. ref kan peke paa hvilken som helst av tabellene, eller
  // ingen (fortsettelse av en traad).
  chat_thread: {
    label: "Samtale",
    kind: "followup",
    ref: "any",
    prompt:
      "Eieren åpner Telegram nå for å snakke om dette. Svar på det de skriver der, med denne konteksten. Publiser og send ingenting uten godkjenning.",
  },
} as const

export type RequestType = keyof typeof REQUEST_TYPES

export type RefTable = "recommendations" | "findings" | "content_items"

export const REF_TABLES: readonly RefTable[] = [
  "recommendations",
  "findings",
  "content_items",
]

export function isRefTable(v: unknown): v is RefTable {
  return typeof v === "string" && (REF_TABLES as readonly string[]).includes(v)
}

export type RefRequestType = {
  [K in RequestType]: (typeof REQUEST_TYPES)[K]["ref"] extends RefTable
    ? K
    : never
}[RequestType]

export const CHAT_THREAD_TYPE = "chat_thread" satisfies RequestType

export type GenericRequestType = Exclude<
  RequestType,
  RefRequestType | typeof CHAT_THREAD_TYPE
>

export function isRequestType(v: unknown): v is RequestType {
  return (
    typeof v === "string" &&
    Object.prototype.hasOwnProperty.call(REQUEST_TYPES, v)
  )
}

export function isRefRequestType(v: unknown): v is RefRequestType {
  return isRequestType(v) && REQUEST_TYPES[v].ref !== null
}

/** Knappene som ikke trenger en rad aa peke paa (samtalen har egen knapp). */
export const GENERIC_REQUEST_TYPES = (
  Object.keys(REQUEST_TYPES) as RequestType[]
).filter((t): t is GenericRequestType => REQUEST_TYPES[t].ref === null)

/** Hvor mange tegn av anbefalingen/funnet som tas med i forespoerselen. */
export const REF_TEXT_MAX = 600

export function clipText(text: string, max: number = REF_TEXT_MAX): string {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

const BODY_HEAD_RE =
  /^\[([a-z_]+)\]\s+til:\s*(\S+)(?:\s+·\s+radar\s+(\S+))?(?:\s+·\s+ref\s+(\S+))?/i

/** Foerste linje er den deterministiske noekkelen; resten er tekst til Anakin. */
export function requestBodyHead(
  type: RequestType,
  period: string | null,
  ref: string | null = null,
): string {
  return `[${type}] til: ${ANAKIN_AGENT_ID}${period ? ` · radar ${period}` : ""}${ref ? ` · ref ${ref}` : ""}`
}

/** "recommendations/3f2a…" — tabell + id, slik det staar i hodet. */
export function refKey(table: RefTable, id: string): string {
  return `${table}/${id}`
}

export function buildRequestBody(input: {
  type: RequestType
  period: string | null
  requestedBy: string
  /** Paakrevd for typer med ref: raden det gjelder og teksten fra basen. */
  ref?: { key: string; text: string }
}): string {
  const def = REQUEST_TYPES[input.type]
  const lines = [
    requestBodyHead(input.type, input.period, input.ref?.key ?? null),
  ]
  if (input.ref) {
    lines.push(
      `${def.prompt}${input.period ? ` (Content Radar ${input.period})` : ""}`,
      `«${clipText(input.ref.text)}»`,
    )
  } else {
    lines.push(def.prompt)
  }
  lines.push(`Bestilt fra detox-os-dashboard /eiere av ${input.requestedBy}.`)
  return lines.join("\n")
}

/**
 * Kroppen til en «Snakk om dette»-rad. Hodet er noekkelen (idempotens per
 * element); resten er konteksten Anakin trenger foer eieren aapner Telegram.
 * Maa inneholde agent-anakinbot (webhook-filteret er body-styrt) — det gjoer
 * hodet. Ingen delivery_id: den finnes bare inne i Hermes.
 */
export function buildChatThreadBody(input: {
  period: string | null
  requestedBy: string
  /** Elementet samtalen gjelder — utelatt naar traaden bare fortsettes. */
  ref?: { key: string; text: string }
  /** Sist i traaden, naar samtalen fortsetter en eksisterende traad. */
  continues?: { threadId: string; parentId: string }
}): string {
  const def = REQUEST_TYPES[CHAT_THREAD_TYPE]
  const lines = [
    requestBodyHead(CHAT_THREAD_TYPE, input.period, input.ref?.key ?? null),
    def.prompt,
  ]
  if (input.ref) lines.push(`Kontekst: «${clipText(input.ref.text)}»`)
  if (input.continues)
    lines.push(
      `Fortsetter tråd ${input.continues.threadId} (svar på ${input.continues.parentId}).`,
    )
  lines.push(
    `Startet fra detox-os-dashboard /eiere av ${input.requestedBy}. Eieren skriver fritt i Telegram; dette er saken.`,
  )
  return lines.join("\n")
}

export type ParsedRequestBody = {
  type: RequestType | null
  to: string | null
  period: string | null
  ref: string | null
  summary: string
}

export function parseRequestBody(body: string): ParsedRequestBody {
  const lines = body.split("\n")
  const m = BODY_HEAD_RE.exec(lines[0] ?? "")
  if (!m) {
    return {
      type: null,
      to: null,
      period: null,
      ref: null,
      summary: body.trim(),
    }
  }
  const type = isRequestType(m[1]) ? m[1] : null
  return {
    type,
    to: m[2] ?? null,
    period: m[3] ?? null,
    ref: m[4] ?? null,
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
  ref: string | null = null,
): RequestRow | null {
  const head = requestBodyHead(type, period, ref)
  return (
    rows.find((r) => isInQueue(r) && r.body.split("\n")[0] === head) ?? null
  )
}

// ── Beslutninger paa koeen: kun status-kolonnen roeres ──────────────────────

export const DECISIONS = {
  godkjenn: { status: "done", label: "Godkjenn", scope: "action:approve" },
  avvis: { status: "cancelled", label: "Avvis", scope: "action:approve" },
  lest: { status: "in_progress", label: "Marker lest", scope: "work:write" },
} as const

export type Decision = keyof typeof DECISIONS

export function isDecision(v: unknown): v is Decision {
  return (
    typeof v === "string" && Object.prototype.hasOwnProperty.call(DECISIONS, v)
  )
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "venter",
  in_progress: "lest / paagaar",
  done: "godkjent",
  cancelled: "avvist",
}

/** Samme statuser, sett fra en samtale. */
export const THREAD_STATUS_LABELS: Record<string, string> = {
  open: "venter på Anakin",
  in_progress: "pågår",
  done: "lukket",
  cancelled: "avvist",
}

// ── Svar og traader ──────────────────────────────────────────────────────────
// Anakin skriver svaret i samme rad (response) og databasen stempler
// responded_at. Koeen viser bare rader uten svar; alt med svar — eller som
// hoerer til en traad — vises som samtaler, nyeste aktivitet foerst. Traaden
// er thread_id (roten selv har null, saa noekkelen er thread_id ?? id).

/** Siste aktivitet: svartidspunkt om det finnes, ellers opprettelse. */
export function activityAt(r: RequestRow): string {
  return r.responded_at ?? r.created_at
}

export function threadKeyOf(r: Pick<RequestRow, "id" | "thread_id">): string {
  return r.thread_id ?? r.id
}

export function hasResponse(r: Pick<RequestRow, "response">): boolean {
  return typeof r.response === "string" && r.response.trim() !== ""
}

export type Thread = {
  key: string
  /** Meldingene i den rekkefoelgen de ble skrevet. */
  messages: RequestRow[]
  root: RequestRow
  last: RequestRow
  lastActivity: string
  /** Traaden lever saa lenge en rad i den fortsatt er open/in_progress. */
  active: boolean
  /** Raden eieren lukker for aa avslutte traaden (nyeste aktive). */
  closeTarget: RequestRow | null
}

export function threadsOf(rows: readonly RequestRow[]): Thread[] {
  const byKey = new Map<string, RequestRow[]>()
  for (const r of rows) {
    const k = threadKeyOf(r)
    const list = byKey.get(k)
    if (list) list.push(r)
    else byKey.set(k, [r])
  }
  const threads: Thread[] = []
  for (const [key, list] of Array.from(byKey.entries())) {
    const messages = [...list].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )
    const root = messages.find((m) => m.id === key) ?? messages[0]
    const lastActivity = messages
      .map(activityAt)
      .reduce((a, b) => (b.localeCompare(a) > 0 ? b : a))
    const activeRows = messages.filter(isInQueue)
    const closeTarget =
      activeRows.length === 0
        ? null
        : activeRows.reduce((a, b) =>
            activityAt(b).localeCompare(activityAt(a)) > 0 ? b : a,
          )
    threads.push({
      key,
      messages,
      root,
      last: messages[messages.length - 1],
      lastActivity,
      active: activeRows.length > 0,
      closeTarget,
    })
  }
  return threads.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}

/** Det siste Anakin sa i traaden — overskriften i lista. null = ingen svar ennaa. */
export function latestResponse(t: Thread): RequestRow | null {
  for (let i = t.messages.length - 1; i >= 0; i--) {
    if (hasResponse(t.messages[i])) return t.messages[i]
  }
  return null
}

export const EXCERPT_MAX = 160

/** Én linje av en lengre tekst — til overskriften foer «Åpne». */
export function excerpt(text: string, max: number = EXCERPT_MAX): string {
  return clipText(text, max)
}

/**
 * Elementer (ref-noekler) som allerede har en aapen/paagaaende samtale — da
 * viser knappen «samtale pågår» i stedet for aa lage en ny rad. Samme
 * idempotens som serveren, bare synlig foer klikket.
 */
export function activeChatRefs(rows: readonly RequestRow[]): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    if (!isInQueue(r)) continue
    const p = parseRequestBody(r.body)
    if (p.type === CHAT_THREAD_TYPE && p.ref) out.add(p.ref)
  }
  return out
}

// ── Telegram: lenke eller ferdig tekst — dashboardet sender aldri selv ──────

export function telegramHref(
  botUsername: string | undefined | null,
): string | null {
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
