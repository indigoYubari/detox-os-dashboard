import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Proxyen /api/detox/[...path] (2026-09-15): et svar fra ad-agenten som IKKE er
// JSON - Express sin egen 404-side for en rute som ikke finnes - skal navngis,
// ikke rapporteres som "backend_unavailable" som om ad-agenten var nede.
// /status sto med "Kunne ikke hente" for proposals i to uker av den grunn.

vi.mock("@/lib/auth-server", () => ({
  requireDetoxPrincipal: async () => ({
    id: "test-user",
    email: "test@detox.no",
    role: "admin",
    scopes: ["detox:read", "action:approve", "admin"],
    actorLabel: "test@detox.no",
    principal: "test@detox.no",
    actorType: "human",
    configuredFor: null,
  }),
  authorize: () => null,
  recordActivityEvent: async () => {},
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

async function kall(path: string[]) {
  const { GET } = await import("../../app/api/detox/[...path]/route")
  const req = new NextRequest(`http://localhost/api/detox/${path.join("/")}`)
  const res = await GET(req, { params: { path } })
  return { res, body: await res.json() }
}

describe("/api/detox-proxy: svar som ikke er JSON", () => {
  it("navngir en rute som ikke finnes i ad-agenten (404 HTML)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<pre>Cannot GET /api/proposals</pre>", {
            status: 404,
            headers: { "content-type": "text/html" },
          }),
      ),
    )
    const { res, body } = await kall(["proposals"])
    expect(res.status).toBe(502)
    expect(body.code).toBe("backend_route_missing")
    expect(body.backend_status).toBe(404)
    expect(typeof body.hint).toBe("string")
    expect(body.hint).not.toMatch(/https?:|Cannot GET/)
    expect(res.headers.get("X-Correlation-Id")).toBeTruthy()
  })

  it("skiller et uventet ikke-JSON-svar fra en manglende rute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad Gateway", { status: 502 })),
    )
    const { res, body } = await kall(["metrics"])
    expect(res.status).toBe(502)
    expect(body.code).toBe("backend_bad_response")
    expect(body.backend_status).toBe(502)
  })

  it("holder backend_unavailable for naar fetch selv feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED")
      }),
    )
    const { res, body } = await kall(["metrics"])
    expect(res.status).toBe(502)
    expect(body.code).toBe("backend_unavailable")
    expect(typeof body.hint).toBe("string")
  })

  it("sender JSON-svar uendret videre med ad-agentens status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ hello: "world" }, { status: 200 })),
    )
    const { res, body } = await kall(["metrics", "shopify"])
    expect(res.status).toBe(200)
    expect(body).toEqual({ hello: "world" })
  })
})
