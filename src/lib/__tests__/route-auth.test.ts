import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { describe, expect, it } from "vitest"

// Disse testene finnes fordi 2026-08-22-hendelsen slapp gjennom en full gronn
// testsuite. middleware.ts laa i repo-roten, Next.js laster kun
// src/middleware.ts naar prosjektet bruker src/-katalog, og hele auth-laget var
// derfor inert i produksjon i to maaneder. Fem API-ruter eksponerte kundenavn
// og e-postadresser anonymt. Verken tsc, lint, build eller 17 enhetstester saa
// det, fordi de alle sjekker at koden er riktig - ikke at den kjores.

const ROOT = resolve(__dirname, "../../..")

describe("middleware-plassering", () => {
  it("ligger i src/, der Next.js faktisk laster den", () => {
    expect(existsSync(join(ROOT, "src/middleware.ts"))).toBe(true)
  })

  it("ligger ikke i repo-roten, der den ignoreres stille", () => {
    // Et prosjekt med src/-katalog maa ha middleware i src/. En fil i roten gir
    // ingen advarsel og ingen byggfeil - den kjorer bare aldri.
    expect(existsSync(join(ROOT, "middleware.ts"))).toBe(false)
  })
})

// Ruter som med vilje er naabare uten sesjon. Hver oppforing er en bevisst
// beslutning, ikke en forglemmelse.
const UNPROTECTED_ROUTES: string[] = []

function findRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return findRouteFiles(full)
    return entry === "route.ts" || entry === "route.tsx" ? [full] : []
  })
}

describe("route-level auth (defense in depth)", () => {
  const apiDir = join(ROOT, "src/app/api")
  const routes = findRouteFiles(apiDir)

  it("finner API-ruter aa sjekke", () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  it.each(routes.map((r) => [relative(ROOT, r), r] as const))(
    "%s gjor sin egen auth-sjekk",
    (rel, full) => {
      if (UNPROTECTED_ROUTES.includes(rel)) return
      const source = readFileSync(full, "utf-8")
      // Middleware skal vaere ett lag, ikke eneste lag. En rute som kun er
      // trygg fordi middleware er riktig konfigurert, er ikke trygg.
      //
      // requireDetoxPrincipal er den nye inngangen: den autentiserer bade
      // mennesker (cookie-sesjon) og maskiner (GPT-credential). Begge navn
      // godtas, men ruten maa faktisk KALLE ett av dem.
      //
      // Import-linjene fjernes foer sjekken. En sabotasjetest 2026-08-22 viste
      // at det ikke holder aa lete etter navnet: en rute der kallet var revet
      // ut, men importen sto igjen, besto testen. Det er samme feilklasse som
      // middleware-defekten - koden nevnes, men kjores ikke.
      const withoutImports = source
        .split("\n")
        .filter((line) => !/^\s*(import|\s+[\w{},*]+ from)\b/.test(line))
        .join("\n")
      expect(
        /\b(requireDetoxUser|requireDetoxPrincipal)\s*\(/.test(withoutImports),
        `${rel} stoler kun paa middleware. Kall requireDetoxPrincipal(), ` +
          `eller foer ruten opp i UNPROTECTED_ROUTES med en begrunnelse.`,
      ).toBe(true)
    },
  )
})

// Middleware slipper requests med GPT-headeren videre til route handleren.
// Det er en bevisst delegering - men den er kun trygg saa lenge handleren
// faktisk verifiserer credentialen. Disse testene feiler hvis delegeringen
// blir staaende igjen uten sin motpart.

describe("GPT-maskinauth (delegering fra middleware)", () => {
  const middleware = readFileSync(join(ROOT, "src/middleware.ts"), "utf-8")
  const authServer = readFileSync(join(ROOT, "src/lib/auth-server.ts"), "utf-8")
  const gptAuth = readFileSync(join(ROOT, "src/lib/gpt-auth.ts"), "utf-8")

  it("middleware slipper kun API-stier videre paa GPT-headeren", () => {
    // Sider har ingen maskinbruker og skal fortsatt redirecte til /login.
    expect(middleware).toContain("GPT_CREDENTIAL_HEADER")
    expect(middleware).toMatch(
      /isApiPath\(pathname\)\s*&&\s*request\.headers\.has\(GPT_CREDENTIAL_HEADER\)/,
    )
  })

  it("requireDetoxPrincipal verifiserer credentialen, ikke bare headeren", () => {
    expect(authServer).toContain("authenticateGptRequest")
    // Fallback til menneskelig sesjon maa fortsatt finnes, ellers ville
    // dashboardet mistet sin egen auth.
    expect(authServer).toContain("requireDetoxUser()")
  })

  it("verifiseringen er en hash-sammenligning, ikke en tilstedevaerelsessjekk", () => {
    expect(gptAuth).toContain("sha256")
    expect(gptAuth).toContain("timingSafeEqual")
  })

  it("maskinauth bruker aldri service_role-noekkelen", () => {
    // Sjekker faktisk BRUK, ikke omtale: modulen forklarer i en kommentar
    // hvorfor service_role er forbudt, og den forklaringen skal ikke felle
    // testen. Kun et env-oppslag ville vaere et reelt funn.
    expect(gptAuth).not.toMatch(/process\.env\.[A-Z_]*SERVICE_ROLE/)
    expect(gptAuth).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  })

  it("ingen credential eller passord er hardkodet i kilden", () => {
    // Kun env-oppslag - aldri en literal.
    expect(gptAuth).toContain("process.env.KIM_GPT_CREDENTIAL_SHA256")
    expect(gptAuth).toContain("process.env.KIM_GPT_SUPABASE_PASSWORD")
    expect(gptAuth).not.toMatch(/CREDENTIAL_SHA256\s*=\s*["\']/)
  })
})
