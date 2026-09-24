import { describe, expect, it } from "vitest"

import {
  lesLenke,
  eierFilter,
  eierNavn,
  erBeslutning,
  forEier,
  grupper,
  gyldigBeslutning,
  prioritetTekst,
  type KoePost,
} from "../koe-poster"

function post(
  id: string,
  koe_id: string,
  eier: KoePost["eier"],
  prioritet = 2,
  opprettet = "2026-09-17T10:00:00Z",
  handling: KoePost["handling"] = "ja-nei",
): KoePost {
  return {
    id,
    koe_id,
    ekstern_id: `x-${id}`,
    tittel: `Post ${id}`,
    detalj: null,
    lenke: null,
    prioritet,
    eier,
    handling,
    status: "venter",
    avgjort_av: null,
    avgjort_at: null,
    utfort_av: null,
    utfort_at: null,
    kilde: "test",
    opprettet,
    oppdatert: opprettet,
  }
}

describe("eierfilter", () => {
  it("godtar bare indigo og anniken, alt annet er alle", () => {
    expect(eierFilter("indigo")).toBe("indigo")
    expect(eierFilter("anniken")).toBe("anniken")
    expect(eierFilter("kim")).toBe("alle")
    expect(eierFilter(undefined)).toBe("alle")
  })

  it("gir «begge» til begge eierne", () => {
    const poster = [post("a", "kim-kort", "indigo"), post("b", "annonse-raad", "anniken"), post("c", "kundeservice", "begge")]
    expect(forEier(poster, "indigo").map((p) => p.id)).toEqual(["a", "c"])
    expect(forEier(poster, "anniken").map((p) => p.id)).toEqual(["b", "c"])
    expect(forEier(poster, "alle")).toHaveLength(3)
    expect(eierNavn("begge")).toBe("Indigo og Anniken")
  })
})

describe("beslutning", () => {
  it("kjenner de tre beslutningene", () => {
    expect(erBeslutning("ja")).toBe(true)
    expect(erBeslutning("gjort")).toBe(true)
    expect(erBeslutning("kanskje")).toBe(false)
  })

  it("lar en ja/nei-post ta ja eller nei, og en gjort-post bare gjort", () => {
    expect(gyldigBeslutning("ja-nei", "ja")).toBe(true)
    expect(gyldigBeslutning("ja-nei", "nei")).toBe(true)
    expect(gyldigBeslutning("ja-nei", "gjort")).toBe(false)
    expect(gyldigBeslutning("gjort", "gjort")).toBe(true)
    expect(gyldigBeslutning("gjort", "ja")).toBe(false)
  })
})

describe("grupper", () => {
  it("holder koeenes rekkefoelge, og innenfor: haster foerst, saa eldst", () => {
    const g = grupper([
      post("1", "annonse-raad", "anniken", 2, "2026-09-17T10:00:00Z"),
      post("2", "kim-kort", "indigo", 2, "2026-09-16T10:00:00Z"),
      post("3", "kim-kort", "indigo", 0, "2026-09-17T10:00:00Z"),
      post("4", "kim-kort", "indigo", 2, "2026-09-15T10:00:00Z"),
      post("5", "ukjent-koe", "begge"),
      post("6", "kundeservice", "indigo", 1),
    ])
    expect(g.map((x) => x.koe_id)).toEqual(["kundeservice", "kim-kort", "annonse-raad", "ukjent-koe"])
    expect(g[1].navn).toBe("Kort som venter på ja fra deg")
    expect(g[1].poster.map((p) => p.id)).toEqual(["3", "4", "2"])
    expect(g[3].navn).toBe("ukjent-koe")
  })

  it("setter lapp bare naar prioriteten sier noe", () => {
    expect(prioritetTekst(0)).toBe("haster")
    expect(prioritetTekst(1)).toBe("viktig")
    expect(prioritetTekst(2)).toBeNull()
    expect(prioritetTekst(3)).toBe("kan vente")
  })
})

describe("lesLenke", () => {
  it("peker kim-kort-poster paa kortsiden, ingenting annet", () => {
    expect(lesLenke({ koe_id: "kim-kort", ekstern_id: "3f2a1b4c-0000-4000-8000-000000000000" })).toBe(
      "/kort/3f2a1b4c-0000-4000-8000-000000000000",
    )
    expect(lesLenke({ koe_id: "kim-kort", ekstern_id: "ikke-uuid" })).toBeNull()
    expect(lesLenke({ koe_id: "kundeservice", ekstern_id: "3f2a1b4c-0000-4000-8000-000000000000" })).toBeNull()
  })
})
