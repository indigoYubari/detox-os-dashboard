import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'https://web-production-179ae.up.railway.app'
const USER = process.env.DETOX_DASHBOARD_USER
const PASS = process.env.DETOX_DASHBOARD_PASS

const MOCK_METRICS = {
  range: { since: "2026-05-08", until: "2026-06-07" },
  lastSync: "2026-06-07T18:30:00Z",
  channels: [
    {
      channel: "google_ads",
      rows: 12,
      spend: 28400,
      revenue: 84200,
      roas: 2.96,
      conversions: 48,
      impressions: 142000,
      clicks: 3200,
      byType: [],
    },
    {
      channel: "meta",
      rows: 8,
      spend: 34600,
      revenue: 118400,
      roas: 3.42,
      conversions: 62,
      impressions: 218000,
      clicks: 4800,
      byType: [],
    },
    {
      channel: "klaviyo",
      rows: 6,
      spend: 1490,
      revenue: 96800,
      roas: 64.97,
      conversions: 54,
      impressions: 0,
      clicks: 3200,
      byType: [],
    },
    {
      channel: "shopify",
      rows: 186,
      spend: 0,
      revenue: 312400,
      roas: null,
      conversions: 186,
      impressions: 0,
      clicks: 0,
      byType: [],
    },
  ],
  totals: {
    adSpend: 64490,
    shopifyRevenue: 312400,
    shopifyOrders: 186,
  },
  comparison: {
    totals: {
      adSpend: { abs: 4200, pct: 7.0, dir: "up" },
      shopifyRevenue: { abs: 24800, pct: 8.6, dir: "up" },
      shopifyOrders: { abs: 12, pct: 6.9, dir: "up" },
    },
    channels: {
      google_ads: {
        spend: { abs: 1200, pct: 4.4, dir: "up" },
        revenue: { abs: 6400, pct: 8.2, dir: "up" },
        conversions: { abs: 3, pct: 6.7, dir: "up" },
        roas: { abs: 0.1, pct: 3.5, dir: "up" },
      },
      meta: {
        spend: { abs: 2800, pct: 8.8, dir: "up" },
        revenue: { abs: 14200, pct: 13.6, dir: "up" },
        conversions: { abs: 8, pct: 14.8, dir: "up" },
        roas: { abs: 0.14, pct: 4.3, dir: "up" },
      },
      klaviyo: {
        spend: { abs: 0, pct: 0, dir: "flat" },
        revenue: { abs: 8400, pct: 9.5, dir: "up" },
        conversions: { abs: 4, pct: 8.0, dir: "up" },
        roas: { abs: 6.1, pct: 10.4, dir: "up" },
      },
    },
  },
}

const MOCK_RECOMMENDATIONS = {
  recommendations: [
    {
      id: 1,
      channel: "google_ads",
      entity_id: "pmax-alle",
      type: "budget",
      severity: "warning",
      title: "PFM | Merker er budsjettbegrenset",
      description:
        "Kampanjen treffer budsjettaket daglig. Vurder økning fra kr 400 til kr 600/dag.",
      status: "open",
      created_at: "2026-06-05T10:00:00Z",
    },
    {
      id: 2,
      channel: "meta",
      entity_id: "adset-retarget",
      type: "performance",
      severity: "info",
      title: "Retargeting-sett har sterk ROAS",
      description:
        "ROAS på 5.8x siste 14 dager. Vurder budsjettøkning for å skalere.",
      status: "open",
      created_at: "2026-06-04T14:00:00Z",
    },
    {
      id: 3,
      channel: "google_ads",
      entity_id: "tudca-search",
      type: "compliance",
      severity: "critical",
      title: "TUDCA-annonser avvist — helsepåstander",
      description:
        "Google har avvist 2 annonser for påstander om leverhelse. Ny compliant tekst er klar.",
      status: "open",
      created_at: "2026-06-06T09:00:00Z",
    },
  ],
  counts: {
    total: 3,
    bySeverity: { critical: 1, warning: 1, info: 1 },
    byChannel: { google_ads: 2, meta: 1 },
    byType: { budget: 1, performance: 1, compliance: 1 },
  },
}

function buildMockTrend() {
  const series = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(2026, 4, 8 + i)
    series.push({
      date: d.toISOString().slice(0, 10),
      google_ads_roas: +(2.4 + Math.random() * 1.4).toFixed(2),
      meta_roas: +(2.8 + Math.random() * 1.6).toFixed(2),
      klaviyo_roas: +(55 + Math.random() * 20).toFixed(2),
    })
  }
  return {
    range: { since: "2026-05-08", until: "2026-06-07" },
    series,
  }
}

const MOCK_MAP: Record<string, () => unknown> = {
  metrics: () => MOCK_METRICS,
  recommendations: () => MOCK_RECOMMENDATIONS,
  "metrics/trend": () => buildMockTrend(),
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join("/")
  const search = request.nextUrl.searchParams.toString()
  const url = `${BACKEND}/api/${path}${search ? `?${search}` : ""}`

  const headers: Record<string, string> = {}
  if (USER && PASS) {
    headers["Authorization"] = `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`
  }

  try {
    const res = await fetch(url, { headers, cache: "no-store" })
    if (!res.ok) throw new Error(`Backend ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    const mockKey = Object.keys(MOCK_MAP).find((k) => path.startsWith(k))
    if (mockKey) {
      return NextResponse.json(MOCK_MAP[mockKey](), {
        status: 200,
        headers: { "X-Data-Source": "mock-fallback" },
      })
    }
    return NextResponse.json({ error: "Backend utilgjengelig" }, { status: 502 })
  }
}
