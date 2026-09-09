import { NextResponse } from "next/server"

import {
  requireDetoxPrincipal,
  unauthenticatedResponse,
} from "@/lib/auth-server"

// GET /api/v1/me - minimal autentisert identitet + capabilities.
// Første byggekloss for Custom GPT ("hvilken kontekst har jeg?"). Data-minimert:
// ingen interne DB-detaljer, ingen metadata utover rolle/scopes.
//
// For en maskinidentitet skiller svaret eksplisitt mellom HVEM som handlet
// (`principal`, `actor_type`) og HVEM GPT-en er konfigurert for
// (`configured_for`). Kim og Anniken deler én ChatGPT-konto, så `kim-gpt`
// betyr "requesten kom via Kim GPT" - aldri "Kim skrev dette".
export const dynamic = "force-dynamic"

export async function GET() {
  const principal = await requireDetoxPrincipal()
  if (!principal) return unauthenticatedResponse()

  return NextResponse.json({
    principal: principal.principal,
    actor_type: principal.actorType,
    configured_for: principal.configuredFor,
    role: principal.role,
    scopes: principal.scopes,
    // Beholdes for dashboardet og bakoverkompatibilitet. For en maskinidentitet
    // er dette maskinbrukerens egen konto, ikke et menneskes.
    id: principal.id,
    email: principal.email,
    identity_note:
      principal.actorType === "service"
        ? `Denne forespørselen kom via maskinidentiteten ${principal.principal}, konfigurert for ${principal.configuredFor}. Den er ikke bevis for at ${principal.configuredFor} personlig utførte handlingen.`
        : null,
  })
}
