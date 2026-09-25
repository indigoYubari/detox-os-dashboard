import { describe, expect, it } from "vitest"

import type { CampaignHealth, MetricsResponse, Proposal, SearchTerm } from "@/lib/detox-api"

import {
  betaltHook,
  betaltMedia,
  betaltTekst,
  forslag,
  forslagSvar,
  kampanjer,
  kampanjeStatus,
  kampanjeSvar,
  kanalLinje,
  soekeord,
  soekeordSvar,
} from "../annonser/annonser"

// Reglene for /annonser. Formen paa svarene er ad-agentens (detox-api.ts);
// tallene er bare tall som gir hver regel én kant aa testes mot.

function m(s: string): string {
  return s.replace(/[  ]/g, " ")
}

function kanal(channel: MetricsResponse["channels"][number]["channel"], spend: number, revenue: number) {
  return {
    channel,
    rows: 10,
    spend,
    revenue,
    roas: spend > 0 ? revenue / spend : null,
    conversions: 12,
    impressions: 1000,
    clicks: 80,
    byType: [],
  }
}

const METRICS: MetricsResponse = {
  range: { since: "2026-08-26", until: "2026-09-24" },
  lastSync: "2026-09-25T04:01:03Z",
  channels: [kanal("google_ads", 20000, 90000), kanal("meta", 10000, 6000), kanal("shopify", 0, 200000)],
  totals: { adSpend: 30000, shopifyRevenue: 200000 },
  comparison: {
    totals: {
      adSpend: { abs: 1000, pct: 3.4, dir: "up" },
      shopifyRevenue: { abs: 0, pct: 0, dir: "flat" },
      shopifyOrders: { abs: 0, pct: 0, dir: "flat" },
    },
    channels: {
      meta: {
        spend: { abs: 2000, pct: 25, dir: "up" },
        revenue: { abs: 0, pct: 0, dir: "flat" },
        conversions: { abs: 0, pct: 0, dir: "flat" },
        roas: { abs: 0, pct: 0, dir: "flat" },
      },
    },
  },
}

describe("betalt media", () => {
  it("summerer bare kanalene som koster penger, stoerst forbruk foerst", () => {
    const b = betaltMedia(METRICS)
    expect(b.kanaler.map((k) => k.id)).toEqual(["google_ads", "meta"])
    expect(b.brukt).toBe(30000)
    expect(b.tilbake).toBe(96000)
    expect(b.roas).toBeCloseTo(3.2)
    expect(b.tapere.map((k) => k.navn)).toEqual(["Meta"])
  })

  it("hooken foelger samlet ROAS", () => {
    expect(betaltHook(betaltMedia(METRICS))).toEqual({ hook: "Tjener seg inn", ned: false })
    expect(betaltHook({ brukt: 100, tilbake: 50, roas: 0.5, kanaler: [], tapere: [] })).toEqual({
      hook: "Går med tap",
      ned: true,
    })
    expect(betaltHook({ brukt: 0, tilbake: 0, roas: null, kanaler: [], tapere: [] }).hook).toBe("Ingen forbruk")
    expect(m(betaltTekst({ brukt: 0, tilbake: 0, roas: null, kanaler: [], tapere: [] }))).toContain("Ingen annonseutgifter")
  })

  it("kanallinja har forbruk, tilbake, ROAS, salg og endring", () => {
    const meta = betaltMedia(METRICS).kanaler.find((k) => k.id === "meta")!
    expect(m(kanalLinje(meta))).toBe("10 000 kr brukt, 6 000 kr tilbake (0.60x), 12 salg. Forbruk +25 % mot forrige periode.")
    const google = betaltMedia(METRICS).kanaler.find((k) => k.id === "google_ads")!
    expect(m(kanalLinje(google))).toBe("20 000 kr brukt, 90 000 kr tilbake (4.50x), 12 salg.")
  })
})

function kampanje(id: string, spend: number, revenue: number, budgetLimited = false): CampaignHealth {
  return {
    campaignId: id,
    name: `Kampanje ${id}`,
    channelType: "SEARCH",
    biddingStrategy: null,
    dailyBudget: 500,
    spend,
    revenue,
    conversions: 3,
    roas: spend > 0 ? revenue / spend : null,
    budgetLimited,
    adQuality: { byGrade: {}, worst: null, worstNo: null, dominant: null, dominantNo: null },
    tempo: { todaySpend: 0, dailyBudget: 500, pct: null },
    health: "ok",
  }
}

describe("kampanjene", () => {
  it("status: tap foran budsjett foran god, og stille uten forbruk", () => {
    expect(kampanjeStatus(kampanje("a", 1000, 500))).toBe("tap")
    expect(kampanjeStatus(kampanje("b", 1000, 2000, true))).toBe("budsjett")
    expect(kampanjeStatus(kampanje("c", 1000, 5000))).toBe("god")
    expect(kampanjeStatus(kampanje("d", 1000, 2000))).toBe("ok")
    expect(kampanjeStatus(kampanje("e", 0, 0))).toBe("stille")
  })

  it("sorterer tap foerst, hoeyest forbruk innenfor, og svarer paa det verste", () => {
    const k = kampanjer([kampanje("god", 100, 900), kampanje("tap2", 50, 10), kampanje("tap1", 500, 100), kampanje("stille", 0, 0)])
    expect(k.sortert.map((c) => c.campaignId)).toEqual(["tap1", "tap2", "god", "stille"])
    expect(k.aktive).toBe(3)
    expect(kampanjeSvar(k)).toEqual({ hook: "2 kampanjer går med tap", ned: true })
    expect(kampanjeSvar(kampanjer([kampanje("b", 1000, 2000, true)]))).toEqual({
      hook: "1 kampanje er begrenset av budsjettet",
      ned: false,
    })
    expect(kampanjeSvar(kampanjer([kampanje("god", 100, 900)])).hook).toBe("Alle 1 aktive kampanjene tjener seg inn")
    expect(kampanjeSvar(kampanjer([])).hook).toBe("Ingen kampanjer")
  })
})

function term(searchTerm: string, cost: number, revenue: number, flag: SearchTerm["flag"]): SearchTerm {
  return {
    searchTerm,
    campaignName: null,
    adGroupName: null,
    cost,
    clicks: 10,
    impressions: 100,
    conversions: revenue > 0 ? 1 : 0,
    revenue,
    roas: cost > 0 ? revenue / cost : null,
    flag,
  }
}

describe("soekeordene", () => {
  it("summerer det bortkastede og setter dyrest foerst", () => {
    const s = soekeord([term("billig detox", 120, 0, "wasted"), term("magnesium", 40, 900, "strong"), term("x", 300, 0, "wasted"), term("y", 5, 0, null)])
    expect(s.bortkastet.map((t) => t.searchTerm)).toEqual(["x", "billig detox"])
    expect(s.bortkastetKr).toBe(420)
    expect(s.sterke.map((t) => t.searchTerm)).toEqual(["magnesium"])
    expect(m(soekeordSvar(s).hook)).toBe("420 kr brukt på søk som ikke ga noe")
    expect(soekeordSvar(soekeord([term("magnesium", 40, 900, "strong")]))).toEqual({ hook: "Ingen bortkastede søk", ned: false })
    expect(soekeordSvar(soekeord([])).hook).toBe("Ingen søkeord")
  })
})

function p(id: string, priority: Proposal["priority"], created_at: string): Proposal {
  return {
    id,
    channel: "google_ads",
    entity_type: "campaign",
    entity_id: null,
    entity_name: null,
    recommendation_type: "pause_or_revise",
    priority,
    current_roas: null,
    current_spend: null,
    suggested_action: `Forslag ${id}`,
    ai_analysis: null,
    status: "pending",
    created_at,
    decided_at: null,
    decided_by: null,
    executed_at: null,
    execution_status: null,
    execution_result: null,
  }
}

describe("forslagene", () => {
  it("kritisk foerst, nyeste innenfor, og svaret nevner det kritiske", () => {
    const f = forslag([p("i", "info", "2026-09-24T00:00:00Z"), p("k1", "critical", "2026-09-20T00:00:00Z"), p("w", "warning", "2026-09-23T00:00:00Z"), p("k2", "critical", "2026-09-22T00:00:00Z")])
    expect(f.sortert.map((x) => x.id)).toEqual(["k2", "k1", "w", "i"])
    expect(forslagSvar(f)).toEqual({ hook: "2 kritiske forslag av 4", ned: true })
    expect(forslagSvar(forslag([p("w", "warning", "1")]))).toEqual({ hook: "1 forslag venter", ned: false })
    expect(forslagSvar(forslag([])).hook).toBe("Ingen forslag venter")
  })
})
