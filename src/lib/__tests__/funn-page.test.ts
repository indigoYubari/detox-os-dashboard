// Render-test av /funn (den nye flatens port av /radar) med datalaget mocket
// til rader slik de ligger i Detox-basen. Tom-/feil-tilstander skal se
// tomme/feil ut.
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const findings = vi.fn()
const latestHead = vi.fn()

vi.mock("../radar-server", () => ({
  fetchFindings: (f: unknown) => findings(f),
  fetchLatestReportHead: (a: string) => latestHead(a),
  FINDINGS_PER_AGENT: 40,
}))
vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}))

const NAA = Date.now()
const iso = (timerSiden: number) => new Date(NAA - timerSiden * 3_600_000).toISOString()

const head = (agent: string, report_type: string, created_at: string) => ({
  ok: true,
  report: {
    id: "r",
    agent_id: agent,
    report_type,
    period: "2026-09-24",
    status: "artifact_pending",
    requires_review: true,
    created_at,
  },
})

const row = (id: string, agent: string, kind: string, claim: string, report_type: string, timerSiden = 6) => ({
  id,
  kind,
  claim,
  evidence: "PMID 12345: dose 400 mg",
  source_url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
  confidence: "0.8",
  created_at: iso(timerSiden),
  report: {
    id: "rep-" + id,
    agent_id: agent,
    report_type,
    period: "2026-09-24",
    status: "artifact_pending",
    requires_review: true,
    created_at: iso(timerSiden),
  },
})

async function render(searchParams?: Record<string, string>) {
  const mod = await import("../../app/(ny)/funn/page")
  const el = await mod.default({ searchParams })
  return renderToStaticMarkup(React.createElement(React.Fragment, null, el)).replace(/[  ]/g, " ")
}

beforeEach(() => {
  latestHead.mockImplementation(async (a: string) =>
    a === "agent-anakinbot" ? head(a, "content-radar", iso(5)) : head(a, "nightly-harvest:magnesium", iso(70)),
  )
  findings.mockResolvedValue({
    "agent-anakinbot": {
      ok: true,
      rows: [row("a1", "agent-anakinbot", "trend", "Myrvann kakao trender", "content-radar", 5)],
    },
    "agent-indigobot": {
      ok: true,
      rows: [
        row("i1", "agent-indigobot", "watch", "Magnesium threonate og søvn", "nightly-harvest:magnesium", 30),
        row("i2", "agent-indigobot", "gap", "[KREVER GODKJENNING] Ingen norsk RCT", "nightly-harvest:magnesium", 10),
      ],
    },
  })
})

describe("/funn", () => {
  it("leden teller funnene, og hver agent faar sin seksjon med nyeste foerst", async () => {
    const html = await render()
    expect(html).toContain("3 funn fra agentene siste 7 dager.")
    expect(html).toContain("Myrvann kakao trender")
    expect(html).toContain("Magnesium threonate og søvn")
    expect(html).toContain("magnesium") // storyen fra report_type
    expect(html).toContain("Åpne kilden")
    expect(html.indexOf("Ingen norsk RCT")).toBeLessThan(html.indexOf("Magnesium threonate og søvn"))
    expect(html).toContain("Krever godkjenning")
    expect(html).not.toContain("[KREVER GODKJENNING]")
  })

  it("filtrene er lenker, og valgt agent gir bare den seksjonen", async () => {
    findings.mockResolvedValue({
      "agent-indigobot": {
        ok: true,
        rows: [row("i1", "agent-indigobot", "watch", "Magnesium threonate og søvn", "nightly-harvest:magnesium")],
      },
    })
    const html = await render({ agent: "indigo", periode: "30d" })
    expect(html).toContain("1 funn fra Indigo siste 30 dager.")
    expect(html).toContain('href="/funn?agent=indigo"')
    expect(html).toContain('href="/funn?periode=30d"')
    expect(html).not.toContain("Myrvann")
  })

  it("en stille agent sier det, med varsel naar rapporten er gammel", async () => {
    findings.mockResolvedValue({
      "agent-anakinbot": { ok: true, rows: [] },
      "agent-indigobot": { ok: true, rows: [] },
    })
    const html = await render()
    expect(html).toContain("Ingen funn fra agentene siste 7 dager.")
    expect(html).toContain("Ingen funn fra Anakin i dette vinduet.")
    expect(html).toContain("Ingen funn fra Indigo i dette vinduet.")
    // Indigos siste rapport er 70 timer gammel → varsel
    expect(html).toContain('class="varsel">Siste rapport for 2 dager siden.')
  })

  it("feil ser ut som feil, med basens egen melding", async () => {
    findings.mockResolvedValue({
      "agent-anakinbot": { ok: false, error: "permission denied for table findings", code: "no_access" },
      "agent-indigobot": { ok: true, rows: [] },
    })
    const html = await render()
    expect(html).toContain("Fikk ikke lest funnene.")
    expect(html).toContain("permission denied for table findings")
    expect(html).toContain("migrasjon 0008")
    expect(html).not.toContain("0 funn")
  })
})
