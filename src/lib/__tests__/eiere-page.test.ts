// Render-test av /eiere med datalaget mocket til de ekte radene fra Detox-basen
// 2026-09-08 (+ plan/graf-tilleggene 2026-09-10). Finnes fordi tom-/feil-
// tilstander skal se tomme/feil ut, ikke travle — og fordi «trykk for aa
// aapne»-moensteret, knappene og grafene skal rendres fra serveren.
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const radar = vi.fn()
const history = vi.fn()
const runState = vi.fn()
const queue = vi.fn()
const threads = vi.fn()
const content = vi.fn()
const kort = vi.fn()

vi.mock("../eiere-server", () => ({
  fetchLatestRadar: () => radar(),
  fetchPulsHistory: () => history(),
  fetchRunState: () => runState(),
  fetchQueue: () => queue(),
  fetchThreads: () => threads(),
  fetchOperatorKort: () => kort(),
  THREAD_ROWS: 60,
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
      source_url: "https://detox.no",
      confidence: "0.95",
      created_at: "1",
    },
    {
      id: "f2",
      kind: "risk",
      claim: "[KREVER GODKJENNING] Megasporebiotic-PDP er fortsatt RØD",
      evidence:
        "PDP-en mangler fortsatt erstatningsteksten fra GROK-IVERKSETT §1.",
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
    {
      id: "f4",
      kind: "change",
      claim: "Klaviyo-stillheten fortsetter",
      evidence: null,
      source_url: null,
      confidence: "0.9",
      created_at: "4",
    },
    {
      id: "f5",
      kind: "trend",
      claim: "Google Trends",
      evidence: null,
      source_url: null,
      confidence: "0.8",
      created_at: "5",
    },
  ],
  recommendations: [
    {
      id: "r1",
      kind: "content",
      action:
        "B1 mekanisme-karusell: «Hvorfor 5000 IU D-vitamin nå er ulovlig i Norge»",
      status: "pending",
      owner: "anniken",
      created_at: "1",
    },
    {
      id: "r2",
      kind: "content",
      action: "A1 refleksiv (modus 3) til 14.-15.09",
      status: "pending",
      owner: "anniken",
      created_at: "2",
    },
    {
      id: "r3",
      kind: "content",
      action: "Klaviyo-utkast: 16 dager uten kampanje",
      status: "pending",
      owner: "anniken",
      created_at: "3",
    },
    {
      id: "r4",
      kind: "content",
      action: "A2 «Rolig kveld»-rutine i jeg-form",
      status: "pending",
      owner: "anniken",
      created_at: "4",
    },
    {
      id: "r5",
      kind: "content",
      action: "[KREVER GODKJENNING] B2 tillits-karusell om postbiotika",
      status: "pending",
      owner: "anniken",
      created_at: "5",
    },
    {
      id: "r6",
      kind: "content",
      action: "Bygg eid liste (avgjort i Telegram)",
      status: "approved",
      owner: "anniken",
      created_at: "6",
    },
  ],
}

const PULS = (orders7d: number, revenue7d: number) => ({
  orders7d,
  revenue7d,
  ordersPrev: 179,
  revenuePrev: 193818.05,
  revenueDeltaPct: null,
  ordersDeltaPct: null,
})

const HISTORY = [
  { period: "2026-09-05", puls: PULS(179, 206254) },
  { period: "2026-09-06", puls: PULS(191, 216290) },
  { period: "2026-09-07", puls: PULS(210, 233302.6) },
  { period: "2026-09-08", puls: PULS(174, 195408.3) },
]

const CONTENT_ITEM = {
  id: "8b9f1c2e-0000-4000-8000-000000000001",
  title: "Magnesium er ikke ett stoff -- formen avgjør hva kroppen faktisk får",
  topic: "magnesium",
  stage: "brief",
  stage_status: "complete",
  channels: ["blogg-detox-no", "nyhetsbrev-klaviyo"],
  requested_by: "Kim",
  source_repo: "detox-vault",
  source_path: "workflows/content/stages/brief/output/magnesium.md",
  data_mode: "live",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-02T10:00:00Z",
  synced_at: "2026-09-08T04:00:00Z",
}

async function render() {
  const mod = await import("../../app/(main)/eiere/page")
  const el = await mod.default()
  // nb-NO-formatering bruker smalt/hardt mellomrom som tusenskille; normaliser
  // til vanlig mellomrom saa assertene kan skrives som folk leser dem.
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, el),
  ).replace(/[\u00a0\u202f]/g, " ")
}

beforeEach(() => {
  runState.mockResolvedValue({
    ok: true,
    state: {
      agent_id: "agent-anakinbot",
      last_successful_run: "2026-09-08T05:37:20Z",
      last_run_status: "ok",
      last_error: null,
      updated_at: "",
    },
  })
  content.mockResolvedValue({ ok: true, items: [] })
  queue.mockResolvedValue({ ok: true, rows: [] })
  threads.mockResolvedValue({ ok: true, threads: [] })
  radar.mockResolvedValue({ ok: true, report: REPORT })
  history.mockResolvedValue({ ok: true, points: HISTORY })
  kort.mockResolvedValue({ ok: true, kort: KORT })
  delete process.env.NEXT_PUBLIC_DETOX_TELEGRAM_BOT
})

// Ekte operator-kort 2026-09-12 (reports 1fd99b95, ett funn kind=brief,
// 8 704 tegn), forkortet.
const KORT = {
  id: "1fd99b95-dd78-40d4-954d-afad0e7adfff",
  period: "2026-09-12",
  created_at: "2026-09-12T05:29:27Z",
  text: "# 🌙 Content Radar — Detox & Anniken — 12.09.2026\n\n**PÅ MINNELSE: Megasporebiotic-PDP er fortsatt RØD**\n\n## 3 viktigste funn\n\n1. **Klaviyo-tallene ER HER — e-posten virker**\n2. Vitamin D\n3. Google Trends\n\n## Anbefalinger\n- B1 mekanisme-karusell",
}

// Ekte rader fra requests 2026-09-11 (Orions ende-til-ende-test + en besvart
// bestilling), forkortet. Traaden er én rad med body + response.
const ANSWERED_THREAD = {
  key: "b26e6797-6f25-4b65-a53c-4e5aa54471e9",
  messages: [
    {
      id: "b26e6797-6f25-4b65-a53c-4e5aa54471e9",
      requester: "as.shikoba@gmail.com",
      kind: "research",
      body: "[find_idea] til: agent-anakinbot · radar 2026-09-10\nFinn den neste innholdsidéen ut fra siste Content Radar og salgspuls.",
      status: "done",
      created_at: "2026-09-10T20:03:51Z",
      response:
        "[find_idea] besvart i forrige kjøring: foreslo neste innholdsidé fra Content Radar 2026-09-10 + salgspuls (ankret i claims.md). Levert som Telegram-melding.",
      responded_at: "2026-09-11T10:00:00Z",
      thread_id: null,
      parent_id: null,
    },
  ],
  get root() {
    return this.messages[0]
  },
  get last() {
    return this.messages[0]
  },
  lastActivity: "2026-09-11T10:00:00Z",
  active: false,
  closeTarget: null,
}

const CHAT_ROOT = {
  id: "bbbb2222-2222-2222-2222-222222222222",
  requester: "orion@end-to-end.test",
  kind: "followup",
  body: "[chat_thread] til: agent-anakinbot · radar 2026-09-11 · ref findings/f2\nEieren åpner Telegram nå.\nKontekst: «Megasporebiotic-PDP er fortsatt RØD»",
  status: "in_progress",
  created_at: "2026-09-11T09:13:58Z",
  response: "Chat-tråd mottatt: klar for samtale om Megasporebiotic-PDP-en.",
  responded_at: "2026-09-11T09:15:00Z",
  thread_id: null,
  parent_id: null,
}
const CHAT_REPLY = {
  id: "cccc3333-3333-3333-3333-333333333333",
  requester: "as.shikoba@gmail.com",
  kind: "followup",
  body: "[chat_thread] til: agent-anakinbot · radar 2026-09-11\nFortsetter tråd bbbb2222-2222-2222-2222-222222222222.",
  status: "open",
  created_at: "2026-09-11T09:20:00Z",
  response: null,
  responded_at: null,
  thread_id: "bbbb2222-2222-2222-2222-222222222222",
  parent_id: "bbbb2222-2222-2222-2222-222222222222",
}
const ACTIVE_THREAD = {
  key: CHAT_ROOT.id,
  messages: [CHAT_ROOT, CHAT_REPLY],
  root: CHAT_ROOT,
  last: CHAT_REPLY,
  lastActivity: "2026-09-11T09:20:00Z",
  active: true,
  closeTarget: CHAT_REPLY,
}

describe("/eiere — puls og graf", () => {
  it("viser PULS-tallene fra Anakins prosa, med provenance bak «Vis metadata»", async () => {
    const html = await render()
    expect(html).toContain("kr 195 408")
    expect(html).toContain("+0,8 % vs forrige uke")
    expect(html).toContain("-2,8 % vs forrige uke")
    expect(html).toContain("kr 193 818")
    expect(html).toContain("Vis metadata")
    expect(html).toContain("kind=signal")
    expect(html).toContain("kwrjhyytvbcaiszbfria")
  })
  it("tegner uke-mot-uke-soeyler og trendlinjer naar historikken har minst to punkter", async () => {
    const html = await render()
    expect(html).toContain("Ordrer · uke mot uke")
    expect(html).toContain("Omsetning · uke mot uke")
    expect(html).toContain("siste 7 dager per radar-dag")
    expect(html).toContain("05.09 · kr 206 254")
    expect(html).toContain("08.09 · kr 195 408")
    expect(html).toContain("4 radar-dager")
    expect((html.match(/<svg/g) ?? []).length).toBe(4)
  })
  it("uten historikk: soeylene staar, trenden sier hvorfor den mangler — ingen oppdiktet linje", async () => {
    history.mockResolvedValue({ ok: true, points: [] })
    const html = await render()
    expect(html).toContain("uke mot uke")
    expect(html).not.toContain("siste 7 dager per radar-dag")
    expect(html).toContain("Trend kommer når minst to radar-dager")
    expect((html.match(/<svg/g) ?? []).length).toBe(2)
  })
  it("historikk som ikke kan leses: siden lever, og metadata sier det", async () => {
    history.mockResolvedValue({
      ok: false,
      error: "fetch failed",
      code: "other",
    })
    const html = await render()
    expect(html).toContain("kr 195 408")
    expect(html).toContain("kunne ikke leses (fetch failed)")
  })
})

describe("/eiere — plan og neste steg", () => {
  it("neste trekk = tre foerste pending etter spor-tall, hver med Åpne og «Be Anakin gjøre dette»", async () => {
    const html = await render()
    expect(html).toContain("Plan og neste steg — Content Radar 2026-09-08")
    expect(html).toContain("Neste trekk · 3")
    // Uten prefiks foerst, saa B1/A1 (tall 1) i Anakins rekkefoelge; A2/B2 havner i resten.
    const iKlaviyo = html.indexOf("Klaviyo-utkast: 16 dager")
    const iB1 = html.indexOf("B1 mekanisme-karusell")
    const iA1 = html.indexOf("A1 refleksiv")
    const iRest = html.indexOf("Resten av planen · 2")
    expect(iKlaviyo).toBeGreaterThan(-1)
    expect(iKlaviyo).toBeLessThan(iB1)
    expect(iB1).toBeLessThan(iA1)
    expect(iA1).toBeLessThan(iRest)
    expect(html).toContain("Spor A")
    expect(html).toContain("«Rolig kveld»-rutine")
    expect(html).toContain("Spor B")
    expect(html).toContain("tillits-karusell om postbiotika")
    expect(html).toContain("krever godkjenning")
    expect(html).not.toContain("Bygg eid liste") // avgjort vises ikke som rad
    expect(html).toContain("1 avgjort")
    expect((html.match(/>Be Anakin gjøre dette</g) ?? []).length).toBe(5)
    expect(html).toContain("Åpne")
    expect(html).toContain("Lukk")
  })
  it("profitt-kortet regner snittkurv av pulsen og sier hva som er beregnet", async () => {
    const html = await render()
    expect(html).toContain("Flere ordrer")
    expect(html).toContain("Større kurv (beregnet)")
    expect(html).toContain("kr 1 123") // 195 408,30 / 174
    expect(html).toContain("+3,7 % vs forrige uke") // mot 193 818,05 / 179 — samme som Anakin oppgir
    expect(html).toContain("Profitt vokser på to spaker")
  })
  it("innholdsidéer: pipeline-chips med tall og lenke til /innhold", async () => {
    content.mockResolvedValue({ ok: true, items: [CONTENT_ITEM] })
    const html = await render()
    expect(html).toContain("Innholdsidéer i pipeline")
    expect(html).toContain('href="/innhold"')
    expect(html).toContain("1 idéer i arbeid")
  })
  it("ingen pending: planen sier det, uten knapper", async () => {
    radar.mockResolvedValue({
      ok: true,
      report: {
        ...REPORT,
        recommendations: REPORT.recommendations.map((r) => ({
          ...r,
          status: "rejected",
        })),
      },
    })
    const html = await render()
    expect(html).toContain("Ingen anbefalinger venter på avgjørelse")
    expect(html).toContain("6 avgjort")
    expect(html).not.toContain(">Be Anakin gjøre dette<")
  })
})

describe("/eiere — briefing, koe og uken", () => {
  it("viser tre funn (pulsen unntatt) som overskrifter med evidens bak Åpne og «Forklar dette funnet»", async () => {
    const html = await render()
    expect(html).toContain("Megasporebiotic-PDP er fortsatt RØD")
    expect(html).toContain("mangler fortsatt erstatningsteksten")
    expect(html).toContain("Vitamin D-tilbakekallingsbølgen")
    expect(html).toContain("Klaviyo-stillheten")
    expect(html).not.toMatch(/Google Trends<\/p>/)
    expect((html.match(/>Forklar dette funnet</g) ?? []).length).toBe(3)
    expect(html).toContain("Be Anakin: neste ukes innhold")
    expect(html).toContain("Be Anakin: e-postutkast")
    expect(html).toContain("Be Anakin: finn neste idé")
    expect(html).toContain("Be Anakin: oppdater salgspuls")
  })
  it("viser koe-rader med Telegram fremst, handlinger og hele teksten bak Åpne", async () => {
    queue.mockResolvedValue({
      ok: true,
      rows: [
        {
          id: "11111111-2222-3333-4444-555555555555",
          requester: "anniken@detox.no",
          kind: "content",
          body: "[do_recommendation] til: agent-anakinbot · radar 2026-09-08 · ref recommendations/r1\nGjør denne anbefalingen (Content Radar 2026-09-08)\n«B1 mekanisme-karusell»",
          status: "open",
          created_at: "2026-09-08T10:00:00Z",
        },
      ],
    })
    const html = await render()
    expect(html).toContain("1 venter")
    expect(html).toContain("Gjør anbefaling")
    expect(html).toContain("ref recommendations/r1")
    expect(html).toContain("Godkjenn")
    expect(html).toContain("Avvis")
    expect(html).toContain("Marker lest")
    expect(html).toContain("Kopier Telegram-tekst")
    expect(html).not.toContain("Åpne i Telegram") // env ikke satt
  })
  it("uken: hvert element er en overskrift med detaljer og «lag utkast» bak Åpne", async () => {
    content.mockResolvedValue({ ok: true, items: [CONTENT_ITEM] })
    const html = await render()
    expect(html).toContain("Uken — innhold (1)")
    expect(html).toContain("Magnesium er ikke ett stoff")
    expect(html).toContain("blogg-detox-no, nyhetsbrev-klaviyo")
    expect(html).toContain("workflows/content/stages/brief/output/magnesium.md")
    expect(html).toContain("Be Anakin: lag utkast")
  })
})

describe("/eiere — svar og samtaler", () => {
  it("viser Anakins svar som utdrag i lista og hele teksten bak Åpne, med bestillingen", async () => {
    threads.mockResolvedValue({ ok: true, threads: [ANSWERED_THREAD] })
    const html = await render()
    expect(html).toContain("Svar og samtaler — 1")
    expect(html).toContain("Finn neste idé")
    expect(html).toContain("lukket · fra as.shikoba@gmail.com")
    // utdraget (160 tegn) i overskriften, hele svaret i boblen
    expect(html).toContain("foreslo neste innholdsidé fra Content Radar")
    expect(html).toContain("Levert som Telegram-melding.")
    expect(html).toContain("Finn den neste innholdsidéen ut fra siste")
    expect(html).toContain("Anakin · ")
    expect(html).toContain("Ta opp igjen i Telegram")
    expect(html).not.toContain(">Lukk tråd<")
    expect(html).toContain("requests/b26e6797-6f25-4b65-a53c-4e5aa54471e9")
  })
  it("en aktiv tråd vises som samtale i skriverekkefølge, med Lukk tråd og Fortsett", async () => {
    threads.mockResolvedValue({ ok: true, threads: [ACTIVE_THREAD] })
    const html = await render()
    expect(html).toContain("Svar og samtaler — 1 (1 pågår)")
    expect(html).toContain("Samtale")
    expect(html).toContain("venter på Anakin · fra orion@end-to-end.test")
    expect(html).toContain("2 meldinger")
    const root = html.indexOf("Chat-tråd mottatt")
    const reply = html.indexOf("Fortsetter tråd bbbb2222")
    expect(root).toBeGreaterThan(0)
    expect(reply).toBeGreaterThan(root)
    expect(html).toContain("svar på bbbb2222…")
    expect(html).toContain(">Lukk tråd<")
    expect(html).toContain("Fortsett i Telegram")
    expect(html).toContain("thread_id bbbb2222-2222-2222-2222-222222222222")
    expect(html).toContain("ref findings/f2")
  })
  it("ingen svar: sier det, uten knapper", async () => {
    const html = await render()
    expect(html).toContain("Ingen svar fra Anakin ennå.")
    expect(html).not.toContain(">Lukk tråd<")
  })
  it("kan ikke lese: feilboks, resten av siden lever", async () => {
    threads.mockResolvedValue({
      ok: false,
      error: "permission denied for table requests",
      code: "no_access",
    })
    const html = await render()
    expect(html).toContain("Svar og samtaler")
    expect(html).toContain("permission denied for table requests")
    expect(html).toContain("Neste trekk")
  })
})

describe("/eiere — to knapper: Åpne og Snakk om dette", () => {
  it("hvert funn, hver anbefaling og hvert innholdselement har «Snakk om dette» ved siden av Be Anakin", async () => {
    content.mockResolvedValue({ ok: true, items: [CONTENT_ITEM] })
    const html = await render()
    // 3 funn + 5 pending anbefalinger (3 neste + 2 rest) + 1 innholdselement
    expect((html.match(/>Snakk om dette</g) ?? []).length).toBe(9)
    expect((html.match(/>Forklar dette funnet</g) ?? []).length).toBe(3)
    expect((html.match(/>Be Anakin gjøre dette</g) ?? []).length).toBe(5)
    expect(html).toContain("Be Anakin: lag utkast")
    // Samtalen er ikke en generell «Be Anakin: …»-knapp
    expect(html).not.toContain("Be Anakin: samtale")
  })
  it("et element med åpen samtale viser «Samtale pågår» i stedet for ny rad — når boten er satt", async () => {
    process.env.NEXT_PUBLIC_DETOX_TELEGRAM_BOT = "Anakin_1444_bot"
    threads.mockResolvedValue({ ok: true, threads: [ACTIVE_THREAD] })
    const html = await render()
    expect(html).toContain("Samtale pågår · åpne Telegram")
    expect((html.match(/>Snakk om dette</g) ?? []).length).toBe(7) // f2 byttet ut
    expect(html).toContain('href="https://t.me/Anakin_1444_bot"')
  })
  it("uten bot-env: knappen finnes, men ingen t.me-lenke i HTML", async () => {
    threads.mockResolvedValue({ ok: true, threads: [ACTIVE_THREAD] })
    const html = await render()
    expect(html).not.toContain("t.me/")
    expect((html.match(/>Snakk om dette</g) ?? []).length).toBe(8)
  })
})

describe("/eiere — tomt og feil", () => {
  it("ingen Anakin-rapport: sier det med filter og ref, ingen tall, ingen plan", async () => {
    radar.mockResolvedValue({ ok: true, report: null })
    const html = await render()
    expect(html).toContain("Ingen Content Radar fra Anakin")
    expect(html).toContain("agent_id=agent-anakinbot")
    expect(html).not.toContain("kr ")
    expect(html).not.toContain("Neste trekk")
    expect(html).not.toContain("<svg")
  })
  it("uparsebar puls: viser raa tekst, ingen KPI, ingen graf, profitt sier fra", async () => {
    radar.mockResolvedValue({
      ok: true,
      report: {
        ...REPORT,
        findings: [
          { ...REPORT.findings[0], claim: "Detox.no salgspuls: rekorduke!" },
        ],
      },
    })
    const html = await render()
    expect(html).toContain("kunne ikke tolkes")
    expect(html).toContain("rekorduke")
    expect(html).not.toContain("Ordrer 7d")
    expect(html).not.toContain("<svg")
    expect(html).toContain("Ingen salgspuls å bygge profitt-bildet på")
  })
  it("manglende lesetilgang: feilboks som peker paa 0008", async () => {
    radar.mockResolvedValue({
      ok: false,
      error: "permission denied for table reports",
      code: "no_access",
    })
    queue.mockResolvedValue({
      ok: false,
      error: "permission denied for table requests",
      code: "no_access",
    })
    const html = await render()
    expect(html).toContain("0008_shared_state_owner_access.sql")
    expect(html).toContain("permission denied for table reports")
    expect(html).not.toContain("Ordrer 7d")
  })
  it("tom koe og tom uke ser tomme ut", async () => {
    const html = await render()
    expect(html).toContain("Køen er tom")
    expect(html).toContain("Ingen innholdselementer")
  })
})

describe("/eiere — chat-vinduet", () => {
  it("aktiv tråd med rad som venter: kompositoren finnes men er stengt, og siden sier at Anakin svarer", async () => {
    threads.mockResolvedValue({ ok: true, threads: [ACTIVE_THREAD] })
    const html = await render()
    expect(html).toContain("Send til Anakin")
    expect(html).toContain("Vent på Anakins svar før du skriver mer.")
    expect(html).toContain("Anakin svarer… (rad cccc3333… er venter på Anakin")
    expect(html).toMatch(/<textarea[^>]* disabled=""/)
    // samtalen i skriverekkefoelge, Anakins svar som egen boble
    const root = html.indexOf("Chat-tråd mottatt")
    const reply = html.indexOf("Fortsetter tråd bbbb2222")
    expect(reply).toBeGreaterThan(root)
  })
  it("besvart tråd: kompositoren er åpen, ingen venter-melding", async () => {
    threads.mockResolvedValue({ ok: true, threads: [ANSWERED_THREAD] })
    const html = await render()
    expect(html).toContain("Send til Anakin")
    expect(html).toContain("Skriv til Anakin…")
    expect(html).not.toContain("Anakin svarer…")
    expect(html).not.toMatch(/<textarea[^>]* disabled=""/)
    expect(html).toContain("0/2000")
  })
  it("metadata sier at vinduet poller hvert 3. sekund", async () => {
    threads.mockResolvedValue({ ok: true, threads: [ACTIVE_THREAD] })
    const html = await render()
    expect(html).toContain("henter tråden på nytt hvert 3. sekund")
  })
})

describe("/eiere — hele Content Radar (operator-kort)", () => {
  it("viser operator-kortet som overskrift med hele teksten bak Åpne", async () => {
    const html = await render()
    expect(html).toContain("Hele Content Radar")
    expect(html).toContain("Content Radar 2026-09-12 som Anakin skrev den")
    expect(html).toContain("Klaviyo-tallene ER HER — e-posten virker")
    expect(html).toContain("B1 mekanisme-karusell")
    expect(html).toContain("reports/1fd99b95-dd78-40d4-954d-afad0e7adfff")
    expect(html).toContain("report_type=operator-kort")
  })
  it("ingen operator-kort: sier det med filter, ingen tom Åpne", async () => {
    kort.mockResolvedValue({ ok: true, kort: null })
    const html = await render()
    expect(html).toContain("Ingen operator-kort i basen ennå")
    expect(html).toContain("report_type=operator-kort")
    expect(html).not.toContain("som Anakin skrev den")
  })
  it("kan ikke lese operator-kort: feilboks, briefingen lever", async () => {
    kort.mockResolvedValue({
      ok: false,
      error: "permission denied for table reports",
      code: "no_access",
    })
    const html = await render()
    expect(html).toContain("Hele Content Radar")
    expect(html).toContain("Tre viktigste funn")
  })
})
