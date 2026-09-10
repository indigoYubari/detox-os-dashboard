import { describe, expect, it } from "vitest"

import {
  agentsFor,
  confidenceLabel,
  filterHref,
  freshnessOf,
  groupByAgent,
  parseFilters,
  sinceDate,
  storyOf,
  type FindingRow,
} from "../radar"

describe("parseFilters", () => {
  it("default naar ingenting er satt", () => {
    expect(parseFilters(undefined)).toEqual({
      agent: "alle",
      periode: "7d",
      kind: null,
    })
    expect(parseFilters({})).toEqual({
      agent: "alle",
      periode: "7d",
      kind: null,
    })
  })
  it("tar gyldige verdier og ignorerer ugyldige", () => {
    expect(
      parseFilters({ agent: "indigo", periode: "30d", kind: "watch" }),
    ).toEqual({
      agent: "indigo",
      periode: "30d",
      kind: "watch",
    })
    expect(
      parseFilters({ agent: "freya", periode: "90d", kind: "sql" }),
    ).toEqual({
      agent: "alle",
      periode: "7d",
      kind: null,
    })
    expect(parseFilters({ kind: ["risk", "trend"] }).kind).toBe("risk")
  })
})

describe("sinceDate / filterHref / agentsFor", () => {
  it("regner dager tilbake i UTC-dato", () => {
    const now = new Date("2026-09-10T12:00:00Z")
    expect(sinceDate("7d", now)).toBe("2026-09-03")
    expect(sinceDate("30d", now)).toBe("2026-08-11")
  })
  it("legger bare avvik fra default i URL-en", () => {
    expect(filterHref({ agent: "alle", periode: "7d", kind: null })).toBe(
      "/radar",
    )
    expect(filterHref({ agent: "anakin", periode: "30d", kind: "risk" })).toBe(
      "/radar?agent=anakin&periode=30d&kind=risk",
    )
  })
  it("mapper agentfilter til agent_id-er", () => {
    expect(agentsFor("alle")).toEqual(["agent-anakinbot", "agent-indigobot"])
    expect(agentsFor("indigo")).toEqual(["agent-indigobot"])
  })
})

describe("storyOf / confidenceLabel / groupByAgent", () => {
  it("utleder story fra nightly-harvest-typen", () => {
    expect(storyOf("nightly-harvest:magnesium-sleep")).toBe("magnesium-sleep")
    expect(storyOf("content-radar")).toBeNull()
    expect(storyOf("x:")).toBeNull()
    expect(storyOf(null)).toBeNull()
  })
  it("viser confidence som prosent naar den er 0–1", () => {
    expect(confidenceLabel("0.95")).toBe("95 %")
    expect(confidenceLabel(1)).toBe("100 %")
    expect(confidenceLabel(null)).toBeNull()
    expect(confidenceLabel("hoy")).toBe("hoy")
  })
  it("grupperer per agent og dropper ukjente", () => {
    const mk = (agent: string): FindingRow => ({
      id: agent,
      kind: "watch",
      claim: "",
      evidence: null,
      source_url: null,
      confidence: null,
      created_at: "",
      report: {
        id: "r",
        agent_id: agent,
        report_type: "t",
        period: "2026-09-10",
        status: "artifact_pending",
        requires_review: true,
        created_at: "",
      },
    })
    const g = groupByAgent([
      mk("agent-indigobot"),
      mk("agent-freya"),
      mk("agent-anakinbot"),
    ])
    expect(g["agent-anakinbot"]).toHaveLength(1)
    expect(g["agent-indigobot"]).toHaveLength(1)
  })
})

describe("freshnessOf", () => {
  const now = new Date("2026-09-10T12:00:00Z").getTime()
  it("fersk innen 24 t, eldre innen 48 t, ellers STALE", () => {
    expect(freshnessOf("2026-09-10T05:27:46Z", now).variant).toBe("success")
    expect(freshnessOf("2026-09-09T06:00:00Z", now).variant).toBe("warning")
    expect(freshnessOf("2026-09-07T06:00:00Z", now)).toMatchObject({
      variant: "error",
      label: "STALE — ingen rapport siste 48 t",
    })
  })
  it("ingen rapport er STALE, ikke fersk", () => {
    expect(freshnessOf(null, now)).toMatchObject({
      variant: "error",
      ageH: null,
    })
    expect(freshnessOf("ikke-en-dato", now).variant).toBe("error")
  })
})
