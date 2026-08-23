import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  GPT_CREDENTIAL_HEADER,
  isApiPath,
  isPublicPath,
} from "@/lib/auth-policy"

// Alt er beskyttet by default. Offentlige stier er en eksplisitt allow-list
// (auth-policy.ts). API-stier får 401 JSON i stedet for redirect, slik at
// klienter kan skille "ikke innlogget" fra andre feil. Route handlers gjør i
// tillegg sin egen requireDetoxUser-sjekk (defense in depth).
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Custom GPT-klienter har ingen Supabase-cookie. Requests som bærer
  // GPT-headeren slippes videre til route handleren, som ER den som
  // autentiserer dem (requireDetoxPrincipal -> sha256-verifisering).
  //
  // Dette er delegering, ikke tillit: en ugyldig credential blir avvist med
  // 401 av ruten. At requesten når ruten er nettopp det som gjør at en
  // GYLDIG GPT-identitet får 403 - ikke 401 - når den forsøker en operasjon
  // utenfor sine scopes. Det er slicens viktigste negative test (mandatets
  // §21/§22), og den ville vært umulig å skille fra "ikke innlogget" hvis
  // middleware stoppet requesten her.
  //
  // Avgrenset til /api/*: sider har ingen maskinbruker og skal fortsatt
  // redirecte til /login.
  if (isApiPath(pathname) && request.headers.has(GPT_CREDENTIAL_HEADER)) {
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: "Ikke innlogget", code: "unauthenticated" },
        { status: 401 },
      )
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
