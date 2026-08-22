import { NextResponse } from "next/server"

import { requireDetoxUser, unauthenticatedResponse } from "@/lib/auth-server"

// GET /api/v1/me - minimal autentisert identitet + capabilities.
// Første byggekloss for Custom GPT ("hvem er jeg?"). Data-minimert:
// ingen interne DB-detaljer, ingen metadata utover rolle/scopes.
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await requireDetoxUser()
  if (!user) return unauthenticatedResponse()

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    scopes: user.scopes,
  })
}
