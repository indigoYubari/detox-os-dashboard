import { NextResponse } from "next/server"

// Uleste e-poster i innboksen for to kontoer (b2b + kontakt), kategorisert per avsender.
// Fire kategorier: Kunder, Frakt og toll, Leverandorer, Andre.

export const dynamic = "force-dynamic"

type Kategori = { navn: string; antall: number; tooltip: string }
type GmailData = {
  totalt_uleste: number
  kategorier: Kategori[]
  kontoer?: { b2b: number; kontakt: number }
  mock?: true
}

const MOCK: GmailData = {
  totalt_uleste: 8,
  kategorier: [
    { navn: "Kunder", antall: 5, tooltip: "E-post fra private kundeadresser som gmail.com og icloud.com. Disse trenger oftest rask respons." },
    { navn: "Frakt og toll", antall: 1, tooltip: "Varsler fra fraktselskaper og tollmyndigheter. Inneholder sporingsnumre og leveringsstatus." },
    { navn: "Leverandorer", antall: 1, tooltip: "E-post fra faste leverandorer og produsenter. Fakturaer og ordrebekreftelser." },
    { navn: "Andre", antall: 1, tooltip: "Alt annet: Shopify-varsler, systemmail fra Railway, Resend, Google og annonseplattformer." },
  ],
  mock: true,
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REFRESH_TOKEN_B2B = process.env.GOOGLE_REFRESH_TOKEN
const REFRESH_TOKEN_KONTAKT = process.env.GOOGLE_REFRESH_TOKEN_KONTAKT

const MAX_PER_KONTO = 100
const BATCH = 25

// Privat-/forbrukerdomener som indikerer kundeepost
const KUNDE_DOMENER = new Set([
  "gmail.com", "hotmail.com", "hotmail.no", "icloud.com",
  "outlook.com", "live.com", "live.no", "yahoo.com",
])

// Nokkelord i avsender som indikerer frakt/toll
const FRAKT_NOKKELORD = [
  "dhl", "fedex", "ups", "bring", "posten", "toll", "customs",
  "tracking", "shipment", "frakt", "nexigroup",
]

// Eksplisitte leverandordomener
const LEVERANDOR_DOMENER = new Set([
  "healthygut", "bodybio", "aquatruwater", "puracacao", "cymbiotika",
  "mitolife", "codeage", "unovita", "lefeurope", "vitalized",
  "molecusan", "contractmanufacturinglabs", "groothandelolie",
  "mindmatterlab", "moenco", "radianthealth", "forebyggendehelse",
  "natchartering", "spirox", "bwrr", "wearedame",
])

const KATEGORI_TOOLTIPS: Record<string, string> = {
  Kunder: "E-post fra private kundeadresser som gmail.com og icloud.com. Disse trenger oftest rask respons.",
  "Frakt og toll": "Varsler fra fraktselskaper og tollmyndigheter. Inneholder sporingsnumre og leveringsstatus.",
  Leverandorer: "E-post fra faste leverandorer og produsenter. Fakturaer og ordrebekreftelser.",
  Andre: "Alt annet: Shopify-varsler, systemmail fra Railway, Resend, Google og annonseplattformer.",
}

function domeneFromEmail(from: string): string {
  const match = from.match(/@([\w.-]+)/)
  return match ? match[1].toLowerCase() : ""
}

function kategoriForAvsender(from: string): string {
  const f = from.toLowerCase()
  const domene = domeneFromEmail(from)

  // 1. Kunder
  if (KUNDE_DOMENER.has(domene)) return "Kunder"

  // 2. Frakt og toll
  if (FRAKT_NOKKELORD.some((k) => f.includes(k))) return "Frakt og toll"

  // 3. Leverandorer (sjekk om domenet inneholder et av nokkelordene)
  if (Array.from(LEVERANDOR_DOMENER).some((l) => domene.includes(l))) return "Leverandorer"

  // 4. Andre
  return "Andre"
}

async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("Mangler OAuth-konfig")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error(`Token-feil ${res.status}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error("Mangler access_token")
  return json.access_token
}

async function fetchForKonto(
  refreshToken: string
): Promise<{ total: number; buckets: Record<string, number> }> {
  const token = await accessTokenFromRefresh(refreshToken)

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+in:inbox&maxResults=${MAX_PER_KONTO}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!listRes.ok) throw new Error(`Gmail ${listRes.status}`)
  const list = (await listRes.json()) as { messages?: { id: string }[] }
  const ids = list.messages ?? []

  const buckets: Record<string, number> = { Kunder: 0, "Frakt og toll": 0, Leverandorer: 0, Andre: 0 }
  let kategorisert = 0

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH)
    const results = await Promise.all(
      slice.map(async (m) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        )
        if (!r.ok) return null
        const msg = (await r.json()) as {
          payload?: { headers?: { name: string; value: string }[] }
        }
        return msg.payload?.headers?.find((h) => h.name === "From")?.value ?? ""
      })
    )
    for (const from of results) {
      if (from === null) continue
      buckets[kategoriForAvsender(from)] += 1
      kategorisert += 1
    }
  }

  return { total: kategorisert, buckets }
}

async function fetchGmail(): Promise<GmailData> {
  const tokens: string[] = []
  if (REFRESH_TOKEN_B2B) tokens.push(REFRESH_TOKEN_B2B)
  if (REFRESH_TOKEN_KONTAKT) tokens.push(REFRESH_TOKEN_KONTAKT)
  if (tokens.length === 0) throw new Error("Ingen tokens")

  const results = await Promise.allSettled(tokens.map(fetchForKonto))

  const b2bTotal = results[0]?.status === "fulfilled" ? results[0].value.total : 0
  const kontaktTotal = results[1]?.status === "fulfilled" ? results[1].value.total : 0

  const mergedBuckets: Record<string, number> = { Kunder: 0, "Frakt og toll": 0, Leverandorer: 0, Andre: 0 }
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const [k, v] of Object.entries(r.value.buckets)) {
        mergedBuckets[k] = (mergedBuckets[k] ?? 0) + v
      }
    }
  }

  return {
    totalt_uleste: b2bTotal + kontaktTotal,
    kategorier: Object.entries(mergedBuckets).map(([navn, antall]) => ({
      navn,
      antall,
      tooltip: KATEGORI_TOOLTIPS[navn] ?? "",
    })),
    kontoer: { b2b: b2bTotal, kontakt: kontaktTotal },
  }
}

export async function GET() {
  try {
    const data = await fetchGmail()
    return NextResponse.json(data, { status: 200 })
  } catch {
    return NextResponse.json(MOCK, { status: 200 })
  }
}
