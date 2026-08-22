import { NextResponse } from "next/server"

import { authorize, requireDetoxUser } from "@/lib/auth-server"
import { backendAuthHeaders, DETOX_BACKEND_URL } from "@/lib/detox-backend"

// GET /api/v1/approvals - hva som venter på menneskelig godkjenning.
// Andre byggekloss for Custom GPT ("hva venter på min godkjenning?").
// Leser ventende action_proposals fra ad-agenten og returnerer et
// data-minimert utvalg av felt. Selve godkjenningen eksponeres IKKE i v1.
export const dynamic = "force-dynamic"

type BackendProposal = {
  id: string
  channel: string
  entity_name: string | null
  recommendation_type: string
  priority: string
  suggested_action: string
  created_at: string
}

export async function GET() {
  const user = await requireDetoxUser()
  const denied = authorize(user, "detox:read")
  if (denied) return denied

  try {
    const res = await fetch(
      `${DETOX_BACKEND_URL}/api/proposals?status=pending&limit=50`,
      { headers: backendAuthHeaders(), cache: "no-store" },
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: "Kunne ikke hente godkjenninger", code: "backend_error" },
        { status: 502 },
      )
    }
    const data = (await res.json()) as { proposals?: BackendProposal[] }
    const approvals = (data.proposals ?? []).map((p) => ({
      id: p.id,
      channel: p.channel,
      entity_name: p.entity_name,
      type: p.recommendation_type,
      priority: p.priority,
      suggested_action: p.suggested_action,
      created_at: p.created_at,
    }))
    return NextResponse.json({ approvals, count: approvals.length })
  } catch {
    return NextResponse.json(
      { error: "Backend utilgjengelig", code: "backend_unavailable" },
      { status: 502 },
    )
  }
}
