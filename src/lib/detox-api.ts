export type Channel = 'google_ads' | 'meta' | 'shopify' | 'klaviyo'

export type DeltaValue = {
  abs: number
  pct: number | null
  dir: 'up' | 'down' | 'flat'
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

export type MetricsResponse = {
  range: { since: string; until: string }
  previousRange?: { since: string; until: string }
  lastSync: string
  channels: ChannelMetrics[]
  totals: { adSpend: number; shopifyRevenue: number; shopifyOrders?: number }
  segments?: { name: string; spend: number; revenue: number; roas: number }[]
  comparison?: {
    totals: {
      adSpend: DeltaValue
      shopifyRevenue: DeltaValue
      shopifyOrders: DeltaValue
    }
    channels: Record<string, {
      spend: DeltaValue
      revenue: DeltaValue
      conversions: DeltaValue
      roas: DeltaValue
    }>
  }
}

export type Recommendation = {
  id: number
  channel: Channel
  entity_id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
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

const BASE = '/api/detox'

export async function getMetrics(since?: string, until?: string): Promise<MetricsResponse> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const res = await fetch(`${BASE}/metrics?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Metrics feilet: ${res.status}`)
  return res.json()
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
  qs.set('status', params.status ?? 'open')
  if (params.channel) qs.set('channel', params.channel)
  if (params.type) qs.set('type', params.type)
  qs.set('limit', String(params.limit ?? 100))
  const res = await fetch(`${BASE}/recommendations?${qs}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Anbefalinger feilet: ${res.status}`)
  return res.json()
}

export async function getTrend(since?: string, until?: string): Promise<TrendResponse> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const res = await fetch(`${BASE}/metrics/trend?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Trend feilet: ${res.status}`)
  return res.json()
}

export async function getCampaignHealth(
  since?: string,
  until?: string,
): Promise<CampaignHealthResponse> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const res = await fetch(`${BASE}/metrics/campaign-health?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Kampanje-helse feilet: ${res.status}`)
  return res.json()
}
