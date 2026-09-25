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

// ── Alder, utgått og kvittering (plan 25.09, del 2) ─────────────────────────

import {
  dagerVentet,
  KOE_HJELP,
  KOE_NAVN,
  KOE_REKKEFOLGE,
  kvittering,
  utgaattPerKoe,
  venterLenge,
  ventetTekst,
  VENTET_LENGE_DAGER,
} from "../koe-poster"

const NAA = new Date("2026-09-25T12:00:00Z")

describe("alle køene i basen har navn og forklaring", () => {
  it("produkt-kandidater er med, med det et ja faktisk gjør", () => {
    expect(KOE_REKKEFOLGE).toContain("produkt-kandidater")
    expect(KOE_NAVN["produkt-kandidater"]).toBe("Guider som venter på ja")
    expect(KOE_HJELP["produkt-kandidater"]).toMatch(/utkast til guiden/)
    expect(KOE_HJELP["annonse-raad"]).toMatch(/byttes ut hver natt/)
  })
  it("grupper bruker navnet, ikke id-en", () => {
    const g = grupper([post("a", "produkt-kandidater", "anniken", 1)])
    expect(g[0].navn).toBe("Guider som venter på ja")
  })
})

describe("hvor lenge en post har ventet", () => {
  it("teller hele dager og sier fra etter en uke", () => {
    const p = post("a", "kim-kort", "indigo", 2, "2026-09-17T10:00:00Z")
    expect(dagerVentet(p, NAA)).toBe(8)
    expect(venterLenge(p, NAA)).toBe(true)
    expect(ventetTekst(p, NAA)).toBe("har ventet 8 dager")
    expect(VENTET_LENGE_DAGER).toBe(7)
  })
  it("under en dag sier ingenting, én dag i entall", () => {
    expect(ventetTekst(post("b", "kim-kort", "indigo", 2, "2026-09-25T09:00:00Z"), NAA)).toBeNull()
    expect(ventetTekst(post("c", "kim-kort", "indigo", 2, "2026-09-24T09:00:00Z"), NAA)).toBe("har ventet 1 dag")
    expect(venterLenge(post("c", "kim-kort", "indigo", 2, "2026-09-24T09:00:00Z"), NAA)).toBe(false)
  })
})

describe("utgått ubesvart", () => {
  it("teller bare utgatt innenfor vinduet, per kø", () => {
    const rader = [
      { koe_id: "annonse-raad", status: "utgatt", oppdatert: "2026-09-24T03:00:00Z" },
      { koe_id: "annonse-raad", status: "utgatt", oppdatert: "2026-09-20T03:00:00Z" },
      { koe_id: "annonse-raad", status: "utgatt", oppdatert: "2026-09-10T03:00:00Z" },
      { koe_id: "annonse-raad", status: "venter", oppdatert: "2026-09-25T03:00:00Z" },
      { koe_id: "kim-kort", status: "utgatt", oppdatert: "2026-09-25T03:00:00Z" },
    ]
    expect(utgaattPerKoe(rader, NAA, 7)).toEqual({ "annonse-raad": 2, "kim-kort": 1 })
    expect(utgaattPerKoe([], NAA)).toEqual({})
  })
})

describe("kvitteringen", () => {
  const base = post("k", "produkt-kandidater", "anniken", 1, "2026-09-18T10:00:00Z")
  it("sier hva du sa og at huben utførte det, med hvem", () => {
    const k = kvittering(
      { ...base, status: "ja", avgjort_at: "2026-09-22T10:00:00Z", utfort_av: "demandscan-draft", utfort_at: "2026-09-23T04:00:00Z" },
      NAA,
    )
    expect(k.avgjort).toBe("Du sa ja for 3 dager siden.")
    expect(k.utfort).toBe("Utført etter 18 timer av demandscan-draft.")
    expect(k.sent).toBe(false)
  })
  it("varsler når avgjørelsen er over et døgn gammel og ikke utført", () => {
    const k = kvittering({ ...base, status: "nei", avgjort_at: "2026-09-23T10:00:00Z", utfort_av: null, utfort_at: null }, NAA)
    expect(k.avgjort).toBe("Du sa nei for 2 dager siden.")
    expect(k.utfort).toBe("Ikke utført ennå.")
    expect(k.sent).toBe(true)
  })
  it("varsler ikke før døgnet er gått", () => {
    const k = kvittering({ ...base, status: "ja", avgjort_at: "2026-09-25T09:00:00Z", utfort_av: null, utfort_at: null }, NAA)
    expect(k.avgjort).toBe("Du sa ja for 3 timer siden.")
    expect(k.sent).toBe(false)
  })
  it("gjetter ikke når tidspunktet mangler", () => {
    const k = kvittering({ ...base, status: "gjort", avgjort_at: null, utfort_av: null, utfort_at: null }, NAA)
    expect(k.avgjort).toBe("Avgjort: gjort, tidspunkt ukjent.")
    expect(k.sent).toBe(false)
  })
})
