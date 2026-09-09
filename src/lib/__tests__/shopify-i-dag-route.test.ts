import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Denne testen finnes fordi ruta fram til 2026-08-25 svarte 200 OK med
// oppdiktede tall - { ordrer_i_dag: 7, omsetning_i_dag: 8420 } - ved enhver
// feil, manglende Shopify-token inkludert. /i-dag rendret aldri mock-flagget,
// saa forsiden kunne vise fabrikkert omsetning som dagens virkelighet.
// Testen sjekker ikke at koden ser riktig ut; den kaller ruta og ser paa svaret.

vi.mock("@/lib/auth-server", () => ({
  // Ruta skal komme forbi auth i disse testene - det er feilhaandteringen
  // nedenfor som er under test, ikke autorisasjonen (den dekkes av
  // route-auth.test.ts).
  requireDetoxUser: async () => ({
    id: "test-user",
    email: "test@detox.no",
    role: "admin",
    scopes: ["detox:read"],
    actorLabel: "test@detox.no",
  }),
  authorize: () => null,
}))

// Verdiene den gamle mocken serverte. Ingen av dem skal kunne naa en klient.
const FORBUDTE_MOCKVERDIER = [7, 8420, 1203]

async function kallRute(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const { GET } = await import("../../app/api/shopify/i-dag/route")
  const res = await GET()
  return { res, body: await res.json() }
}

const ENV_KEYS = ["SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ADMIN_TOKEN"] as const
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

describe("/api/shopify/i-dag - ingen stille mock", () => {
  it("gir 503 og ingen tall naar Shopify ikke er konfigurert", async () => {
    const { res, body } = await kallRute({
      SHOPIFY_SHOP_DOMAIN: undefined,
      SHOPIFY_ADMIN_TOKEN: undefined,
    })

    expect(res.status).toBe(503)
    expect(body.error).toBe("shopify_not_configured")
    expect(body.data_mode).toBe("unavailable")
    // Kjernepaastanden: ingen omsetningstall i det hele tatt.
    expect(body).not.toHaveProperty("omsetning_i_dag")
    expect(body).not.toHaveProperty("ordrer_i_dag")
    expect(body.mock).toBeUndefined()
  })

  it("gir 502 og ingen tall naar Shopify svarer feil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    )
    const { res, body } = await kallRute({
      SHOPIFY_SHOP_DOMAIN: "detox-test.myshopify.com",
      SHOPIFY_ADMIN_TOKEN: "test-token",
    })

    expect(res.status).toBe(502)
    expect(body.error).toBe("shopify_unavailable")
    expect(body).not.toHaveProperty("omsetning_i_dag")
  })

  it("gir 502 og ingen tall naar nettverket faller ut", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED")
      }),
    )
    const { res, body } = await kallRute({
      SHOPIFY_SHOP_DOMAIN: "detox-test.myshopify.com",
      SHOPIFY_ADMIN_TOKEN: "test-token",
    })

    expect(res.status).toBe(502)
    expect(body.error).toBe("shopify_unavailable")
    expect(body).not.toHaveProperty("omsetning_i_dag")
  })

  it("lekker aldri de gamle mockverdiene i et feilsvar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 429 })),
    )
    const { body } = await kallRute({
      SHOPIFY_SHOP_DOMAIN: "detox-test.myshopify.com",
      SHOPIFY_ADMIN_TOKEN: "test-token",
    })

    const tall = JSON.stringify(body).match(/\d+/g) ?? []
    for (const forbudt of FORBUDTE_MOCKVERDIER) {
      expect(tall).not.toContain(String(forbudt))
    }
  })

  it("gir ekte tall merket data_mode=live naar Shopify svarer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              orders: [
                { total_price: "500.00", currency: "NOK", cancelled_at: null },
                { total_price: "300.00", currency: "NOK", cancelled_at: null },
                // Kansellert ordre skal ikke telles med.
                {
                  total_price: "999.00",
                  currency: "NOK",
                  cancelled_at: "2026-08-25T10:00:00Z",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    )
    const { res, body } = await kallRute({
      SHOPIFY_SHOP_DOMAIN: "detox-test.myshopify.com",
      SHOPIFY_ADMIN_TOKEN: "test-token",
    })

    expect(res.status).toBe(200)
    expect(body.ordrer_i_dag).toBe(2)
    expect(body.omsetning_i_dag).toBe(800)
    expect(body.snitt_ordreverdi).toBe(400)
    expect(body.data_mode).toBe("live")
    expect(body.source).toBe("shopify")
    expect(typeof body.generated_at).toBe("string")
  })

  it("gir en aerlig nulltilstand naar butikken ikke har ordrer i dag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ orders: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    )
    const { res, body } = await kallRute({
      SHOPIFY_SHOP_DOMAIN: "detox-test.myshopify.com",
      SHOPIFY_ADMIN_TOKEN: "test-token",
    })

    // Null ordrer er et gyldig svar, ikke en feil - og ikke en grunn til mock.
    expect(res.status).toBe(200)
    expect(body.ordrer_i_dag).toBe(0)
    expect(body.omsetning_i_dag).toBe(0)
    expect(body.data_mode).toBe("live")
  })
})

describe("kildekode-vakt", () => {
  it("ruta inneholder ingen mock-konstant", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const src = readFileSync(
      resolve(__dirname, "../../app/api/shopify/i-dag/route.ts"),
      "utf-8",
    )
    // Kommentarer strippes foerst: rutas egen forklaring paa hvorfor mocken
    // ble fjernet naevner den gamle formen, og skal ikke telle som funn.
    const kode = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
    // En fremtidig "midlertidig" fallback skal velte denne testen.
    expect(kode).not.toMatch(/const MOCK\b/)
    expect(kode).not.toMatch(/mock:\s*true/)
  })
})
