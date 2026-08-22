import { NextResponse } from "next/server"

import { authorize, requireDetoxPrincipal } from "@/lib/auth-server"

// GET /api/v1/approvals - TATT UT AV v1. Datakilden er bevist død.
//
// Ruten leste `${DETOX_BACKEND_URL}/api/proposals`. Live-verifisert mot prod
// 2026-08-22, innlogget som admin:
//
//   GET /api/v1/approvals          -> 502 backend_error
//   GET /api/detox/proposals       -> 502 backend_unavailable
//   GET /api/detox/health          -> 200   (backenden er oppe)
//   GET /api/detox/recommendations -> 200   (ekte data)
//
// Backenden svarer altså - det er `/api/proposals` som ikke finnes der.
// Ruten ble aldri merget til ad-automation-agent sin `main`; den lever kun i
// branchen `feat/action-proposals` (3385a6e, 2026-06-18). Ordet "proposal"
// finnes ikke i én eneste fil på main. Dokumentasjonen antok at prod lå FORAN
// git main - det motsatte er tilfellet.
//
// Ruten beholdes med et eksplisitt 410 i stedet for å fjernes, slik at en
// klient som fortsatt kaller den får et ærlig svar i stedet for en 502 som
// ser ut som en forbigående feil. Den er fjernet fra OpenAPI-specen, så ingen
// GPT vil kalle den.
//
// Gjenåpning krever at `feat/action-proposals` faktisk merges og deployes, og
// at `action_proposals`-tabellen verifiseres i ad-agentens egen Supabase
// (rggrfwcvauatgmtwuwmj) - som verken MindMatter- eller Detox-tokenet når i dag.
export const dynamic = "force-dynamic"

export async function GET() {
  const principal = await requireDetoxPrincipal()
  const denied = authorize(principal, "detox:read")
  if (denied) return denied

  return NextResponse.json(
    {
      error:
        "Godkjenninger er ikke tilgjengelig. Datakilden (action_proposals) er ikke deployet i produksjon.",
      code: "capability_unavailable",
      verified_at: "2026-08-22",
    },
    { status: 410 },
  )
}
