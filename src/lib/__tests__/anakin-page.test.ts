// Render-test av /anakin (den nye flatens port av /eiere) med datalaget
// mocket til rader slik de ligger i Detox-basen. Tom-/feil-tilstander skal se
// tomme/feil ut, og alt som skrives skal gaa gjennom actions — ikke herfra.
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const radar = vi.fn()
const queue = vi.fn()
const threads = vi.fn()
const content = vi.fn()
const kort = vi.fn()

vi.mock("../eiere-server", () => ({
  fetchLatestRadar: () => radar(),
  fetchQueue: () => queue(),
  fetchThreads: () => threads(),
  fetchOperatorKort: () => kort(),
  REQUEST_ROW_COLUMNS: "id, requester, kind, body, status, created_at",
}))
vi.mock("../content-server", () => ({ fetchContentItems: () => content() }))
vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const REPORT = {
  id: "471180de-3bda-4ef4-bcc8-0edf0e083a51",
  agent_id: "agent-anakinbot",
  report_type: "content-radar",
  period: "2026-09-08",
  status: "artifact_pending",
  requires_review: true,
  created_at: "2026-09-08T05:37:20Z",
  findings: [
    {
      id: "f1",
      kind: "signal",
      claim:
        "Detox.no salgspuls (LIVE via Shopify, 05:30 UTC 2026-09-08): siste 7 dager (01.09-08.09, Europe/Amsterdam) 174 ordrer / 195 408,30 NOK mot 179 ordrer / 193 818,05 NOK uken før (25.08-01.09) — omsetning +0,8 %, ordrer -2,8 %.",
      evidence: null,
      source_url: null,
      confidence: "0.95",
      created_at: "1",
    },
    {
      id: "f2",
      kind: "risk",
      claim: "[KREVER GODKJENNING] Megasporebiotic-PDP er fortsatt RØD",
      evidence: "PDP-en mangler fortsatt erstatningsteksten.",
      source_url: "https://detox.no/products/megasporebiotic-sporebiotika",
      confidence: "1",
      created_at: "2",
    },
    {
      id: "f3",
      kind: "trend",
      claim: "Vitamin D-tilbakekallingsbølgen",
      evidence: null,
      source_url: null,
      confidence: "0.9",
      created_at: "3",
    },
  ],
  recommendations: [
    {
      id: "r1",
      kind: "content",
      action: "B1 mekanisme-karusell om D-vitamin",
      status: "pending",
      owner: "anniken",
      created_at: "1",
    },
    {
      id: "r2",
      kind: "content",
      action: "Klaviyo-utkast: 16 dager uten kampanje",
      status: "pending",
      owner: "anniken",
      created_at: "2",
    },
    {
      id: "r3",
      kind: "content",
      action: "Bygg eid liste",
      status: "approved",
      owner: "anniken",
      created_at: "3",
    },
  ],
}

const REQUEST = {
  id: "0f1e2d3c-0000-4000-8000-000000000001",
  requester: "detox-gpt",
  kind: "content",
  body: "[to:agent-anakinbot] [prio:high] Neste sak: magnesium og søvn",
  status: "open",
  created_at: "2026-09-24T10:00:00Z",
  response: null,
  responded_at: null,
  thread_id: null,
  parent_id: null,
}

async function render() {
  const mod = await import("../../app/(ny)/anakin/page")
  const el = await mod.default()
  return renderToStaticMarkup(React.createElement(React.Fragment, null, el)).replace(
    /[  ]/g,
    " ",
  )
}

beforeEach(() => {
  radar.mockResolvedValue({ ok: true, report: REPORT })
  queue.mockResolvedValue({ ok: true, rows: [] })
  threads.mockResolvedValue({ ok: true, threads: [] })
  content.mockResolvedValue({ ok: true, items: [] })
  kort.mockResolvedValue({ ok: true, kort: null })
})

describe("/anakin", () => {
  it("viser pulsen med retning foerst, planen og briefingen fra radaren", async () => {
    const html = await render()
    expect(html).toContain("Anakins radar fra 2026-09-08.")
    expect(html).toContain("Flatt:")
    expect(html).toContain("195 408 kr på 174 ordrer siste uke")
    expect(html).toContain("Neste trekk:")
    expect(html).toContain("Klaviyo-utkast: 16 dager uten kampanje")
    expect(html).toContain("Megasporebiotic-PDP er fortsatt RØD")
    expect(html).not.toContain("[KREVER GODKJENNING]")
    expect(html).toContain("Krever godkjenning")
  })

  it("tomme baand ser tomme ut — ingen nulltall som svar", async () => {
    const html = await render()
    expect(html).toContain("Ingen svar fra Anakin ennå")
    expect(html).toContain("Ingenting står åpent")
    expect(html).toContain("Ingen innholdsidéer i arbeid")
  })

  it("ingen radar i basen sier det, og gir bare én knapp", async () => {
    radar.mockResolvedValue({ ok: true, report: null })
    const html = await render()
    expect(html).toContain("Ingen radar fra Anakin ennå.")
    expect(html).toContain("Ingen Content Radar fra Anakin i basen.")
    expect(html).not.toContain("Neste trekk")
  })

  it("feil ser ut som feil, med basens egen melding", async () => {
    radar.mockResolvedValue({ ok: false, error: "permission denied for table reports", code: "no_access" })
    queue.mockResolvedValue({ ok: false, error: "fetch failed", code: "other" })
    const html = await render()
    expect(html).toContain("Fikk ikke lest radaren.")
    expect(html).toContain("permission denied for table reports")
    expect(html).toContain("migrasjon 0008")
    expect(html).toContain("Fikk ikke lest køen.")
    expect(html).toContain("fetch failed")
  })

  it("koeen viser prioriteten fra body-hodet, haster foerst", async () => {
    queue.mockResolvedValue({
      ok: true,
      rows: [
        { ...REQUEST, id: "0f1e2d3c-0000-4000-8000-000000000002", body: "Lag utkast til neste ukes innhold", created_at: "2026-09-20T10:00:00Z" },
        REQUEST,
      ],
    })
    const html = await render()
    expect(html).toContain("Ett haster")
    expect(html).toContain("åpne oppdrag")
    expect(html).toContain("Neste sak: magnesium og søvn")
    expect(html).not.toContain("[prio:high]")
    expect(html.indexOf("Neste sak: magnesium og søvn")).toBeLessThan(
      html.indexOf("Lag utkast til neste ukes innhold"),
    )
  })

  it("uken bunter idéene og gir hver av dem knapper", async () => {
    content.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "8b9f1c2e-0000-4000-8000-000000000001",
          title: "Magnesium er ikke ett stoff",
          topic: "magnesium",
          stage: "brief",
          stage_status: "complete",
          channels: ["blogg-detox-no"],
          requested_by: "Kim",
          source_repo: "detox-vault",
          source_path: "x.md",
          data_mode: "live",
          created_at: "2026-09-01T10:00:00Z",
          updated_at: "2026-09-02T10:00:00Z",
          synced_at: null,
        },
      ],
    })
    const html = await render()
    expect(html).toContain("1 idé i arbeid: 1 planlagt")
    expect(html).toContain("Magnesium er ikke ett stoff")
    expect(html).toContain("Be Anakin: lag utkast")
    expect(html).toContain("Snakk om dette")
  })

  it("hele Content Radar ligger bak et klikk naar operator-kortet finnes", async () => {
    kort.mockResolvedValue({
      ok: true,
      kort: { id: "k", period: "2026-09-08", created_at: "2026-09-08T05:40:00Z", text: "Hele radaren som tekst." },
    })
    const html = await render()
    expect(html).toContain("Les hele Content Radar")
    expect(html).toContain("Hele radaren som tekst.")
  })
})
