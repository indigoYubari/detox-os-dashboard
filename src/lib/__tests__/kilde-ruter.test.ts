import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Fire API-ruter serverte fram til 2026-08-25 oppdiktede data med status 200
// ved enhver feil - manglende token inkludert - og bare en av fire konsumenter
// rendret mock-flagget. Denne filen dekker de tre som ikke har egen testfil
// (Shopify ligger i shopify-i-dag-route.test.ts), pluss en generisk vakt som
// ogsaa fanger ruter som skrives i fremtiden.

vi.mock("@/lib/auth-server", () => ({
  requireDetoxUser: async () => ({
    id: "test-user",
    email: "test@detox.no",
    role: "admin",
    scopes: ["detox:read"],
    actorLabel: "test@detox.no",
  }),
  authorize: () => null,
}))

const ROOT = resolve(__dirname, "../../..")

const ENV_KEYS = [
  "SHOPIFY_SHOP_DOMAIN",
  "SHOPIFY_ADMIN_TOKEN",
  "KLAVIYO_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_REFRESH_TOKEN_KONTAKT",
] as const

const lagret: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) lagret[k] = process.env[k]
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (lagret[k] === undefined) delete process.env[k]
    else process.env[k] = lagret[k]
  }
  vi.unstubAllGlobals()
})

async function kallRute(
  modul: string,
  env: Record<string, string | undefined>,
) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const { GET } = (await import(modul)) as { GET: () => Promise<Response> }
  const res = await GET()
  return { res, body: await res.json() }
}

const UTEN_NOKLER: Record<string, undefined> = Object.fromEntries(
  ENV_KEYS.map((k) => [k, undefined]),
)

describe("Klaviyo: /api/klaviyo/siste-kampanje", () => {
  it("gir 503 og ingen tall uten API-nokkel", async () => {
    const { res, body } = await kallRute(
      "../../app/api/klaviyo/siste-kampanje/route",
      UTEN_NOKLER,
    )
    expect(res.status).toBe(503)
    expect(body.error).toBe("klaviyo_not_configured")
    expect(body.data_mode).toBe("unavailable")
    expect(body).not.toHaveProperty("open_rate")
    expect(body).not.toHaveProperty("kampanje_navn")
  })

  it("gir 502 og ingen tall naar Klaviyo svarer feil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    )
    const { res, body } = await kallRute(
      "../../app/api/klaviyo/siste-kampanje/route",
      { ...UTEN_NOKLER, KLAVIYO_API_KEY: "pk_test" },
    )
    expect(res.status).toBe(502)
    expect(body.error).toBe("klaviyo_unavailable")
    expect(body).not.toHaveProperty("open_rate")
  })

  it("lekker aldri den gamle mockkampanjen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    )
    const { body } = await kallRute(
      "../../app/api/klaviyo/siste-kampanje/route",
      { ...UTEN_NOKLER, KLAVIYO_API_KEY: "pk_test" },
    )
    const json = JSON.stringify(body)
    expect(json).not.toContain("Ukens utvalg")
    expect(json).not.toContain("0.41")
  })
})

describe("Gmail uleste: /api/gmail/uleste", () => {
  it("gir 503 og ingen tall uten refresh-tokens", async () => {
    const { res, body } = await kallRute("../../app/api/gmail/uleste/route", {
      ...UTEN_NOKLER,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "hemmelig",
    })
    expect(res.status).toBe(503)
    expect(body.error).toBe("gmail_not_configured")
    expect(body).not.toHaveProperty("totalt_uleste")
    expect(body).not.toHaveProperty("kategorier")
  })

  it("gir 502 - ikke 'null uleste' - naar alle kontoer feiler", async () => {
    // Dette var den farligste varianten: alle kontoer feilet, Promise.allSettled
    // svelget feilene, og ruta svarte 200 med totalt_uleste: 0. En innboks vi
    // ikke klarte aa lese saa dermed ut som en tom innboks.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 400 })),
    )
    const { res, body } = await kallRute("../../app/api/gmail/uleste/route", {
      ...UTEN_NOKLER,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "hemmelig",
      GOOGLE_REFRESH_TOKEN: "rt-b2b",
      GOOGLE_REFRESH_TOKEN_KONTAKT: "rt-kontakt",
    })
    expect(res.status).toBe(502)
    expect(body.error).toBe("gmail_unavailable")
    expect(body.totalt_uleste).toBeUndefined()
  })

  it("lekker aldri de gamle mock-kategoriene", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    )
    const { body } = await kallRute("../../app/api/gmail/uleste/route", {
      ...UTEN_NOKLER,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "hemmelig",
      GOOGLE_REFRESH_TOKEN: "rt-b2b",
    })
    expect(JSON.stringify(body)).not.toContain("Frakt og toll")
  })
})

describe("Gmail kundeservice: /api/gmail/kundeservice", () => {
  it("gir 503 og ingen tom innboks uten OAuth-konfig", async () => {
    const { res, body } = await kallRute(
      "../../app/api/gmail/kundeservice/route",
      UTEN_NOKLER,
    )
    expect(res.status).toBe(503)
    expect(body.error).toBe("gmail_not_configured")
    // Kjernen: en feil skal ikke kunne leses som "ingen henvendelser".
    expect(body).not.toHaveProperty("meldinger")
    expect(body).not.toHaveProperty("totalt")
  })

  it("gir 502 og ingen tom innboks naar Gmail svarer feil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 403 })),
    )
    const { res, body } = await kallRute(
      "../../app/api/gmail/kundeservice/route",
      {
        ...UTEN_NOKLER,
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "hemmelig",
        GOOGLE_REFRESH_TOKEN_KONTAKT: "rt-kontakt",
      },
    )
    expect(res.status).toBe(502)
    expect(body.error).toBe("gmail_unavailable")
    expect(body).not.toHaveProperty("meldinger")
  })
})

// ── Generisk vakt over alle API-ruter ────────────────────────────────────────

function finnRuteFiler(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return finnRuteFiler(full)
    return entry === "route.ts" || entry === "route.tsx" ? [full] : []
  })
}

describe("ingen stille mock-fallback i noen API-rute", () => {
  const ruter = finnRuteFiler(join(ROOT, "src/app/api"))

  it("finner ruter aa sjekke", () => {
    expect(ruter.length).toBeGreaterThan(0)
  })

  it.each(ruter.map((r) => [relative(ROOT, r), r] as const))(
    "%s har ingen mock-konstant",
    (_rel, full) => {
      // Kommentarer strippes: rutenes egne forklaringer paa hvorfor mocken ble
      // fjernet naevner den gamle formen, og skal ikke telle som funn.
      const kode = readFileSync(full, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
      expect(kode).not.toMatch(/const MOCK\b/)
      expect(kode).not.toMatch(/mock:\s*true/)
    },
  )
})
