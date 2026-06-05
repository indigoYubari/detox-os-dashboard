export type Channel = 'google_ads' | 'meta' | 'shopify' | 'klaviyo'

export type DeltaValue = {
  abs: number
  pct: number | null
  dir: 'up' | 'down' | 'flat'
}

export type ChannelMetrics = {
  channel: Channel
  spend: number
  revenue: number
  roas: number
  conversions: number
  impressions: number
  clicks: number
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
  description: string
  status: string
  created_at: string
  rationale?: Record<string, unknown>
}

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

const BASE = '/api/detox'

export async function getMetrics(since?: string, until?: string): Promise<MetricsResponse> {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const res = await fetch(`${BASE}/metrics?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Metrics feilet: ${res.status}`)
  return res.json()
}

export async function getRecommendations(limit = 5): Promise<RecommendationsResponse> {
  const res = await fetch(`${BASE}/recommendations?status=open&limit=${limit}`, { cache: 'no-store' })
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
