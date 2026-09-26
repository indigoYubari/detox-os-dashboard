import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseServerClient } from "@/lib/auth-server"
import { LENKE_FEIL, trygtNeste } from "@/lib/passord"

// Landingssiden for lenken i «tilbakestill passord»-e-posten. Supabase sender
// ?code=… (PKCE); vi veksler den inn i en sesjon-cookie og sender brukeren
// videre. Offentlig sti (auth-policy.ts): brukeren har ingen sesjon ennå.
// Utløpt eller brukt lenke kommer hit uten code (Supabase legger på ?error=…).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const feilet = new URL(`/glemt-passord?feil=${LENKE_FEIL}`, origin)

  if (!code) return NextResponse.redirect(feilet)

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(feilet)

  return NextResponse.redirect(new URL(trygtNeste(searchParams.get("next")), origin))
}
