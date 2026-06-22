import { NextResponse } from "next/server"

// Server-side route. Token leses fra env og forlater aldri serveren.
// Henter dagens ordrer fra Shopify Admin API. Ved feil: myk fallback til mock.
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN
const SHOP_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

const SHOPIFY_API_VERSION = "2024-01"

export const dynamic = "force-dynamic"

type ShopifyTodayData = {
  ordrer_i_dag: number
  omsetning_i_dag: number
  snitt_ordreverdi: number
  valuta: string
  mock?: true
}

const MOCK: ShopifyTodayData = {
  ordrer_i_dag: 7,
  omsetning_i_dag: 8420,
  snitt_ordreverdi: 1203,
  valuta: "NOK",
  mock: true,
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

async function fetchShopify(): Promise<ShopifyTodayData> {
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
    orders?: {
      total_price: string
      currency: string
      cancelled_at: string | null
    }[]
  }
  // Tell ikke kansellerte ordrer i dagens omsetning.
  const live = (json.orders ?? []).filter((o) => !o.cancelled_at)
  const omsetning = live.reduce(
    (sum, o) => sum + (parseFloat(o.total_price) || 0),
    0,
  )
  const count = live.length
  return {
    ordrer_i_dag: count,
    omsetning_i_dag: omsetning,
    snitt_ordreverdi: count > 0 ? omsetning / count : 0,
    valuta: live[0]?.currency ?? "NOK",
  }
}

export async function GET() {
  try {
    const data = await fetchShopify()
    return NextResponse.json(data, { status: 200 })
  } catch {
    return NextResponse.json(MOCK, { status: 200 })
  }
}
