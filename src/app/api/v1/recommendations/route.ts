import { NextResponse } from "next/server"

import { authorize, requireDetoxPrincipal } from "@/lib/auth-server"
import { backendAuthHeaders, DETOX_BACKEND_URL } from "@/lib/detox-backend"

// GET /api/v1/recommendations - hva annonsemotoren har flagget som verdt å se på.
//
// DATAKILDE (live-verifisert 2026-08-22 mot prod): ad-automation-agent sin
// `recommendations`-tabell, via `GET /api/recommendations`. Ruten svarte 200
// med ekte data: 200+ åpne anbefalinger, nyeste generert samme døgn kl. 04:00,
// eldste 9. august. Motoren kjører daglig.
//
// Denne ruten erstatter IKKE en godkjenningsflate. `action_proposals` -
// datakilden bak den gamle /api/v1/approvals - er bevist død i produksjon
// (`GET /api/proposals` -> 502), og godkjenningsruten er tatt ut av v1.
// Anbefalinger er observasjoner, ikke handlingsforslag som venter på et ja.
// Ingen approve/reject eksponeres her, og GPT-en skal aldri omtale dem som
// noe som "venter på godkjenning".
//
// Ingen mock-fallback: feiler backenden, sier vi det (mandatets §13).
export const dynamic = "force-dynamic"

const MAX_LIMIT = 50

type BackendRecommendation = {
  id: number | string
  channel: string
  entity_id: string | null
  type: string
  severity: string
  title: string
  description: string | null
  status: string
  created_at: string
}

export async function GET(request: Request) {
  const principal = await requireDetoxPrincipal()
  const denied = authorize(principal, "detox:read")
  if (denied) return denied

  const url = new URL(request.url)
  const parsedLimit = Number(url.searchParams.get("limit"))
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : 20
  const channel = url.searchParams.get("channel")

  const backendUrl = new URL(`${DETOX_BACKEND_URL}/api/recommendations`)
  backendUrl.searchParams.set("status", "open")
  // Hent litt flere enn vi returnerer, slik at counts beskriver hele det åpne
  // settet og ikke bare den avkortede listen.
  backendUrl.searchParams.set("limit", "500")
  if (channel) backendUrl.searchParams.set("channel", channel)

  try {
    const res = await fetch(backendUrl, {
      headers: backendAuthHeaders(),
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Kunne ikke hente anbefalinger",
          code: "backend_error",
          backend_status: res.status,
        },
        { status: 502 },
      )
    }

    const data = (await res.json()) as {
      recommendations?: BackendRecommendation[]
    }
    const all = data.recommendations ?? []

    const counts = {
      total: all.length,
      by_severity: {} as Record<string, number>,
      by_channel: {} as Record<string, number>,
    }
    for (const r of all) {
      counts.by_severity[r.severity] = (counts.by_severity[r.severity] ?? 0) + 1
      counts.by_channel[r.channel] = (counts.by_channel[r.channel] ?? 0) + 1
    }

    // Backenden sorterer allerede critical -> warning -> info, deretter nyeste
    // først. Vi beholder den rekkefølgen i stedet for å finne på vår egen.
    const recommendations = all.slice(0, limit).map((r) => ({
      id: String(r.id),
      channel: r.channel,
      entity: r.entity_id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      created_at: r.created_at,
    }))

    const timestamps = all
      .map((r) => r.created_at)
      .filter(Boolean)
      .sort()

    return NextResponse.json({
      data_source: "live",
      source: "ad-automation-agent recommendations",
      generated_latest: timestamps.length
        ? timestamps[timestamps.length - 1]
        : null,
      generated_oldest: timestamps.length ? timestamps[0] : null,
      counts,
      returned: recommendations.length,
      truncated: all.length > recommendations.length,
      recommendations,
      caveat:
        "Dette er observasjoner fra annonsemotoren, ikke handlingsforslag som venter på godkjenning. Ingen av dem er godkjent, avvist eller behandlet, og rekkefølgen er alvorlighetsgrad og alder - ikke en prioritering gjort av et menneske.",
    })
  } catch {
    return NextResponse.json(
      { error: "Backend utilgjengelig", code: "backend_unavailable" },
      { status: 502 },
    )
  }
}
