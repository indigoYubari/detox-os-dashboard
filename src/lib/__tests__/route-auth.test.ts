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
      expect(
        source.includes("requireDetoxUser"),
        `${rel} stoler kun paa middleware. Legg til requireDetoxUser, eller ` +
          `foer ruten opp i UNPROTECTED_ROUTES med en begrunnelse.`,
      ).toBe(true)
    },
  )
})
