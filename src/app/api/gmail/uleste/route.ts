import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type Kategori = { navn: string; antall: number }
type GmailData = {
  totalt_uleste: number
  kategorier: Kategori[]
  kontoer?: { b2b: number; kontakt: number }
  mock?: true
}

const MOCK: GmailData = {
  totalt_uleste: 8,
  kategorier: [
    { navn: "Fiken", antall: 1 },
    { navn: "Klaviyo", antall: 2 },
    { navn: "Shopify", antall: 1 },
    { navn: "Andre", antall: 4 },
  ],
  mock: true,
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REFRESH_TOKEN_B2B = process.env.GOOGLE_REFRESH_TOKEN
const REFRESH_TOKEN_KONTAKT = process.env.GOOGLE_REFRESH_TOKEN_KONTAKT

function kategoriForAvsender(from: string): string {
  const f = from.toLowerCase()
  if (f.includes("fiken")) return "Fiken"
  if (f.includes("klaviyo")) return "Klaviyo"
  if (f.includes("shopify")) return "Shopify"
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

async function fetchForKonto(refreshToken: string): Promise<{ total: number; buckets: Record<string, number> }> {
  const token = await accessTokenFromRefresh(refreshToken)
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+in:inbox&maxResults=100",
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  )
  if (!listRes.ok) throw new Error(`Gmail ${listRes.status}`)
  const list = (await listRes.json()) as { messages?: { id: string }[] }
  const ids = list.messages ?? []
  const buckets: Record<string, number> = { Fiken: 0, Klaviyo: 0, Shopify: 0, Andre: 0 }
  await Promise.all(
    ids.map(async (m) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      )
      if (!r.ok) return
      const msg = (await r.json()) as { payload?: { headers?: { name: string; value: string }[] } }
      const from = msg.payload?.headers?.find((h) => h.name === "From")?.value ?? ""
      buckets[kategoriForAvsender(from)] += 1
    })
  )
  return { total: ids.length, buckets }
}

async function fetchGmail(): Promise<GmailData> {
  const tokens: string[] = []
  if (REFRESH_TOKEN_B2B) tokens.push(REFRESH_TOKEN_B2B)
  if (REFRESH_TOKEN_KONTAKT) tokens.push(REFRESH_TOKEN_KONTAKT)
  if (tokens.length === 0) throw new Error("Ingen tokens")

  const results = await Promise.allSettled(tokens.map(fetchForKonto))

  const b2bTotal = results[0]?.status === "fulfilled" ? results[0].value.total : 0
  const kontaktTotal = results[1]?.status === "fulfilled" ? results[1].value.total : 0

  const mergedBuckets: Record<string, number> = { Fiken: 0, Klaviyo: 0, Shopify: 0, Andre: 0 }
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const [k, v] of Object.entries(r.value.buckets)) {
        mergedBuckets[k] = (mergedBuckets[k] ?? 0) + v
      }
    }
  }

  return {
    totalt_uleste: b2bTotal + kontaktTotal,
    kategorier: Object.entries(mergedBuckets).map(([navn, antall]) => ({ navn, antall })),
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
