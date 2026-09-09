// Render-test av /eiere med datalaget mocket til de ekte radene fra Detox-basen
// 2026-09-08. Finnes fordi happy path ikke kan kjoeres live foer migrasjon 0008
// er kjoert — og fordi tom-/feil-tilstander skal se tomme/feil ut, ikke travle.
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const radar = vi.fn()
const runState = vi.fn()
const queue = vi.fn()
const content = vi.fn()

vi.mock("../eiere-server", () => ({
  fetchLatestRadar: () => radar(),
  fetchRunState: () => runState(),
  fetchQueue: () => queue(),
}))
vi.mock("../content-server", () => ({ fetchContentItems: () => content() }))
vi.mock("next/headers", () => ({ cookies: () => ({ getAll: () => [], set: () => {} }) }))
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
    { id: "f1", kind: "signal", claim: "Detox.no salgspuls (LIVE via Shopify, 05:30 UTC 2026-09-08): siste 7 dager (01.09-08.09, Europe/Amsterdam) 174 ordrer / 195 408,30 NOK mot 179 ordrer / 193 818,05 NOK uken før (25.08-01.09) — omsetning +0,8 %, ordrer -2,8 %.", evidence: null, source_url: "https://detox.no", confidence: "0.95", created_at: "1" },
    { id: "f2", kind: "risk", claim: "[KREVER GODKJENNING] Megasporebiotic-PDP er fortsatt RØD", evidence: null, source_url: "https://detox.no/products/megasporebiotic-sporebiotika", confidence: "1", created_at: "2" },
    { id: "f3", kind: "trend", claim: "Vitamin D-tilbakekallingsbølgen", evidence: null, source_url: null, confidence: "0.9", created_at: "3" },
    { id: "f4", kind: "change", claim: "Klaviyo-stillheten fortsetter", evidence: null, source_url: null, confidence: "0.9", created_at: "4" },
    { id: "f5", kind: "trend", claim: "Google Trends", evidence: null, source_url: null, confidence: "0.8", created_at: "5" },
  ],
  recommendations: [
    { id: "r1", kind: "content", action: "B1 mekanisme-karusell: «Hvorfor 5000 IU D-vitamin nå er ulovlig i Norge»", status: "pending", owner: "anniken", created_at: "1" },
    { id: "r2", kind: "content", action: "A1 refleksiv (modus 3) til 14.-15.09", status: "pending", owner: "anniken", created_at: "2" },
    { id: "r3", kind: "content", action: "Klaviyo-utkast: 16 dager uten kampanje", status: "pending", owner: "anniken", created_at: "3" },
  ],
}

async function render() {
  const mod = await import("../../app/(main)/eiere/page")
  const el = await mod.default()
  // nb-NO-formatering bruker smalt/hardt mellomrom som tusenskille; normaliser
  // til vanlig mellomrom saa assertene kan skrives som folk leser dem.
  return renderToStaticMarkup(React.createElement(React.Fragment, null, el)).replace(
    /[\u00a0\u202f]/g,
    " ",
  )
}

beforeEach(() => {
  runState.mockResolvedValue({ ok: true, state: { agent_id: "agent-anakinbot", last_successful_run: "2026-09-08T05:37:20Z", last_run_status: "ok", last_error: null, updated_at: "" } })
  content.mockResolvedValue({ ok: true, items: [] })
  queue.mockResolvedValue({ ok: true, rows: [] })
  radar.mockResolvedValue({ ok: true, report: REPORT })
})

describe("/eiere — rader", () => {
  it("viser PULS-tallene fra Anakins prosa, med provenance", async () => {
    const html = await render()
    expect(html).toContain("kr 195 408")
    expect(html).toContain("+0,8 % vs forrige uke")
    expect(html).toContain("-2,8 % vs forrige uke")
    expect(html).toContain("kr 193 818")
    expect(html).toContain("kind=signal")
    expect(html).toContain("kwrjhyytvbcaiszbfria")
  })
  it("viser tre funn (pulsen unntatt), spor A/B og neste steg", async () => {
    const html = await render()
    expect(html).toContain("Megasporebiotic-PDP er fortsatt RØD")
    expect(html).toContain("krever godkjenning")
    expect(html).toContain("Vitamin D-tilbakekallingsbølgen")
    expect(html).toContain("Klaviyo-stillheten")
    expect(html).not.toMatch(/Google Trends<\/p>/)
    expect(html).toContain("Spor A")
    expect(html).toContain("A1 refleksiv")
    expect(html).toContain("B1 mekanisme-karusell")
    expect(html).toContain("Klaviyo-utkast: 16 dager")
    expect(html).toContain("Be Anakin: neste ukes innhold")
    expect(html).toContain("Be Anakin: e-postutkast")
  })
  it("viser koe-rader med handlinger og Telegram-tekst", async () => {
    queue.mockResolvedValue({ ok: true, rows: [{ id: "11111111-2222-3333-4444-555555555555", requester: "anniken@detox.no", kind: "content", body: "[generate_week] til: agent-anakinbot · radar 2026-09-08\nLag forslag til neste ukes innhold.", status: "open", created_at: "2026-09-08T10:00:00Z" }] })
    const html = await render()
    expect(html).toContain("1 venter")
    expect(html).toContain("Neste ukes innhold")
    expect(html).toContain("Godkjenn")
    expect(html).toContain("Avvis")
    expect(html).toContain("Marker lest")
    expect(html).toContain("Kopier Telegram-tekst")
    expect(html).not.toContain("Aapne i Telegram") // env ikke satt
  })
})

describe("/eiere — tomt og feil", () => {
  it("ingen Anakin-rapport: sier det med filter og ref, ingen tall", async () => {
    radar.mockResolvedValue({ ok: true, report: null })
    const html = await render()
    expect(html).toContain("Ingen Content Radar fra Anakin")
    expect(html).toContain("agent_id=agent-anakinbot")
    expect(html).not.toContain("kr ")
  })
  it("uparsebar puls: viser raa tekst, ingen KPI", async () => {
    radar.mockResolvedValue({ ok: true, report: { ...REPORT, findings: [{ ...REPORT.findings[0], claim: "Detox.no salgspuls: rekorduke!" }] } })
    const html = await render()
    expect(html).toContain("kunne ikke tolkes")
    expect(html).toContain("rekorduke")
    expect(html).not.toContain("Ordrer 7d")
  })
  it("manglende lesetilgang: feilboks som peker paa 0008", async () => {
    radar.mockResolvedValue({ ok: false, error: "permission denied for table reports", code: "no_access" })
    queue.mockResolvedValue({ ok: false, error: "permission denied for table requests", code: "no_access" })
    const html = await render()
    expect(html).toContain("0008_shared_state_owner_access.sql")
    expect(html).toContain("permission denied for table reports")
    expect(html).not.toContain("Ordrer 7d")
  })
  it("tom koe og tom uke ser tomme ut", async () => {
    const html = await render()
    expect(html).toContain("Koeen er tom")
    expect(html).toContain("Ingen innholdselementer")
  })
})
