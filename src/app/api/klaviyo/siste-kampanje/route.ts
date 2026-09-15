import { NextResponse } from "next/server"
import { authorize, requireDetoxUser } from "@/lib/auth-server"
import {
  ForbiddenError,
  liveMeta,
  NotConfiguredError,
  sourceErrorResponse,
  upstreamErrorSummary,
  UpstreamStatusError,
  type LiveMeta,
} from "@/lib/source-state"

// Server-side route. Token leses fra env og forlater aldri serveren.
// Henter siste e-postkampanje fra Klaviyo + open/click rate.
//
// Ruta faller IKKE tilbake til mock ved feil. Fram til 2026-08-25 returnerte
// den kampanjen "Ukens utvalg" med 41 % open rate - et tall ingen kampanje
// noensinne hadde oppnaadd - med status 200, og /i-dag rendret aldri flagget.
const KLAVIYO = process.env.KLAVIYO_API_KEY

// 2024-10-15 matcher den verifiserte /api/oversikt-ruten. Reporting-API-et
// (campaign-values-reports) krever denne revisjonen, ikke 2023-10-15.
const KLAVIYO_REVISION = "2024-10-15"

// Klaviyo svarer 401/403 naar noekkelen mangler scopet et endepunkt krever.
// Noekkelen i prod er gyldig (metrics og values-reports virker), men mangler
// campaigns:read - kjent siden 2026-08-25, eid av Klaviyo-kontoens eier.
// Fram til 2026-09-15 ble det til "Kunne ikke hente" uten forklaring.
async function klaviyoFeil(res: Response, scope: string, hva: string): Promise<Error> {
  if (res.status === 401 || res.status === 403) {
    return new ForbiddenError(
      `Klaviyo svarte ${res.status} - noekkelen mangler ${scope}`,
      `Klaviyo-nøkkelen mangler tilgang til ${scope}. Kontoeieren må utvide nøkkelens rettigheter.`,
    )
  }
  // Live 2026-09-15 var svaret 400 - Klaviyo avviser selve forespoerselen.
  // Ta med hva den sier, ellers kan ingen se det fra dashbordet.
  let detail: string | null = null
  try {
    detail = upstreamErrorSummary(await res.json())
  } catch {
    /* ikke JSON */
  }
  return new UpstreamStatusError(`Klaviyo ${hva} svarte ${res.status}`, res.status, detail)
}

export const dynamic = "force-dynamic"

type KampanjeTall = {
  kampanje_navn: string
  /** Fraksjon 0..1. null = Klaviyo ga ingen rapportrad - ikke det samme som 0. */
  open_rate: number | null
  click_rate: number | null
  sendt_dato: string | null
  /** Kort grunn naar ratene er null. */
  rater_grunn: string | null
}

export type KampanjeData = KampanjeTall & LiveMeta

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

// Nyeste e-postkampanjer (foerste side), nyeste foerst. Uten page[size]:
// Klaviyo svarte 400 «'page_size' is not a valid field for the resource
// 'campaign'» (live 2026-09-15) - campaigns-endepunktet har kun
// cursor-paginering. Fram til da ble det rapportert som «Klaviyo
// utilgjengelig» og antatt aa vaere manglende scope.
async function recentEmailCampaigns(): Promise<LatestCampaign[]> {
  const url =
    "https://a.klaviyo.com/api/campaigns/" +
    "?filter=equals(messages.channel,'email')" +
    "&sort=-created_at"
  const res = await fetch(url, { headers: HEADERS(), cache: "no-store" })
  if (!res.ok) throw await klaviyoFeil(res, "kampanjer", "campaigns")
  const json = (await res.json()) as {
    data?: {
      id: string
      attributes?: { name?: string; send_time?: string; created_at?: string }
    }[]
  }
  const list = (json.data ?? []).map((c) => ({
    id: c.id,
    name: c.attributes?.name ?? "Uten navn",
    sendt_dato: c.attributes?.send_time ?? c.attributes?.created_at ?? null,
  }))
  if (list.length === 0) throw new Error("Ingen e-postkampanjer funnet i Klaviyo")
  return list
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

// Open/click rate per kampanje via campaign-values-report, siste 12 mnd.
// Rapporten grupperer per kampanje (groupings.campaign_id). Live 2026-09-15:
// filter paa campaign_id ga 0 rader, og den nyeste kampanjen etter created_at
// fantes ikke blant de 48 i rapporten (trolig ikke sendt ennaa). Derfor:
// hent rapporten en gang, og la kalleren velge nyeste kampanje som HAR en rad.
type Stats = { open_rate: number | null; click_rate: number | null }

async function campaignReport(metricId: string): Promise<Map<string, Stats>> {
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
          },
        },
      }),
    },
  )
  if (!res.ok) throw await klaviyoFeil(res, "kampanjerapporter", "values-report")
  const json = (await res.json()) as {
    data?: {
      attributes?: {
        results?: {
          groupings?: { campaign_id?: string }
          statistics?: { open_rate?: number; click_rate?: number }
        }[]
      }
    }
  }
  const map = new Map<string, Stats>()
  for (const r of json.data?.attributes?.results ?? []) {
    const id = r.groupings?.campaign_id
    if (!id || !r.statistics) continue
    map.set(id, {
      open_rate: typeof r.statistics.open_rate === "number" ? r.statistics.open_rate : null,
      click_rate: typeof r.statistics.click_rate === "number" ? r.statistics.click_rate : null,
    })
  }
  return map
}

async function fetchKlaviyo(): Promise<KampanjeTall> {
  if (!KLAVIYO) {
    throw new NotConfiguredError("KLAVIYO_API_KEY mangler i miljøet")
  }
  const campaigns = await recentEmailCampaigns()
  const metricId = await placedOrderMetricId()
  if (!metricId) {
    const c = campaigns[0]
    return {
      kampanje_navn: c.name,
      open_rate: null,
      click_rate: null,
      sendt_dato: c.sendt_dato,
      rater_grunn: "Fant ikke konverteringsmetrikken «Placed Order» i Klaviyo.",
    }
  }
  const report = await campaignReport(metricId)
  // Nyeste kampanje som faktisk har en rapportrad. En manglende rad ble fram
  // til 2026-09-15 til open_rate 0 - som leste som en maaling.
  const hit = campaigns.find((c) => report.has(c.id))
  if (!hit) {
    const c = campaigns[0]
    return {
      kampanje_navn: c.name,
      open_rate: null,
      click_rate: null,
      sendt_dato: c.sendt_dato,
      rater_grunn: `Ingen av de ${campaigns.length} nyeste kampanjene har en rapportrad ennå (${report.size} kampanjer i rapporten).`,
    }
  }
  const stats = report.get(hit.id)!
  return {
    kampanje_navn: hit.name,
    open_rate: stats.open_rate,
    click_rate: stats.click_rate,
    sendt_dato: hit.sendt_dato,
    rater_grunn: null,
  }
}

export async function GET() {
  // Defense in depth: middleware beskytter allerede /api/*, men denne ruten
  // skal ikke vaere avhengig av at den er riktig konfigurert. Se
  // sessions/2026-08-22 - en feilplassert middleware.ts gjorde hele
  // auth-laget inert uten at en eneste test feilet.
  const denied = authorize(await requireDetoxUser(), "detox:read")
  if (denied) return denied

  try {
    const data = await fetchKlaviyo()
    return NextResponse.json<KampanjeData>(
      { ...data, ...liveMeta("klaviyo") },
      { status: 200 },
    )
  } catch (e) {
    return sourceErrorResponse("klaviyo", e)
  }
}
