import { NextResponse } from "next/server"
import { authorize, requireDetoxPrincipal } from "@/lib/auth-server"

// Server-side route. Token leses fra env og forlater aldri serveren.
// Henter siste e-postkampanje fra Klaviyo + open/click rate. Ved feil: mock.
const KLAVIYO = process.env.KLAVIYO_API_KEY

// 2024-10-15 matcher den verifiserte /api/oversikt-ruten. Reporting-API-et
// (campaign-values-reports) krever denne revisjonen, ikke 2023-10-15.
const KLAVIYO_REVISION = "2024-10-15"

export const dynamic = "force-dynamic"

type KampanjeData = {
  kampanje_navn: string
  open_rate: number // fraksjon 0..1
  click_rate: number // fraksjon 0..1
  sendt_dato: string | null
  mock?: true
}

const MOCK: KampanjeData = {
  kampanje_navn: "Ukens utvalg",
  open_rate: 0.41,
  click_rate: 0.038,
  sendt_dato: null,
  mock: true,
}

const HEADERS = () => ({
  Authorization: `Klaviyo-API-Key ${KLAVIYO}`,
  revision: KLAVIYO_REVISION,
  accept: "application/json",
  "content-type": "application/json",
})

type LatestCampaign = {
  id: string
  name: string
  sendt_dato: string | null
}

// Siste sendte e-postkampanje, sortert nyeste først.
async function latestEmailCampaign(): Promise<LatestCampaign> {
  const url =
    "https://a.klaviyo.com/api/campaigns/" +
    "?filter=equals(messages.channel,'email')" +
    "&sort=-created_at&page[size]=1"
  const res = await fetch(url, { headers: HEADERS(), cache: "no-store" })
  if (!res.ok) throw new Error(`Klaviyo campaigns svarte ${res.status}`)
  const json = (await res.json()) as {
    data?: {
      id: string
      attributes?: { name?: string; send_time?: string; created_at?: string }
    }[]
  }
  const c = json.data?.[0]
  if (!c) throw new Error("Ingen e-postkampanjer funnet i Klaviyo")
  return {
    id: c.id,
    name: c.attributes?.name ?? "Uten navn",
    sendt_dato: c.attributes?.send_time ?? c.attributes?.created_at ?? null,
  }
}

// Finn metrikk-ID for "Placed Order" - kreves som conversion_metric_id.
async function placedOrderMetricId(): Promise<string | null> {
  const override = process.env.KLAVIYO_PLACED_ORDER_METRIC_ID
  if (override) return override
  const res = await fetch("https://a.klaviyo.com/api/metrics/", {
    headers: HEADERS(),
    cache: "no-store",
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: { id: string; attributes?: { name?: string } }[]
  }
  const hit = json.data?.find(
    (m) => m.attributes?.name?.toLowerCase() === "placed order",
  )
  return hit?.id ?? null
}

// Open/click rate for en gitt kampanje via campaign-values-report.
async function campaignRates(
  campaignId: string,
  metricId: string,
): Promise<{ open_rate: number; click_rate: number }> {
  const res = await fetch(
    "https://a.klaviyo.com/api/campaign-values-reports/",
    {
      method: "POST",
      headers: HEADERS(),
      cache: "no-store",
      body: JSON.stringify({
        data: {
          type: "campaign-values-report",
          attributes: {
            statistics: ["open_rate", "click_rate"],
            timeframe: { key: "last_12_months" },
            conversion_metric_id: metricId,
            filter: `equals(campaign_id,"${campaignId}")`,
          },
        },
      }),
    },
  )
  if (!res.ok) throw new Error(`Klaviyo values-report svarte ${res.status}`)
  const json = (await res.json()) as {
    data?: {
      attributes?: {
        results?: {
          statistics?: { open_rate?: number; click_rate?: number }
        }[]
      }
    }
  }
  const stats = json.data?.attributes?.results?.[0]?.statistics
  return {
    open_rate: stats?.open_rate ?? 0,
    click_rate: stats?.click_rate ?? 0,
  }
}

async function fetchKlaviyo(): Promise<KampanjeData> {
  if (!KLAVIYO) throw new Error("Klaviyo-token mangler i miljøvariabler")
  const campaign = await latestEmailCampaign()
  const metricId = await placedOrderMetricId()
  // Uten metrikk-ID kan vi ikke hente rater - vis kampanjenavn, rater 0.
  const rates = metricId
    ? await campaignRates(campaign.id, metricId)
    : { open_rate: 0, click_rate: 0 }
  return {
    kampanje_navn: campaign.name,
    open_rate: rates.open_rate,
    click_rate: rates.click_rate,
    sendt_dato: campaign.sendt_dato,
  }
}

export async function GET() {
  // Defense in depth: middleware beskytter allerede /api/*, men denne ruten
  // skal ikke vaere avhengig av at den er riktig konfigurert. Se
  // sessions/2026-08-22 - en feilplassert middleware.ts gjorde hele
  // auth-laget inert uten at en eneste test feilet.
  const denied = authorize(await requireDetoxPrincipal(), "detox:read")
  if (denied) return denied

  try {
    const data = await fetchKlaviyo()
    return NextResponse.json(data, { status: 200 })
  } catch {
    return NextResponse.json(MOCK, { status: 200 })
  }
}
