import { NextResponse } from "next/server"
import { authorize, requireDetoxPrincipal } from "@/lib/auth-server"

// Server-side route. Tokenene leses fra env og forlater aldri serveren.
// Mønster speiler /api/detox/[...path]: no-store, mykt feilhåndtert JSON-svar.
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN
const SHOP_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const KLAVIYO = process.env.KLAVIYO_API_KEY

const SHOPIFY_API_VERSION = "2025-10"
const KLAVIYO_REVISION = "2024-10-15"

export const dynamic = "force-dynamic"

type ShopifyData = {
  revenueToday: number
  orders: number
  aov: number
  currency: string
}

type KlaviyoData = {
  emailRevenue7d: number
  listSize: number | null
  listName: string | null
}

// Midnatt i dag i Europe/Oslo som ISO med korrekt offset (håndterer sommertid).
function osloMidnightISO(): string {
  const now = new Date()
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
  }).format(now)
  const offsetName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Oslo",
      timeZoneName: "shortOffset",
    })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+0"
  const m = offsetName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  let tz = "+00:00"
  if (m) {
    const sign = m[1]
    const hh = m[2].padStart(2, "0")
    const mm = m[3] ?? "00"
    tz = `${sign}${hh}:${mm}`
  }
  return `${ymd}T00:00:00${tz}`
}

async function fetchShopify(): Promise<ShopifyData> {
  if (!SHOP || !SHOP_TOKEN) {
    throw new Error("Shopify-token mangler i miljøvariabler")
  }
  const since = osloMidnightISO()
  const url =
    `https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/orders.json` +
    `?status=any&limit=250&created_at_min=${encodeURIComponent(since)}` +
    `&fields=total_price,currency,cancelled_at`

  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": SHOP_TOKEN },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Shopify svarte ${res.status}`)
  }
  const json = (await res.json()) as {
    orders: {
      total_price: string
      currency: string
      cancelled_at: string | null
    }[]
  }
  const orders = json.orders ?? []
  // Tell ikke kansellerte ordrer i dagens omsetning.
  const live = orders.filter((o) => !o.cancelled_at)
  const revenueToday = live.reduce(
    (sum, o) => sum + (parseFloat(o.total_price) || 0),
    0,
  )
  const count = live.length
  return {
    revenueToday,
    orders: count,
    aov: count > 0 ? revenueToday / count : 0,
    currency: live[0]?.currency ?? "NOK",
  }
}

const KLAVIYO_HEADERS = () => ({
  Authorization: `Klaviyo-API-Key ${KLAVIYO}`,
  revision: KLAVIYO_REVISION,
  accept: "application/json",
  "content-type": "application/json",
})

// Finn metrikk-ID for "Placed Order" (konverteringsmetrikk for revenue).
async function placedOrderMetricId(): Promise<string | null> {
  const override = process.env.KLAVIYO_PLACED_ORDER_METRIC_ID
  if (override) return override
  const res = await fetch("https://a.klaviyo.com/api/metrics/", {
    headers: KLAVIYO_HEADERS(),
    cache: "no-store",
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    data: { id: string; attributes: { name: string } }[]
  }
  const hit = json.data?.find(
    (m) => m.attributes?.name?.toLowerCase() === "placed order",
  )
  return hit?.id ?? null
}

// Sum conversion_value fra en values-report (campaign eller flow).
async function valuesReportSum(
  reportType: "campaign" | "flow",
  metricId: string,
): Promise<number> {
  const url = `https://a.klaviyo.com/api/${reportType}-values-reports/`
  const res = await fetch(url, {
    method: "POST",
    headers: KLAVIYO_HEADERS(),
    cache: "no-store",
    body: JSON.stringify({
      data: {
        type: `${reportType}-values-report`,
        attributes: {
          statistics: ["conversion_value"],
          timeframe: { key: "last_7_days" },
          conversion_metric_id: metricId,
        },
      },
    }),
  })
  if (!res.ok)
    throw new Error(`Klaviyo ${reportType}-report svarte ${res.status}`)
  const json = (await res.json()) as {
    data: {
      attributes: { results: { statistics: { conversion_value: number } }[] }
    }
  }
  const results = json.data?.attributes?.results ?? []
  return results.reduce(
    (sum, r) => sum + (r.statistics?.conversion_value || 0),
    0,
  )
}

// Best-effort listestørrelse. profile_count avvises av enkelte kontoer/revisjoner,
// da returneres null og siden viser "ikke tilgjengelig".
async function largestListSize(): Promise<{
  size: number | null
  name: string | null
}> {
  try {
    const res = await fetch(
      "https://a.klaviyo.com/api/lists/?additional-fields[list]=profile_count",
      { headers: KLAVIYO_HEADERS(), cache: "no-store" },
    )
    if (!res.ok) return { size: null, name: null }
    const json = (await res.json()) as {
      data?: { attributes: { name: string; profile_count?: number } }[]
    }
    const lists = json.data ?? []
    let best: { size: number | null; name: string | null } = {
      size: null,
      name: null,
    }
    for (const l of lists) {
      const c = l.attributes?.profile_count
      if (typeof c === "number" && (best.size === null || c > best.size)) {
        best = { size: c, name: l.attributes?.name ?? null }
      }
    }
    return best
  } catch {
    return { size: null, name: null }
  }
}

async function fetchKlaviyo(): Promise<KlaviyoData> {
  if (!KLAVIYO) throw new Error("Klaviyo-token mangler i miljøvariabler")
  const metricId = await placedOrderMetricId()
  if (!metricId) throw new Error("Fant ikke Placed Order-metrikk i Klaviyo")

  const [campaign, flow, list] = await Promise.all([
    valuesReportSum("campaign", metricId),
    valuesReportSum("flow", metricId),
    largestListSize(),
  ])

  return {
    emailRevenue7d: campaign + flow,
    listSize: list.size,
    listName: list.name,
  }
}

export async function GET() {
  // Defense in depth: middleware beskytter allerede /api/*, men denne ruten
  // skal ikke vaere avhengig av at den er riktig konfigurert. Se
  // sessions/2026-08-22 - en feilplassert middleware.ts gjorde hele
  // auth-laget inert uten at en eneste test feilet.
  const denied = authorize(await requireDetoxPrincipal(), "detox:read")
  if (denied) return denied

  const errors: Record<string, string> = {}

  const [shopifyRes, klaviyoRes] = await Promise.allSettled([
    fetchShopify(),
    fetchKlaviyo(),
  ])

  const shopify = shopifyRes.status === "fulfilled" ? shopifyRes.value : null
  if (shopifyRes.status === "rejected") {
    errors.shopify = String(shopifyRes.reason?.message ?? shopifyRes.reason)
  }

  const klaviyo = klaviyoRes.status === "fulfilled" ? klaviyoRes.value : null
  if (klaviyoRes.status === "rejected") {
    errors.klaviyo = String(klaviyoRes.reason?.message ?? klaviyoRes.reason)
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      shopify,
      klaviyo,
      errors: Object.keys(errors).length ? errors : undefined,
    },
    { status: 200 },
  )
}
