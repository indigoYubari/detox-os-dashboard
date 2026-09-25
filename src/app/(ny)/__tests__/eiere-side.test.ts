import { describe, expect, it } from "vitest"

import type { ContentItem } from "@/lib/content"
import { planOf, threadsOf, type Puls, type RadarReport, type RequestRow } from "@/lib/eiere"

import {
  anbefalingTekst,
  planHjelp,
  planSvar,
  pulsHjelp,
  pulsSvar,
  samtaleStatus,
  uken,
  ukenSvar,
} from "../eiere/eiere"

// Reglene for /eiere-siden, uten rendering. Tallene er Anakins egne fra
// radaren 2026-09-08 (samme som eiere.test.ts).

const PULS_0908: Puls = {
  orders7d: 174,
  revenue7d: 195408.3,
  ordersPrev: 179,
  revenuePrev: 193818.05,
  revenueDeltaPct: 0.8,
  ordersDeltaPct: -2.8,
}

function mellomrom(s: string): string {
  return s.replace(/[  ]/g, " ")
}

describe("pulsen", () => {
  it("setter retningen foerst, saa tallet", () => {
    const s = pulsSvar(PULS_0908)
    expect(s.hook).toBe("Flatt")
    expect(mellomrom(s.tekst)).toBe("195 408 kr på 174 ordrer siste uke")
    expect(s.ned).toBe(false)
  })

  it("skiller opp, ned og flatt paa omsetningen", () => {
    expect(pulsSvar({ ...PULS_0908, revenueDeltaPct: 12 }).hook).toBe("Godt opp")
    expect(pulsSvar({ ...PULS_0908, revenueDeltaPct: 3 }).hook).toBe("Litt opp")
    expect(pulsSvar({ ...PULS_0908, revenueDeltaPct: -3 })).toMatchObject({ hook: "Litt ned", ned: true })
    expect(pulsSvar({ ...PULS_0908, revenueDeltaPct: -12.1 })).toMatchObject({ hook: "Klart ned", ned: true })
    expect(pulsSvar({ ...PULS_0908, revenueDeltaPct: null }).hook).toBe("Siste uke")
  })

  it("hjelpelinja har uken foer, endringene og beregnet snittkurv", () => {
    const h = mellomrom(pulsHjelp(PULS_0908))
    expect(h).toContain("Uken før: 193 818 kr på 179 ordrer.")
    expect(h).toContain("Omsetning +0,8 %, ordrer -2,8 %.")
    expect(h).toContain("Snittkurv 1 123 kr (+3,7 %), beregnet av tallene.")
  })
})

function rapport(actions: { id: string; action: string; status?: string }[]): RadarReport {
  return {
    id: "r",
    agent_id: "agent-anakinbot",
    report_type: "content-radar",
    period: "2026-09-08",
    status: "ok",
    requires_review: false,
    created_at: "2026-09-08T05:37:20Z",
    findings: [],
    recommendations: actions.map((a, i) => ({
      id: a.id,
      kind: "content",
      action: a.action,
      status: a.status ?? "pending",
      owner: null,
      created_at: String(i),
    })),
  }
}

describe("planen", () => {
  const r = rapport([
    { id: "1", action: "B1 mekanisme-karusell om D-vitamin" },
    { id: "2", action: "A1 refleksiv til 14.-15.09" },
    { id: "3", action: "Klaviyo-utkast: 16 dager uten kampanje" },
    { id: "4", action: "A2 «Rolig kveld»-rutine" },
    { id: "5", action: "[KREVER GODKJENNING] B2 tillits-karusell" },
    { id: "6", action: "Bygg eid liste", status: "approved" },
  ])

  it("svaret er det ene neste trekket, uten godkjenningsmerket", () => {
    const s = planSvar(planOf(r))
    expect(s.neste).toBe("Klaviyo-utkast: 16 dager uten kampanje")
    expect(s.venter).toBe(5)
    expect(s.avgjort).toBe(1)
    expect(anbefalingTekst({ action: "[KREVER GODKJENNING] B2 tillits-karusell" })).toBe("B2 tillits-karusell")
  })

  it("hjelpelinja teller det som venter, det avgjorte og sporene", () => {
    expect(planHjelp(planOf(r))).toBe(
      "5 anbefalinger venter på avgjørelse, 1 er avgjort. Resten av planen: spor A 1 · spor B 1.",
    )
  })

  it("ingen anbefalinger gir null, ikke en tom streng", () => {
    expect(planSvar(planOf(rapport([]))).neste).toBeNull()
  })
})

function rad(id: string, body: string, extra: Partial<RequestRow> = {}): RequestRow {
  return {
    id,
    requester: "kim@detox.no",
    kind: "content",
    body,
    status: "open",
    created_at: `2026-09-2${id}T10:00:00Z`,
    ...extra,
  }
}

describe("samtalene", () => {
  it("teller traader og paagaaende, og finner det siste Anakin sa", () => {
    const rows = [
      rad("1", "[chat_thread] til: agent-anakinbot\nHei", {
        response: "Jeg ser på det. Magnesium først.",
        responded_at: "2026-09-21T12:00:00Z",
        status: "done",
      }),
      rad("2", "[chat_thread] til: agent-anakinbot\nHva med søvn?", {
        response: "Søvn er neste sak.",
        responded_at: "2026-09-23T12:00:00Z",
      }),
    ]
    const st = samtaleStatus(threadsOf(rows))
    expect(st.totalt).toBe(2)
    expect(st.paagaar).toBe(1)
    expect(st.siste).toEqual({ tekst: "Søvn er neste sak.", threadKey: "2" })
  })

  it("ingen svar = null, ikke et oppdiktet sitat", () => {
    const st = samtaleStatus(threadsOf([rad("1", "[chat_thread] til: agent-anakinbot\nHei")]))
    expect(st.siste).toBeNull()
    expect(st.paagaar).toBe(1)
  })
})

function ide(id: string, stage_status: ContentItem["stage_status"]): ContentItem {
  return {
    id,
    title: `Idé ${id}`,
    topic: null,
    stage: "brief",
    stage_status,
    channels: [],
    requested_by: null,
    source_repo: "detox-vault",
    source_path: `x/${id}.md`,
    data_mode: "live",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-02T10:00:00Z",
    synced_at: null,
  }
}

describe("uken", () => {
  it("bunter etter stage_status og sier det i ett svar", () => {
    const u = uken([ide("a", "complete"), ide("b", "pending"), ide("c", "needs_research"), ide("d", "blocked")])
    expect(u.per.planlagt.map((i) => i.id)).toEqual(["a"])
    expect(u.per.venter.map((i) => i.id)).toEqual(["b", "c"])
    expect(u.per.blokkert.map((i) => i.id)).toEqual(["d"])
    expect(ukenSvar(u)).toBe("4 idéer i arbeid: 1 planlagt, 2 venter, 1 blokkert")
  })

  it("tomt er tomt", () => {
    expect(ukenSvar(uken([]))).toBe("Ingen idéer i arbeid")
  })
})
