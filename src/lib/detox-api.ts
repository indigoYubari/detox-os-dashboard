export type Channel = "google_ads" | "meta" | "shopify" | "klaviyo"

export type DeltaValue = {
  abs: number
  pct: number | null
  dir: "up" | "down" | "flat"
}

export type ChannelTypeBreakdown = {
  entity_type: string
  rows: number
  spend: number
  revenue: number
  conversions: number
}

export type ChannelMetrics = {
  channel: Channel
  rows: number
  spend: number
  revenue: number
  roas: number | null
  conversions: number
  impressions: number
  clicks: number
  byType: ChannelTypeBreakdown[]
}

export type TrafficSegment = {
  segment: string
  rows: number
  spend: number
  revenue: number
  conversions: number
  roas: number | null
}

export type MetricsResponse = {
  range: { since: string; until: string }
  previousRange?: { since: string; until: string }
  lastSync: string
  channels: ChannelMetrics[]
  totals: { adSpend: number; shopifyRevenue: number; shopifyOrders?: number }
  segments?: TrafficSegment[]
  comparison?: {
    totals: {
      adSpend: DeltaValue
      shopifyRevenue: DeltaValue
      shopifyOrders: DeltaValue
    }
    channels: Record<
      string,
      {
        spend: DeltaValue
        revenue: DeltaValue
        conversions: DeltaValue
        roas: DeltaValue
      }
    >
  }
}

export type Recommendation = {
  id: number
  channel: Channel
  entity_id: string
  type: string
  severity: "critical" | "warning" | "info"
  title: string
  description: string | null
  status: string
  created_at: string
  rationale?: Record<string, unknown>
}

export type RecommendationStatus =
  | "open"
  | "applied"
  | "dismissed"
  | "resolved"
  | "all"

export type RecommendationsResponse = {
  recommendations: Recommendation[]
  counts: {
    total: number
    bySeverity: Record<string, number>
    byChannel: Record<string, number>
    byType: Record<string, number>
  }
}

export type ProposalStatus = "pending" | "approved" | "rejected" | "all"
export type ProposalPriority = "critical" | "warning" | "info"
export type ProposalExecutionStatus =
  | "dry_run"
  | "done"
  | "failed"
  | "skipped"
  | null

export type ProposalExecutionResult = {
  dryRun?: boolean
  done?: boolean
  failed?: boolean
  skipped?: boolean
  error?: string
  intendedAction?: {
    channel?: string
    recommendationType?: string
    entityType?: string
    entityId?: string | null
    platformId?: string | null
    operation?: string
    target?: string
    maxBudgetChangePctPerDay?: number
  }
  liveResult?: Record<string, unknown>
}

export type Proposal = {
  id: string
  channel: Channel
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  recommendation_type: string
  priority: ProposalPriority
  current_roas: number | null
  current_spend: number | null
  suggested_action: string
  ai_analysis: string | null
  status: Exclude<ProposalStatus, "all">
  created_at: string
  decided_at: string | null
  decided_by: string | null
  executed_at: string | null
  execution_status: ProposalExecutionStatus
  execution_result: ProposalExecutionResult | null
}

export type ProposalsResponse = {
  proposals: Proposal[]
  counts: {
    total: number
    byPriority: Record<string, number>
    byChannel: Record<string, number>
    byType: Record<string, number>
  }
}

export type ProposalDecisionResponse = {
  proposal: Proposal
  execution?: ProposalExecutionResult
}

export type ProposalExecutionModeResponse = {
  proposalExecution: {
    enabled: boolean
    mode: "dry_run" | "live"
    label: string
    env?: string
    checked_at?: string
  }
}

export type TrendPoint = {
  date: string
  [key: string]: string | number
}

export type TrendResponse = {
  range: { since: string; until: string }
  series: TrendPoint[]
}

export type AdQuality = {
  byGrade: Record<string, number>
  worst: string | null
  worstNo: string | null
  dominant: string | null
  dominantNo: string | null
}

export type CampaignTempo = {
  todaySpend: number
  dailyBudget: number
  pct: number | null
}

export type CampaignHealth = {
  campaignId: string
  name: string
  channelType: string | null
  biddingStrategy: string | null
  dailyBudget: number
  spend: number
  revenue: number
  conversions: number
  roas: number | null
  budgetLimited: boolean
  adQuality: AdQuality
  tempo: CampaignTempo
  health: string
}

export type CampaignHealthResponse = {
  range: { since: string; until: string }
  campaigns: CampaignHealth[]
}

export type SearchTermFlag = "wasted" | "strong" | null

export type SearchTerm = {
  searchTerm: string
  campaignName: string | null
  adGroupName: string | null
  cost: number
  clicks: number
  impressions: number
  conversions: number
  revenue: number
  roas: number | null
  flag: SearchTermFlag
}

export type SearchTermsResponse = {
  range: { since: string; until: string }
  days: number
  terms: SearchTerm[]
  counts: { wasted: number; strong: number }
}

export type ShopifyDetailResponse = {
  range: { since: string; until: string }
  lastSync: string | null
  products: {
    /** Antall ulike produkter solgt i perioden (ikke produkt-dager). */
    distinct: number
    top: {
      productId: string
      name: string | null
      revenue: number
      units: number
      days: number
    }[]
  }
  orders: {
    gross: { revenue: number; orders: number }
    /** Uten refunded/voided. partially_refunded er MED (beloepet er ukjent). */
    net: { revenue: number; orders: number }
    excluded: { refunded: number; voided: number }
    partiallyRefunded: number
    unknownStatus: number
  }
  segments: {
    segment: "new" | "returning" | "unknown"
    orders: number
    revenue: number
    share: number | null
  }[]
}

export type InventoryResponse = {
  fetchedAt: string
  threshold: number
  products: number
  totalUnits: number
  outOfStock: number
  lowStock: number
  lowStockItems: { id: string; title: string; inventory: number }[]
}

const BASE = "/api/detox"

/**
 * Feil fra en API-rute, med den navngitte koden og hintet ruta sendte. UI-et
 * skal vise `hint` paa en linje - aldri "Kunne ikke hente" uten grunn.
 * Rutene bak proxyen svarer alltid JSON med `code` + `hint` (route.ts), saa
 * fravaer av begge betyr at noe helt annet svarte.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly hint: string | null
  constructor(message: string, status: number, code: string, hint: string | null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.hint = hint
  }
}

async function readJsonOrThrow<T>(res: Response, hva: string): Promise<T> {
  if (res.ok) return (await res.json()) as T
  let code = `http_${res.status}`
  let hint: string | null = null
  try {
    const j = (await res.json()) as { code?: string; hint?: string; error?: string }
    if (typeof j.code === "string") code = j.code
    else if (typeof j.error === "string") code = j.error
    if (typeof j.hint === "string") hint = j.hint
  } catch {
    /* ikke JSON */
  }
  throw new ApiError(`${hva} feilet: ${res.status}`, res.status, code, hint)
}

async function postJson(url: string, body: Record<string, unknown> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) detail = j.error
    } catch {
      /* no json body */
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function getMetrics(
  since?: string,
  until?: string,
): Promise<MetricsResponse> {
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (until) params.set("until", until)
  const res = await fetch(`${BASE}/metrics?${params}`, { cache: "no-store" })
  return readJsonOrThrow<MetricsResponse>(res, "Metrics")
}

export async function getRecommendations(
  params: {
    status?: RecommendationStatus
    channel?: string
    type?: string
    limit?: number
  } = {},
): Promise<RecommendationsResponse> {
  const qs = new URLSearchParams()
  qs.set("status", params.status ?? "open")
  if (params.channel) qs.set("channel", params.channel)
  if (params.type) qs.set("type", params.type)
  qs.set("limit", String(params.limit ?? 100))
  const res = await fetch(`${BASE}/recommendations?${qs}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Anbefalinger feilet: ${res.status}`)
  return res.json()
}

export async function getTrend(
  since?: string,
  until?: string,
): Promise<TrendResponse> {
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (until) params.set("until", until)
  const res = await fetch(`${BASE}/metrics/trend?${params}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Trend feilet: ${res.status}`)
  return res.json()
}

export async function getCampaignHealth(
  since?: string,
  until?: string,
): Promise<CampaignHealthResponse> {
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (until) params.set("until", until)
  const res = await fetch(`${BASE}/metrics/campaign-health?${params}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Kampanje-helse feilet: ${res.status}`)
  return res.json()
}

export async function getSearchTerms(
  days = 30,
  limit = 100,
): Promise<SearchTermsResponse> {
  const params = new URLSearchParams()
  params.set("days", String(days))
  params.set("limit", String(limit))
  const res = await fetch(`${BASE}/search-terms?${params}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Søketermer feilet: ${res.status}`)
  return res.json()
}

export async function getProposals(
  params: {
    status?: ProposalStatus
    channel?: string
    priority?: string
    limit?: number
  } = {},
): Promise<ProposalsResponse> {
  const qs = new URLSearchParams()
  qs.set("status", params.status ?? "pending")
  if (params.channel) qs.set("channel", params.channel)
  if (params.priority) qs.set("priority", params.priority)
  qs.set("limit", String(params.limit ?? 500))
  const res = await fetch(`${BASE}/proposals?${qs}`, { cache: "no-store" })
  return readJsonOrThrow<ProposalsResponse>(res, "Forslag")
}

export async function getShopifyDetail(
  since?: string,
  until?: string,
  limit = 10,
): Promise<ShopifyDetailResponse> {
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (until) params.set("until", until)
  params.set("limit", String(limit))
  const res = await fetch(`${BASE}/metrics/shopify?${params}`, {
    cache: "no-store",
  })
  return readJsonOrThrow<ShopifyDetailResponse>(res, "Shopify-detaljer")
}

export async function getInventory(): Promise<InventoryResponse> {
  const res = await fetch(`${BASE}/metrics/inventory`, { cache: "no-store" })
  return readJsonOrThrow<InventoryResponse>(res, "Lager")
}

export async function getProposalExecutionMode(): Promise<ProposalExecutionModeResponse> {
  const res = await fetch(`${BASE}/proposals/execution-status`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Execution-modus feilet: ${res.status}`)
  return res.json()
}

export async function approveProposal(
  id: string,
): Promise<ProposalDecisionResponse> {
  return postJson(`${BASE}/proposals/${encodeURIComponent(id)}/approve`, {
    decided_by: "detox-os",
  })
}

export async function rejectProposal(
  id: string,
): Promise<ProposalDecisionResponse> {
  return postJson(`${BASE}/proposals/${encodeURIComponent(id)}/reject`, {
    decided_by: "detox-os",
  })
}
