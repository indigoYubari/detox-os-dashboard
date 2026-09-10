// Render-test av /radar med datalaget mocket til rader slik de ligger i
// Detox-basen 2026-09-10. Tom-/feil-tilstander skal se tomme/feil ut.
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const radar = vi.fn()
const runState = vi.fn()
const queue = vi.fn()
const findings = vi.fn()
const latestHead = vi.fn()

vi.mock("../eiere-server", () => ({
  fetchLatestRadar: () => radar(),
  fetchRunState: (a: string) => runState(a),
  fetchQueue: () => queue(),
  classifyError: (m: string) =>
    /permission denied|42501/i.test(m) ? "no_access" : "other",
}))
vi.mock("../radar-server", () => ({
  fetchFindings: (f: unknown) => findings(f),
  fetchLatestReportHead: (a: string) => latestHead(a),
  FINDINGS_PER_AGENT: 40,
}))
vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}))

const REPORT = {
  id: "471180de-3bda-4ef4-bcc8-0edf0e083a51",
  agent_id: "agent-anakinbot",
  report_type: "content-radar",
  period: "2026-09-10",
  status: "artifact_pending",
  requires_review: true,
  created_at: "2026-09-10T05:27:46Z",
  findings: [
    {
      id: "f1",
      kind: "signal",
      claim:
        "Detox.no salgspuls (LIVE via Shopify): siste 7 dager (03.09-10.09) 174 ordrer / 195 408,30 NOK mot 179 ordrer / 193 818,05 NOK uken før (27.08-03.09) — omsetning +0,8 %, ordrer -2,8 %.",
      evidence: null,
      source_url: null,
      confidence: "0.95",
      created_at: "1",
    },
    {
      id: "f2",
      kind: "risk",
      claim: "[KREVER GODKJENNING] Megasporebiotic-PDP er fortsatt RØD",
      evidence: null,
      source_url: "https://detox.no/products/megasporebiotic",
      confidence: "1",
      created_at: "2",
    },
    {
      id: "f3",
      kind: "trend",
      claim: "Myrvann kakao trender",
      evidence: null,
      source_url: null,
      confidence: "0.9",
      created_at: "3",
    },
    {
      id: "f4",
      kind: "change",
      claim: "Klaviyo-stillheten fortsetter",
      evidence: null,
      source_url: null,
      confidence: "0.85",
      created_at: "4",
    },
  ],
  recommendations: [],
}

const head = (agent: string, report_type: string, created_at: string) => ({
  ok: true,
  report: {
    id: "r",
    agent_id: agent,
    report_type,
    period: "2026-09-10",
    status: "artifact_pending",
    requires_review: true,
    created_at,
  },
})

const row = (
  id: string,
  agent: string,
  kind: string,
  claim: string,
  report_type: string,
) => ({
  id,
  kind,
  claim,
  evidence: "PMID 12345: dose 400 mg",
  source_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
  confidence: "0.8",
  created_at: "2026-09-10T06:00:00Z",
  report: {
    id: "rep-" + id,
    agent_id: agent,
    report_type,
    period: "2026-09-10",
    status: "artifact_pending",
    requires_review: true,
    created_at: "2026-09-10T06:00:00Z",
  },
})

async function render(searchParams?: Record<string, string>) {
  const mod = await import("../../app/(main)/radar/page")
  const el = await mod.default({ searchParams })
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, el),
  ).replace(/[  ]/g, " ")
}

beforeEach(() => {
  radar.mockResolvedValue({ ok: true, report: REPORT })
  runState.mockImplementation(async (a: string) => ({
    ok: true,
    state: {
      agent_id: a,
      last_successful_run: "2026-09-10T05:27:46Z",
      last_run_status: "ok",
      last_error: null,
      updated_at: "",
    },
  }))
  queue.mockResolvedValue({ ok: true, rows: [] })
  latestHead.mockImplementation(async (a: string) =>
    a === "agent-anakinbot"
      ? head(a, "content-radar", new Date().toISOString())
      : head(
          a,
          "nightly-harvest:magnesium-sleep",
          new Date(Date.now() - 3 * 86_400_000).toISOString(),
        ),
  )
  findings.mockResolvedValue({
    "agent-anakinbot": {
      ok: true,
      rows: [
        row(
          "a1",
          "agent-anakinbot",
          "trend",
          "Myrvann kakao trender",
          "content-radar",
        ),
      ],
    },
    "agent-indigobot": {
      ok: true,
      rows: [
        row(
          "i1",
          "agent-indigobot",
          "watch",
          "Magnesium-glysinat og soevnlatens",
          "nightly-harvest:magnesium-sleep",
        ),
      ],
    },
  })
})

describe("/radar", () => {
  it("viser I dag (tre funn, pulsen unntatt), PULS og ferskhet per agent", async () => {
    const html = await render()
    expect(html).toContain("I dag — Content Radar 2026-09-10")
    expect(html).toContain("Megasporebiotic-PDP er fortsatt RØD")
    expect(html).toContain("krever godkjenning")
    expect(html).toContain("kr 195 408")
    expect(html).toContain("+0,8 % vs forrige uke")
    expect(html).toContain("Fersk")
    expect(html).toContain("STALE — ingen rapport siste 48 t")
    expect(html).toContain("kwrjhyytvbcaiszbfria")
  })
  it("viser begge agent-kolonner med kind, story, evidens og kilde", async () => {
    const html = await render()
    expect(html).toContain("Anakin — marked · 1 funn")
    expect(html).toContain("Indigo — research · 1 funn")
    expect(html).toContain("magnesium-sleep")
    expect(html).toContain("PMID 12345")
    expect(html).toContain("https://pubmed.ncbi.nlm.nih.gov/12345/")
    expect(html).toContain("ikke gjennomgaatt")
    expect(html).toContain("conf 80 %")
  })
  it("respekterer filtre: kun Indigo, 30 d, kind=watch", async () => {
    const html = await render({
      agent: "indigo",
      periode: "30d",
      kind: "watch",
    })
    expect(findings).toHaveBeenCalledWith({
      agent: "indigo",
      periode: "30d",
      kind: "watch",
    })
    expect(html).toContain("Indigo — research")
    expect(html).not.toContain("Anakin — marked")
    expect(html).toContain("kind=watch")
    expect(html).toContain("(30 d)")
  })
  it("tom koe og tomme kolonner ser tomme ut", async () => {
    findings.mockResolvedValue({
      "agent-anakinbot": { ok: true, rows: [] },
      "agent-indigobot": { ok: true, rows: [] },
    })
    const html = await render()
    expect(html).toContain("Koeen er tom.")
    expect(html).toContain("Ingen funn fra Anakin i valgt periode.")
    expect(html).toContain("Ingen funn fra Indigo i valgt periode.")
  })
  it("feil ved lesing vises som feil, med 0008-hint ved permission denied", async () => {
    findings.mockResolvedValue({
      "agent-anakinbot": {
        ok: false,
        error: "permission denied for table findings",
        code: "no_access",
      },
      "agent-indigobot": { ok: true, rows: [] },
    })
    radar.mockResolvedValue({ ok: false, error: "boom", code: "other" })
    const html = await render()
    expect(html).toContain("Kunne ikke lese findings / reports")
    expect(html).toContain("0008_shared_state_owner_access.sql")
    expect(html).toContain(
      "Kunne ikke lese reports / findings / recommendations",
    )
  })
  it("koeen er kun lesing og peker til /eiere", async () => {
    queue.mockResolvedValue({
      ok: true,
      rows: [
        {
          id: "abcdef12-0000-0000-0000-000000000000",
          requester: "kim@detox.no",
          kind: "content",
          body: "[generate_week] til: agent-anakinbot · radar 2026-09-10\nLag forslag til neste uke.",
          status: "open",
          created_at: "2026-09-10T08:00:00Z",
        },
      ],
    })
    const html = await render()
    expect(html).toContain("Godkjenningskoe — 1 venter")
    expect(html).toContain("Neste ukes innhold")
    expect(html).toContain("Lag forslag til neste uke.")
    expect(html).toContain("gjoeres paa /eiere")
    // eneste <button> paa siden er filter-formens "Filtrer" — ingen koe-handlinger
    expect(html.match(/<button/g)?.length ?? 0).toBe(1)
    expect(html).not.toContain(">Godkjenn<")
    expect(html).not.toContain(">Avvis<")
    expect(html).toContain("<form method=\"get\" action=\"/radar\"")
  })
})
