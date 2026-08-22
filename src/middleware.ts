import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { isApiPath, isPublicPath } from "@/lib/auth-policy"

// Alt er beskyttet by default. Offentlige stier er en eksplisitt allow-list
// (auth-policy.ts). API-stier får 401 JSON i stedet for redirect, slik at
// klienter kan skille "ikke innlogget" fra andre feil. Route handlers gjør i
// tillegg sin egen requireDetoxUser-sjekk (defense in depth).
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
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
