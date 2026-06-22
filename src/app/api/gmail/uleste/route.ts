import { NextResponse } from "next/server"

// Server-side route for uleste e-poster i innboksen, kategorisert per avsender.
//
// OAUTH: bruker refresh-token-modell. Access token utløper hver time, så vi
// bytter refresh_token -> ferskt access_token ved hvert kall. Trenger tre env:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Mangler noen av dem -> ruten gir mock stille. Se scripts/google-oauth.mjs
// for hvordan du henter refresh-token (engangsjobb).
export const dynamic = "force-dynamic"

type Kategori = { navn: string; antall: number }
type GmailData = {
  totalt_uleste: number
  kategorier: Kategori[]
  mock?: true
}

// Realistisk mock slik at kortet viser noe meningsfullt før OAuth er på plass.
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
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN

// Klassifiser en avsenderadresse til en av de fire bøttene.
function kategoriForAvsender(from: string): string {
  const f = from.toLowerCase()
  if (f.includes("fiken")) return "Fiken"
  if (f.includes("klaviyo")) return "Klaviyo"
  if (f.includes("shopify")) return "Shopify"
  return "Andre"
}

// Bytt refresh_token mot et ferskt access_token via Google OAuth2 token-endpoint.
async function accessTokenFromRefresh(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Google OAuth ikke konfigurert")
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error(`Google token svarte ${res.status}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error("Mangler access_token i token-svar")
  return json.access_token
}

async function fetchGmail(): Promise<GmailData> {
  const token = await accessTokenFromRefresh()

  // Hent uleste meldings-ID-er i innboksen.
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages" +
      "?q=is:unread+in:inbox&maxResults=100",
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  )
  if (!listRes.ok) throw new Error(`Gmail svarte ${listRes.status}`)
  const list = (await listRes.json()) as { messages?: { id: string }[] }
  const ids = list.messages ?? []

  // Hent avsender per melding og bygg kategoritelling.
  const buckets: Record<string, number> = {
    Fiken: 0,
    Klaviyo: 0,
    Shopify: 0,
    Andre: 0,
  }
  await Promise.all(
    ids.map(async (m) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}` +
          "?format=metadata&metadataHeaders=From",
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      )
      if (!r.ok) return
      const msg = (await r.json()) as {
        payload?: { headers?: { name: string; value: string }[] }
      }
      const from =
        msg.payload?.headers?.find((h) => h.name === "From")?.value ?? ""
      buckets[kategoriForAvsender(from)] += 1
    }),
  )

  return {
    totalt_uleste: ids.length,
    kategorier: Object.entries(buckets).map(([navn, antall]) => ({
      navn,
      antall,
    })),
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
