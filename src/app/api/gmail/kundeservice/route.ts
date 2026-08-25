import { NextResponse } from "next/server"
import { authorize, requireDetoxUser } from "@/lib/auth-server"
import {
  liveMeta,
  NotConfiguredError,
  sourceErrorResponse,
  type LiveMeta,
} from "@/lib/source-state"

// Ruta faller IKKE tilbake til mock ved feil. Fram til 2026-08-25 returnerte
// den { meldinger: [], totalt: 0, mock: true } med status 200 - altsaa en tom
// innboks - naar Gmail faktisk var utilgjengelig. "Ingen henvendelser" og "vi
// klarte ikke lese innboksen" er to helt ulike beskjeder til et kundeserviceteam.

export const dynamic = "force-dynamic"

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REFRESH_TOKEN_KONTAKT = process.env.GOOGLE_REFRESH_TOKEN_KONTAKT

const MAX_RESULTS = 50
const BATCH = 20

type GmailMessage = {
  id: string
  subject: string
  from: string
  fromName: string
  date: string
  snippet: string
  unread: boolean
  kategori: string
}

type KundeserviceTall = {
  meldinger: GmailMessage[]
  totalt: number
  kategorier: Record<string, number>
}

export type KundeserviceData = KundeserviceTall & LiveMeta

const KATEGORI_REGLER: { nokkelord: string[]; kategori: string }[] = [
  { nokkelord: ["levering", "pakke", "frakt", "forsinkelse", "tracking", "sporing", "ordre"], kategori: "Levering" },
  { nokkelord: ["retur", "bytte", "refusjon", "angre", "klage"], kategori: "Retur/bytte" },
  { nokkelord: ["allergi", "ingrediens", "inneholder", "dosering", "bivirkninger", "amming", "gravid", "soya", "gluten", "melk"], kategori: "Produktinfo" },
  { nokkelord: ["betaling", "faktura", "rabatt", "kode", "kortfeil", "vipps", "klarna"], kategori: "Betaling" },
  { nokkelord: ["abonnement", "pause", "stoppe", "endre", "oppsigelse"], kategori: "Abonnement" },
]

function kategoriser(subject: string, snippet: string): string {
  const tekst = (subject + " " + snippet).toLowerCase()
  for (const regel of KATEGORI_REGLER) {
    if (regel.nokkelord.some((k) => tekst.includes(k))) return regel.kategori
  }
  return "Generelt"
}

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^"?([^"<]+)"?\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim() }
  return { name: from, email: from }
}

async function accessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN_KONTAKT) {
    throw new NotConfiguredError(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET eller GOOGLE_REFRESH_TOKEN_KONTAKT mangler i miljøet",
    )
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN_KONTAKT,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error("Token-feil")
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error("Mangler access_token")
  return json.access_token
}

export async function GET() {
  // Defense in depth: middleware beskytter allerede /api/*, men denne ruten
  // skal ikke vaere avhengig av at den er riktig konfigurert. Se
  // sessions/2026-08-22 - en feilplassert middleware.ts gjorde hele
  // auth-laget inert uten at en eneste test feilet.
  const denied = authorize(await requireDetoxUser(), "detox:read")
  if (denied) return denied

  try {
    const token = await accessToken()

    const listUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=" + MAX_RESULTS
    const listRes = await fetch(listUrl, {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    })
    if (!listRes.ok) throw new Error("Gmail list " + listRes.status)
    const list = (await listRes.json()) as { messages?: { id: string }[] }
    const ids = list.messages ?? []

    const meldinger: GmailMessage[] = []

    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH)
      const results = await Promise.all(
        slice.map(async (m) => {
          const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/" + m.id + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date"
          const r = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
            cache: "no-store",
          })
          if (!r.ok) return null
          return (await r.json()) as {
            id: string
            snippet: string
            labelIds: string[]
            payload?: { headers?: { name: string; value: string }[] }
          }
        })
      )

      for (const msg of results) {
        if (!msg) continue
        const headers = msg.payload?.headers ?? []
        const get = (name: string) =>
          headers.find((h) => h.name === name)?.value ?? ""

        const subject = get("Subject") || "(ingen emne)"
        const from = get("From")
        const date = get("Date")
        const { name: fromName } = parseFrom(from)
        const unread = msg.labelIds?.includes("UNREAD") ?? false

        meldinger.push({
          id: msg.id,
          subject,
          from,
          fromName,
          date,
          snippet: msg.snippet ?? "",
          unread,
          kategori: kategoriser(subject, msg.snippet ?? ""),
        })
      }
    }

    const kategorier: Record<string, number> = {}
    for (const m of meldinger) {
      kategorier[m.kategori] = (kategorier[m.kategori] ?? 0) + 1
    }

    return NextResponse.json<KundeserviceData>({
      meldinger,
      totalt: meldinger.length,
      kategorier,
      ...liveMeta("gmail"),
    })
  } catch (err) {
    console.error("[kundeservice] feil:", String(err))
    return sourceErrorResponse("gmail", err)
  }
}
