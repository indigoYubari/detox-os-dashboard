import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { isPublicPath } from "@/lib/auth-policy"
import {
  lenkeFeilmelding,
  tilbakestillingsAdresse,
  trygtNeste,
  validerNyttPassord,
} from "@/lib/passord"

// «Glemt passord» ble merget 26.09 uten å virke: /glemt-passord lå bak
// innloggingen, og /oppdater-passord lette etter access_token i adressen mens
// @supabase/ssr sender ?code=… (PKCE). Disse testene låser hele kjeden.

describe("tilbakestillingsAdresse", () => {
  it("peker på callback-ruten, som videre sender til /oppdater-passord", () => {
    expect(tilbakestillingsAdresse("https://os.detox.no")).toBe(
      "https://os.detox.no/auth/callback?next=%2Foppdater-passord",
    )
  })
})

describe("trygtNeste (ingen åpen omdirigering)", () => {
  it("godtar interne stier", () => {
    expect(trygtNeste("/oppdater-passord")).toBe("/oppdater-passord")
    expect(trygtNeste("/koe")).toBe("/koe")
  })
  it("faller tilbake til /oppdater-passord for alt annet", () => {
    for (const v of [null, undefined, "", "https://evil.no", "//evil.no", "/\\evil.no", "evil"]) {
      expect(trygtNeste(v)).toBe("/oppdater-passord")
    }
  })
})

describe("validerNyttPassord", () => {
  it("krever minst 8 tegn", () => {
    expect(validerNyttPassord("kort", "kort")).toMatch(/minst 8/)
  })
  it("krever at passordene er like", () => {
    expect(validerNyttPassord("langtpassord1", "langtpassord2")).toMatch(/stemmer ikke/)
  })
  it("godtar et gyldig passord", () => {
    expect(validerNyttPassord("langtpassord1", "langtpassord1")).toBeNull()
  })
})

describe("lenkeFeilmelding", () => {
  it("forklarer en lenke som ikke virket", () => {
    expect(lenkeFeilmelding("lenke")).toMatch(/utløpt/)
  })
  it("viser ingenting ellers", () => {
    expect(lenkeFeilmelding(null)).toBeNull()
    expect(lenkeFeilmelding("noe-annet")).toBeNull()
  })
})

describe("offentlige stier i passordflyten", () => {
  it("den som har glemt passordet, når /glemt-passord og /auth/callback uten sesjon", () => {
    expect(isPublicPath("/glemt-passord")).toBe(true)
    expect(isPublicPath("/auth/callback")).toBe(true)
  })
  it("/oppdater-passord krever sesjon", () => {
    expect(isPublicPath("/oppdater-passord")).toBe(false)
  })
})

const exchangeCodeForSession = vi.fn()
vi.mock("@/lib/auth-server", () => ({
  createSupabaseServerClient: () => ({ auth: { exchangeCodeForSession } }),
}))

async function kallCallback(query: string) {
  const { GET } = await import("../../app/auth/callback/route")
  const res = await GET(new NextRequest(`https://os.detox.no/auth/callback${query}`))
  return { status: res.status, location: res.headers.get("location") }
}

describe("/auth/callback", () => {
  beforeEach(() => exchangeCodeForSession.mockReset())

  it("veksler inn koden og sender til /oppdater-passord", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const { status, location } = await kallCallback("?code=abc&next=%2Foppdater-passord")
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc")
    expect(status).toBe(307)
    expect(location).toBe("https://os.detox.no/oppdater-passord")
  })

  it("sender tilbake til /glemt-passord når Supabase sier lenken er utløpt", async () => {
    const { location } = await kallCallback(
      "?error=access_denied&error_code=otp_expired&next=%2Foppdater-passord",
    )
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(location).toBe("https://os.detox.no/glemt-passord?feil=lenke")
  })

  it("sender tilbake til /glemt-passord når koden ikke kan veksles inn", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } })
    const { location } = await kallCallback("?code=brukt")
    expect(location).toBe("https://os.detox.no/glemt-passord?feil=lenke")
  })

  it("følger aldri en ekstern next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const { location } = await kallCallback("?code=abc&next=%2F%2Fevil.no")
    expect(location).toBe("https://os.detox.no/oppdater-passord")
  })
})
