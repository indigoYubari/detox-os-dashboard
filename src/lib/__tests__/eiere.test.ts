import { describe, expect, it } from "vitest"

import {
  aovOf,
  briefingOf,
  buildRequestBody,
  clipText,
  DECISIONS,
  deltaPct,
  findDuplicateRequest,
  findPuls,
  GENERIC_REQUEST_TYPES,
  isDecision,
  isRefRequestType,
  isRequestType,
  linePath,
  parseNorwegianNumber,
  parsePulsClaim,
  parseRequestBody,
  pctLabel,
  planOf,
  pulsHistoryOf,
  refKey,
  requestBodyHead,
  scaleBars,
  shortDate,
  telegramHref,
  telegramText,
  trackOf,
  trackRank,
  weekBucketOf,
  type RadarFinding,
  type RadarReport,
  type RequestRow,
} from "../eiere"

// Ordrett fra Detox-basen (kwrjhyytvbcaiszbfria), findings.claim for
// agent-anakinbot / content-radar / period 2026-09-08 (kind=signal).
const PULS_0908 =
  "Detox.no salgspuls (LIVE via Shopify, 05:30 UTC 2026-09-08): siste 7 dager (01.09-08.09, Europe/Amsterdam) 174 ordrer / 195 408,30 NOK mot 179 ordrer / 193 818,05 NOK uken før (25.08-01.09) — omsetning +0,8 %, ordrer -2,8 %, snittordreverdi +3,7 % til 1 123 NOK. Siste 24t: 25 ordrer / 29 843,30 NOK."
// period 2026-09-05 — uten parentes-datoer og uten desimaler.
const PULS_0905 =
  "Detox.no salgspuls (LIVE via Shopify, 05:05 UTC 2026-09-05): siste 7 dager 179 ordrer / 206 254 NOK mot 188 ordrer / 195 864 NOK uken før — omsetning +5,3 %, ordrer -4,8 %, snittordreverdi +10,6 % til 1 152 NOK."

// period 2026-09-10 — kortformen Anakin gikk over til 10.09 (kind=data).
const PULS_0910 =
  "Salgspuls ned denne uken: 03.09–10.09 = 165 ordrer / 181 704 NOK / AOV 1 101 NOK vs forrige uke 27.08–03.09 = 183 / 206 724 (−9,8 % ordrer, −12,1 % omsetning). «Rolig/søvn»-komplekset vokser: L-Theanine (13 stk, ny #3) og Magnesium Threonate (10 stk, ny #5) på topp-5; Paratox falt 18→7; Liver Sauce ute av topp-5. Siste 24t: 29 ordrer / 29 818 NOK."

function finding(
  partial: Partial<RadarFinding> & { claim: string },
): RadarFinding {
  return {
    id: partial.id ?? "f-" + partial.claim.slice(0, 8),
    kind: partial.kind ?? "trend",
    claim: partial.claim,
    evidence: null,
    source_url: null,
    confidence: partial.confidence ?? null,
    created_at: "2026-09-08T05:37:20Z",
  }
}

describe("parseNorwegianNumber", () => {
  it("leser tusenskille med mellomrom og desimalkomma", () => {
    expect(parseNorwegianNumber("195 408,30")).toBeCloseTo(195408.3)
    expect(parseNorwegianNumber("174")).toBe(174)
    expect(parseNorwegianNumber("+0,8")).toBeCloseTo(0.8)
    expect(parseNorwegianNumber("-2,8")).toBeCloseTo(-2.8)
    expect(parseNorwegianNumber("−2,8")).toBeCloseTo(-2.8)
  })
  it("gir null for det som ikke er et tall", () => {
    expect(parseNorwegianNumber("NOK")).toBeNull()
    expect(parseNorwegianNumber("")).toBeNull()
  })
})

describe("parsePulsClaim", () => {
  it("leser 08.09-formatet (datoer i parentes, desimaler)", () => {
    expect(parsePulsClaim(PULS_0908)).toEqual({
      orders7d: 174,
      revenue7d: 195408.3,
      ordersPrev: 179,
      revenuePrev: 193818.05,
      revenueDeltaPct: 0.8,
      ordersDeltaPct: -2.8,
    })
  })
  it("leser 05.09-formatet (uten parentes, hele kroner)", () => {
    expect(parsePulsClaim(PULS_0905)).toMatchObject({
      orders7d: 179,
      revenue7d: 206254,
      ordersPrev: 188,
      revenuePrev: 195864,
      revenueDeltaPct: 5.3,
      ordersDeltaPct: -4.8,
    })
  })
  it("gir null naar moensteret ikke treffer — aldri et gjettet tall", () => {
    expect(parsePulsClaim("Salgspuls: bra uke, ca 200 ordrer.")).toBeNull()
    expect(
      parsePulsClaim("Salgspuls: 03.09–10.09 = 165 ordrer vs forrige uke"),
    ).toBeNull()
    expect(parsePulsClaim("")).toBeNull()
  })
})

describe("findPuls", () => {
  it("finner signal-funnet med salgspuls og parser det", () => {
    const r = findPuls([
      finding({ kind: "trend", claim: "Magnesium faller" }),
      finding({ id: "puls", kind: "signal", claim: PULS_0908 }),
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.findingId).toBe("puls")
      expect(r.puls.orders7d).toBe(174)
    }
  })
  it("sier no_signal naar ingen puls finnes", () => {
    expect(findPuls([finding({ claim: "x" })])).toEqual({
      ok: false,
      reason: "no_signal",
    })
  })
  it("sier unparsable med raa tekst naar pulsen finnes men ikke kan tolkes", () => {
    const r = findPuls([
      finding({
        id: "p",
        kind: "signal",
        claim: "Detox.no salgspuls: rekorduke!",
      }),
    ])
    expect(r).toEqual({
      ok: false,
      reason: "unparsable",
      findingId: "p",
      raw: "Detox.no salgspuls: rekorduke!",
    })
  })
  it("finner kortformen som kind=data (10.09) og parser den", () => {
    const r = findPuls([
      finding({ kind: "signal", claim: "Klaviyo-stillheten brytes i dag" }),
      finding({ id: "d", kind: "data", claim: PULS_0910 }),
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.findingId).toBe("d")
      expect(r.puls).toEqual({
        orders7d: 165,
        revenue7d: 181704,
        ordersPrev: 183,
        revenuePrev: 206724,
        revenueDeltaPct: -12.1,
        ordersDeltaPct: -9.8,
      })
    }
  })
  it("ignorerer signal-funn som ikke er salgspuls", () => {
    const r = findPuls([
      finding({ kind: "signal", claim: "Norge er i nasjonal sørgetid" }),
    ])
    expect(r.ok).toBe(false)
  })
})

describe("pctLabel", () => {
  it("formaterer med fortegn og desimalkomma", () => {
    expect(pctLabel(0.8)).toBe("+0,8 %")
    expect(pctLabel(-2.8)).toBe("-2,8 %")
    expect(pctLabel(0)).toBe("0,0 %")
    expect(pctLabel(null)).toBe("—")
  })
})

describe("trackOf", () => {
  it("leser spor A/B fra prefikset, ogsaa bak godkjenningsmerket", () => {
    expect(trackOf("A1 refleksiv (modus 3) til 14.-15.09")).toBe("A")
    expect(trackOf("[KREVER GODKJENNING] B2 tillits-karusell")).toBe("B")
    expect(trackOf("B4 (reserve, merket): …")).toBe("B")
  })
  it("gir null for anbefalinger uten spor (01.–06.09-formatet)", () => {
    expect(trackOf("Produksjon av karusell om magnesium")).toBeNull()
    expect(trackOf("Klaviyo-utkast: 16 dager uten kampanje")).toBeNull()
    expect(trackOf("Bygg eid liste")).toBeNull()
  })
})

describe("briefingOf", () => {
  const report: RadarReport = {
    id: "r1",
    agent_id: "agent-anakinbot",
    report_type: "content-radar",
    period: "2026-09-08",
    status: "artifact_pending",
    requires_review: true,
    created_at: "2026-09-08T05:37:20Z",
    findings: [
      finding({
        id: "puls",
        kind: "signal",
        claim: PULS_0908,
        confidence: "0.95",
      }),
      finding({
        id: "f-risk",
        kind: "risk",
        claim: "PDP roed",
        confidence: "1",
      }),
      finding({
        id: "f-t1",
        kind: "trend",
        claim: "Vitamin D",
        confidence: "0.9",
      }),
      finding({
        id: "f-t2",
        kind: "trend",
        claim: "Legeetikk",
        confidence: "0.85",
      }),
      finding({
        id: "f-c",
        kind: "change",
        claim: "Klaviyo stille",
        confidence: "0.9",
      }),
      finding({
        id: "f-t3",
        kind: "trend",
        claim: "Trends",
        confidence: "0.8",
      }),
    ],
    recommendations: [
      {
        id: "b1",
        kind: "content",
        action: "B1 mekanisme",
        status: "pending",
        owner: "anniken",
        created_at: "",
      },
      {
        id: "n1",
        kind: "content",
        action: "Klaviyo-utkast: …",
        status: "pending",
        owner: "anniken",
        created_at: "",
      },
      {
        id: "a1",
        kind: "content",
        action: "A1 refleksiv",
        status: "pending",
        owner: "anniken",
        created_at: "",
      },
      {
        id: "b2",
        kind: "content",
        action: "[KREVER GODKJENNING] B2 x",
        status: "pending",
        owner: "anniken",
        created_at: "",
      },
    ],
  }
  it("gir tre funn etter confidence, pulsen unntatt, stabil ved likhet", () => {
    expect(briefingOf(report).funn.map((f) => f.id)).toEqual([
      "f-risk",
      "f-t1",
      "f-c",
    ])
  })
  it("deler anbefalinger i spor A, spor B og neste steg", () => {
    const b = briefingOf(report)
    expect(b.sporA.map((r) => r.id)).toEqual(["a1"])
    expect(b.sporB.map((r) => r.id)).toEqual(["b1", "b2"])
    expect(b.nesteSteg.map((r) => r.id)).toEqual(["n1"])
  })
  it("taaler tom rapport", () => {
    const b = briefingOf({ ...report, findings: [], recommendations: [] })
    expect(b).toEqual({ funn: [], sporA: [], sporB: [], nesteSteg: [] })
  })
})

describe("request body", () => {
  it("bygger et deterministisk hode + tekst, og parser det tilbake", () => {
    const body = buildRequestBody({
      type: "generate_week",
      period: "2026-09-08",
      requestedBy: "anniken@detox.no",
    })
    expect(body.split("\n")[0]).toBe(
      "[generate_week] til: agent-anakinbot · radar 2026-09-08",
    )
    expect(body).toContain("publiser ingenting")
    const p = parseRequestBody(body)
    expect(p.type).toBe("generate_week")
    expect(p.to).toBe("agent-anakinbot")
    expect(p.period).toBe("2026-09-08")
    expect(p.summary).toMatch(/^Lag forslag/)
  })
  it("hodet uten radar-periode har ingen periode-del", () => {
    expect(requestBodyHead("draft_email", null)).toBe(
      "[draft_email] til: agent-anakinbot",
    )
  })
  it("ukjent body (f.eks. skrevet av Anakin) parses som fritekst", () => {
    const p = parseRequestBody("Trenger ja paa Megaspore-PDP innen 09.09")
    expect(p.type).toBeNull()
    expect(p.summary).toBe("Trenger ja paa Megaspore-PDP innen 09.09")
  })
  it("ukjent type i hodet gir type null, ikke krasj", () => {
    expect(
      parseRequestBody("[publish_now] til: agent-anakinbot\nx").type,
    ).toBeNull()
  })
  it("isRequestType avviser alt utenfor de to typene", () => {
    expect(isRequestType("generate_week")).toBe(true)
    expect(isRequestType("draft_email")).toBe(true)
    expect(isRequestType("publish_now")).toBe(false)
    expect(isRequestType("__proto__")).toBe(false)
    expect(isRequestType(1)).toBe(false)
  })
})

describe("findDuplicateRequest (idempotens)", () => {
  const row = (over: Partial<RequestRow>): RequestRow => ({
    id: "x",
    requester: "a@b",
    kind: "content",
    body: requestBodyHead("generate_week", "2026-09-08") + "\nTekst",
    status: "open",
    created_at: "",
    ...over,
  })
  it("finner en aapen forespoersel med samme hode", () => {
    expect(
      findDuplicateRequest([row({ id: "dup" })], "generate_week", "2026-09-08")
        ?.id,
    ).toBe("dup")
  })
  it("in_progress teller ogsaa som duplikat", () => {
    expect(
      findDuplicateRequest(
        [row({ status: "in_progress" })],
        "generate_week",
        "2026-09-08",
      ),
    ).not.toBeNull()
  })
  it("done/cancelled sperrer ikke for en ny", () => {
    expect(
      findDuplicateRequest(
        [row({ status: "done" })],
        "generate_week",
        "2026-09-08",
      ),
    ).toBeNull()
    expect(
      findDuplicateRequest(
        [row({ status: "cancelled" })],
        "generate_week",
        "2026-09-08",
      ),
    ).toBeNull()
  })
  it("annen type eller annen radar-periode er ikke duplikat", () => {
    expect(
      findDuplicateRequest([row({})], "draft_email", "2026-09-08"),
    ).toBeNull()
    expect(
      findDuplicateRequest([row({})], "generate_week", "2026-09-09"),
    ).toBeNull()
  })
})

describe("decisions", () => {
  it("mapper til eksisterende status-verdier i requests_status_check", () => {
    expect(DECISIONS.godkjenn.status).toBe("done")
    expect(DECISIONS.avvis.status).toBe("cancelled")
    expect(DECISIONS.lest.status).toBe("in_progress")
  })
  it("godkjenn/avvis krever action:approve, lest bare work:write", () => {
    expect(DECISIONS.godkjenn.scope).toBe("action:approve")
    expect(DECISIONS.avvis.scope).toBe("action:approve")
    expect(DECISIONS.lest.scope).toBe("work:write")
  })
  it("isDecision avviser ukjente", () => {
    expect(isDecision("godkjenn")).toBe(true)
    expect(isDecision("publiser")).toBe(false)
  })
})

describe("telegram", () => {
  it("gir lenke kun for et gyldig bot-brukernavn", () => {
    expect(telegramHref("DetoxAnakinBot")).toBe("https://t.me/DetoxAnakinBot")
    expect(telegramHref("@DetoxAnakinBot")).toBe("https://t.me/DetoxAnakinBot")
    expect(telegramHref(undefined)).toBeNull()
    expect(telegramHref("")).toBeNull()
    expect(telegramHref("evil.com/x")).toBeNull()
  })
  it("ferdig tekst baerer request-id og type", () => {
    const t = telegramText({
      id: "11111111-2222-3333-4444-555555555555",
      requester: "a@b",
      kind: "content",
      body: buildRequestBody({
        type: "draft_email",
        period: "2026-09-08",
        requestedBy: "a@b",
      }),
      status: "open",
      created_at: "",
    })
    expect(t).toMatch(
      /^Anakin, se request 11111111-2222-3333-4444-555555555555 \(E-postutkast\): Lag utkast/,
    )
  })
})

describe("weekBucketOf", () => {
  it("mapper stage_status til planlagt/venter/blokkert", () => {
    expect(weekBucketOf("complete")).toBe("planlagt")
    expect(weekBucketOf("blocked")).toBe("blokkert")
    expect(weekBucketOf("pending")).toBe("venter")
    expect(weekBucketOf("needs_research")).toBe("venter")
  })
})

// ── 2026-09-10: plan, referanse-forespoersler, historikk og graf ─────────────

describe("planOf / trackRank", () => {
  const rec = (id: string, action: string, status = "pending") => ({
    id,
    kind: "content",
    action,
    status,
    owner: "anniken",
    created_at: "",
  })
  const report: RadarReport = {
    id: "r",
    agent_id: "agent-anakinbot",
    report_type: "content-radar",
    period: "2026-09-10",
    status: "artifact_pending",
    requires_review: false,
    created_at: "2026-09-10T05:30:00Z",
    recommendations: [
      rec("m", "Megasporebiotic-PDP: lim inn GROK-IVERKSETT §1"),
      rec("k", "Verifiser Klaviyo-kampanjen før den går 09:45"),
      rec("t", "[KREVER GODKJENNING] Godkjenn Tarm 1/3 i Buffer"),
      rec("s", "Start B1: postbiotika-karusell"),
      rec("b2", "B2: «Før du kjøper D-vitamin»"),
      rec("a3", "A3: «Rolig kveld»-rutine"),
      rec("done", "Bygg eid liste", "approved"),
    ],
    findings: [],
  }
  it("trackRank: tallet i prefikset, 0 uten prefiks, ogsaa bak godkjenningsmerket", () => {
    expect(trackRank("A1 refleksiv")).toBe(1)
    expect(trackRank("[KREVER GODKJENNING] B2 x")).toBe(2)
    expect(trackRank("B12 sen")).toBe(12)
    expect(trackRank("Start B1: …")).toBe(0)
    expect(trackRank("Klaviyo-utkast")).toBe(0)
  })
  it("neste trekk = tre foerste pending etter rang, resten gruppert per spor, avgjorte telles", () => {
    const p = planOf(report)
    expect(p.neste.map((r) => r.id)).toEqual(["m", "k", "t"])
    expect(p.utenSpor.map((r) => r.id)).toEqual(["s"])
    expect(p.sporB.map((r) => r.id)).toEqual(["b2"])
    expect(p.sporA.map((r) => r.id)).toEqual(["a3"])
    expect(p.avgjort).toBe(1)
  })
  it("A1/B1 gaar foer A2/B2 uansett skrevet rekkefoelge; n kan settes", () => {
    const r2: RadarReport = {
      ...report,
      recommendations: [
        rec("b2", "B2 x"),
        rec("a1", "A1 y"),
        rec("b1", "B1 z"),
      ],
    }
    expect(planOf(r2, 2).neste.map((r) => r.id)).toEqual(["a1", "b1"])
    expect(planOf(r2, 2).sporB.map((r) => r.id)).toEqual(["b2"])
  })
  it("tom rapport gir tom plan", () => {
    expect(planOf({ ...report, recommendations: [] })).toEqual({
      neste: [],
      sporA: [],
      sporB: [],
      utenSpor: [],
      avgjort: 0,
    })
  })
})

describe("request-typer med referanse", () => {
  it("fire generelle knapper, tre typer som peker paa en rad", () => {
    expect(GENERIC_REQUEST_TYPES).toEqual([
      "generate_week",
      "draft_email",
      "find_idea",
      "refresh_puls",
    ])
    expect(isRefRequestType("do_recommendation")).toBe(true)
    expect(isRefRequestType("explain_finding")).toBe(true)
    expect(isRefRequestType("draft_content")).toBe(true)
    expect(isRefRequestType("generate_week")).toBe(false)
    expect(isRefRequestType("publish_now")).toBe(false)
    expect(isRequestType("find_idea")).toBe(true)
  })
  it("hodet baerer ref, og parses tilbake med ref", () => {
    const key = refKey(
      "recommendations",
      "3f2a0000-0000-4000-8000-000000000000",
    )
    const head = requestBodyHead("do_recommendation", "2026-09-10", key)
    expect(head).toBe(
      "[do_recommendation] til: agent-anakinbot · radar 2026-09-10 · ref recommendations/3f2a0000-0000-4000-8000-000000000000",
    )
    const body = buildRequestBody({
      type: "do_recommendation",
      period: "2026-09-10",
      requestedBy: "anniken@detox.no",
      ref: { key, text: "  B2: «Før du kjøper D-vitamin»\n  pedagogisk  " },
    })
    expect(body.split("\n")[0]).toBe(head)
    expect(body).toContain("(Content Radar 2026-09-10)")
    expect(body).toContain("«B2: «Før du kjøper D-vitamin» pedagogisk»")
    expect(body).toContain(
      "publiser og send ingenting".replace("publiser", "Publiser"),
    )
    const p = parseRequestBody(body)
    expect(p.type).toBe("do_recommendation")
    expect(p.period).toBe("2026-09-10")
    expect(p.ref).toBe(key)
    expect(p.summary).toMatch(/^Gjør denne anbefalingen/)
  })
  it("uten periode og uten ref er hodet som foer, og ref er null", () => {
    expect(requestBodyHead("draft_content", null, "content_items/x")).toBe(
      "[draft_content] til: agent-anakinbot · ref content_items/x",
    )
    expect(
      parseRequestBody("[generate_week] til: agent-anakinbot\nx").ref,
    ).toBeNull()
  })
  it("duplikat kun ved samme ref; annen rad er ny forespoersel", () => {
    const key = refKey("findings", "a")
    const row: RequestRow = {
      id: "dup",
      requester: "a@b",
      kind: "research",
      body: requestBodyHead("explain_finding", "2026-09-10", key) + "\nTekst",
      status: "open",
      created_at: "",
    }
    expect(
      findDuplicateRequest([row], "explain_finding", "2026-09-10", key)?.id,
    ).toBe("dup")
    expect(
      findDuplicateRequest(
        [row],
        "explain_finding",
        "2026-09-10",
        refKey("findings", "b"),
      ),
    ).toBeNull()
    expect(
      findDuplicateRequest([row], "explain_finding", "2026-09-10"),
    ).toBeNull()
  })
  it("clipText normaliserer whitespace og kutter med ellipse", () => {
    expect(clipText("  a \n b  ")).toBe("a b")
    const long = "x".repeat(700)
    expect(clipText(long).length).toBe(600)
    expect(clipText(long).endsWith("…")).toBe(true)
    expect(clipText("kort", 10)).toBe("kort")
  })
  it("telegramText bruker etiketten til ref-typen", () => {
    const t = telegramText({
      id: "11111111-2222-3333-4444-555555555555",
      requester: "a@b",
      kind: "content",
      body: buildRequestBody({
        type: "draft_content",
        period: null,
        requestedBy: "a@b",
        ref: { key: "content_items/c", text: "Magnesium" },
      }),
      status: "open",
      created_at: "",
    })
    expect(t).toMatch(
      /\(Utkast til innhold\): Lag utkast til dette innholdselementet/,
    )
  })
})

describe("aovOf / deltaPct", () => {
  it("regner snittkurv av pulsen og endringen mot forrige uke", () => {
    const a = aovOf({
      orders7d: 174,
      revenue7d: 195408.3,
      ordersPrev: 179,
      revenuePrev: 193818.05,
      revenueDeltaPct: 0.8,
      ordersDeltaPct: -2.8,
    })
    expect(a.aov).toBeCloseTo(1123.04, 1)
    expect(a.aovPrev).toBeCloseTo(1082.78, 1)
    expect(a.aovDeltaPct).toBeCloseTo(3.72, 1) // Anakin skrev "+3,7 %"
  })
  it("null naar det ikke finnes ordrer aa dele paa", () => {
    const a = aovOf({
      orders7d: 0,
      revenue7d: 0,
      ordersPrev: 0,
      revenuePrev: 0,
      revenueDeltaPct: null,
      ordersDeltaPct: null,
    })
    expect(a).toEqual({ aov: null, aovPrev: null, aovDeltaPct: null })
    expect(deltaPct(10, 0)).toBeNull()
    expect(deltaPct(110, 100)).toBeCloseTo(10)
  })
})

describe("pulsHistoryOf", () => {
  const rep = (period: string, claim: string | null, kind = "signal") => ({
    period,
    findings: claim ? [finding({ id: period, kind, claim })] : [],
  })
  it("eldste foerst, rapporter uten puls hoppes over, foerste rapport per periode vinner", () => {
    const h = pulsHistoryOf([
      rep("2026-09-08", PULS_0908),
      rep("2026-09-08", PULS_0905), // eldre duplikat av samme dag — taper
      rep("2026-09-07", null),
      rep("2026-09-05", PULS_0905),
    ])
    expect(h.map((p) => p.period)).toEqual(["2026-09-05", "2026-09-08"])
    expect(h[1].puls.orders7d).toBe(174)
  })
  it("en ordrett gjentatt maaling dagen etter telles én gang (08.09 = 09.09)", () => {
    const h = pulsHistoryOf([
      rep("2026-09-10", PULS_0910, "data"),
      rep("2026-09-09", PULS_0908),
      rep("2026-09-08", PULS_0908),
    ])
    expect(h.map((p) => p.period)).toEqual(["2026-09-08", "2026-09-10"])
  })
  it("uparsebar puls hoppes over uten aa velte resten", () => {
    const h = pulsHistoryOf([
      rep("2026-09-06", "Detox.no salgspuls: rekorduke!"),
      rep("2026-09-05", PULS_0905),
    ])
    expect(h.map((p) => p.period)).toEqual(["2026-09-05"])
  })
  it("tom inn gir tom ut", () => {
    expect(pulsHistoryOf([])).toEqual([])
  })
})

describe("grafgeometri", () => {
  it("scaleBars skalerer mot stoerste verdi, 0 naar ingenting er positivt", () => {
    expect(scaleBars([50, 100], 40)).toEqual([20, 40])
    expect(scaleBars([0, 0], 40)).toEqual([0, 0])
    expect(scaleBars([-5, 10], 40)).toEqual([0, 40])
  })
  it("linePath gir null under to punkter", () => {
    expect(linePath([], 100, 50)).toBeNull()
    expect(linePath([1], 100, 50)).toBeNull()
  })
  it("linePath legger min nederst, max oeverst, innenfor padding", () => {
    const p = linePath([10, 30, 20], 100, 50, 5)
    expect(p).not.toBeNull()
    if (!p) return
    expect(p.min).toBe(10)
    expect(p.max).toBe(30)
    expect(p.coords[0]).toEqual([5, 45])
    expect(p.coords[1]).toEqual([50, 5])
    expect(p.coords[2]).toEqual([95, 25])
    expect(p.d).toBe("M5 45 L50 5 L95 25")
  })
  it("flat serie legges midt i hoeyden", () => {
    const p = linePath([7, 7], 100, 50, 5)
    expect(p?.coords.map(([, y]) => y)).toEqual([25, 25])
  })
  it("shortDate: dd.mm av ISO-dato, ellers uendret", () => {
    expect(shortDate("2026-09-10")).toBe("10.09")
    expect(shortDate("uke 37")).toBe("uke 37")
  })
})
