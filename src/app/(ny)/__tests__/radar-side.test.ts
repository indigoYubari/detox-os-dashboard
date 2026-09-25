import { describe, expect, it } from "vitest"

import { DEFAULT_FILTERS, type FindingRow } from "@/lib/radar"

import { agentValg, funnHref, funnLede, nyesteForst, periodeValg, typeValg } from "../radar/radar"

function funn(id: string, kind: string, created_at: string): FindingRow {
  return {
    id,
    kind,
    claim: "et funn",
    evidence: null,
    source_url: null,
    confidence: null,
    created_at,
    report: {
      id: `r-${id}`,
      agent_id: "agent-indigobot",
      report_type: "nightly-harvest:magnesium",
      period: "2026-09-24",
      status: "ok",
      requires_review: false,
      created_at,
    },
  }
}

describe("funnene: lenker og filtre", () => {
  it("bare avvik fra default havner i lenka, paa /radar", () => {
    expect(funnHref(DEFAULT_FILTERS, {})).toBe("/radar")
    expect(funnHref(DEFAULT_FILTERS, { periode: "30d" })).toBe("/radar?periode=30d")
    expect(funnHref({ agent: "indigo", periode: "30d", kind: "watch" }, { kind: null })).toBe(
      "/radar?agent=indigo&periode=30d",
    )
  })

  it("periode- og agentvalg markerer det som er valgt", () => {
    expect(periodeValg(DEFAULT_FILTERS).map((v) => [v.tekst, v.valgt])).toEqual([
      ["Siste 7 dager", true],
      ["Siste 30 dager", false],
    ])
    expect(agentValg({ ...DEFAULT_FILTERS, agent: "indigo" }).find((v) => v.valgt)?.tekst).toBe("Indigo")
  })

  it("typevalg viser bare typer som finnes i radene, pluss den valgte", () => {
    const rader = [funn("a", "watch", "1"), funn("b", "gap", "2"), funn("c", "watch", "3")]
    expect(typeValg(DEFAULT_FILTERS, rader).map((v) => v.tekst)).toEqual(["Alle typer", "foelg med", "hull"])
    expect(typeValg({ ...DEFAULT_FILTERS, kind: "risk" }, rader).map((v) => v.tekst)).toEqual([
      "Alle typer",
      "foelg med",
      "hull",
      "risiko",
    ])
    expect(typeValg({ ...DEFAULT_FILTERS, kind: "gap" }, rader).find((v) => v.valgt)?.tekst).toBe("hull")
  })
})

describe("funnene: leden", () => {
  it("sier antall, hvem og vindu", () => {
    expect(funnLede(12, DEFAULT_FILTERS)).toBe("12 funn fra agentene siste 7 dager.")
    expect(funnLede(1, { agent: "indigo", periode: "30d", kind: "watch" })).toBe(
      "1 funn av typen «foelg med» fra Indigo siste 30 dager.",
    )
  })
  it("tomt er tomt", () => {
    expect(funnLede(0, { ...DEFAULT_FILTERS, agent: "anakin" })).toBe(
      "Ingen funn fra Anakin siste 7 dager.",
    )
  })
})

describe("funnene: rekkefoelge", () => {
  it("nyeste foerst uansett hva serveren leverte", () => {
    const r = nyesteForst([
      funn("a", "watch", "2026-09-20T06:00:00Z"),
      funn("b", "watch", "2026-09-24T06:00:00Z"),
      funn("c", "watch", "2026-09-22T06:00:00Z"),
    ])
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"])
  })
})
