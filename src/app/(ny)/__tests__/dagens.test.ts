import { describe, expect, it } from "vitest"

import type { FindingRow } from "@/lib/radar"
import type { RequestRow } from "@/lib/eiere"

import {
  datoKort,
  datoLang,
  kr,
  koen,
  lede,
  nattensFunn,
  tall,
  varighet,
  venter,
} from "../dagens"

// Fast «naa» slik at testene ikke avhenger av klokka de kjoeres paa.
// 2026-09-16 08:00 norsk tid.
const NAA = new Date("2026-09-16T06:00:00Z")

function funn(
  id: string,
  agent: string,
  created_at: string,
  claim = "et funn",
): FindingRow {
  return {
    id,
    kind: "signal",
    claim,
    evidence: null,
    source_url: null,
    confidence: null,
    created_at,
    report: {
      id: `r-${id}`,
      agent_id: agent,
      report_type: "nightly",
      period: "2026-09-16",
      status: "ok",
      requires_review: false,
      created_at,
    },
  }
}

function koeRad(id: string, created_at: string): RequestRow {
  return {
    id,
    requester: "kim",
    kind: "content",
    body: "noe som venter",
    status: "open",
    created_at,
  }
}

describe("dato", () => {
  it("skriver datoen slik den leses i overskriften", () => {
    expect(datoKort(NAA)).toBe("16. september")
    expect(datoLang(NAA)).toBe("onsdag 16. september")
  })

  it("bruker norsk tidssone, ikke serverens", () => {
    // 2026-09-15 23:30 UTC er allerede 16. september i Oslo.
    const senKveld = new Date("2026-09-15T23:30:00Z")
    expect(datoKort(senKveld)).toBe("16. september")
  })
})

describe("tall og kroner", () => {
  // Intl bruker et smalt hardt mellomrom (U+202F) som tusenskille. Det er
  // riktig typografi, men usynlig i en assertion — sammenlign normalisert.
  const norm = (s: string) => s.replace(/\s/g, " ")

  it("formaterer kroner uten desimaler og med tusenskille", () => {
    expect(norm(kr(38420))).toBe("38 420 kr")
    expect(kr(937.4)).toBe("937 kr")
    expect(kr(0)).toBe("0 kr")
  })

  it("formaterer heltall med tusenskille", () => {
    expect(norm(tall(1384))).toBe("1 384")
    expect(tall(7)).toBe("7")
  })
})

describe("varighet", () => {
  it("gir dager naar det har gaatt mer enn et doegn", () => {
    expect(varighet("2026-09-12T06:00:00Z", NAA)).toBe("4 dager")
  })

  it("gir timer under et doegn, og entall for én", () => {
    expect(varighet("2026-09-16T03:00:00Z", NAA)).toBe("3 timer")
    expect(varighet("2026-09-16T05:00:00Z", NAA)).toBe("1 time")
  })

  it("sier under en time naar det er under en time", () => {
    expect(varighet("2026-09-16T05:45:00Z", NAA)).toBe("under en time")
  })

  it("sier ukjent naar tidspunktet mangler eller er ubrukelig", () => {
    expect(varighet(null, NAA)).toBe("ukjent")
    expect(varighet("ikke en dato", NAA)).toBe("ukjent")
  })
})

describe("nattensFunn", () => {
  it("tar bare med funn innenfor vinduet", () => {
    const rader = [
      funn("a", "agent-anakinbot", "2026-09-16T03:10:00Z"),
      funn("b", "agent-anakinbot", "2026-09-14T03:10:00Z"), // to doegn siden
    ]
    const natt = nattensFunn(rader, NAA)
    expect(natt.funn.map((f) => f.id)).toEqual(["a"])
  })

  it("teller per agent og sorterer nyeste foerst", () => {
    const rader = [
      funn("eldste", "agent-anakinbot", "2026-09-16T01:00:00Z"),
      funn("nyeste", "agent-indigobot", "2026-09-16T04:02:00Z"),
      funn("midt", "agent-anakinbot", "2026-09-16T03:10:00Z"),
    ]
    const natt = nattensFunn(rader, NAA)
    expect(natt.funn.map((f) => f.id)).toEqual(["nyeste", "midt", "eldste"])
    expect(natt.perAgent).toEqual({ anakin: 2, indigo: 1 })
    expect(natt.siste).toBe("2026-09-16T04:02:00Z")
  })

  it("er null funn, ikke en feil, naar rapporten er tom", () => {
    const natt = nattensFunn([], NAA)
    expect(natt.funn).toEqual([])
    expect(natt.siste).toBeNull()
  })

  it("hoppet over rader uten brukbar dato i stedet for aa krasje", () => {
    const rader = [funn("bra", "agent-anakinbot", "2026-09-16T03:00:00Z")]
    rader.push({ ...funn("darlig", "agent-anakinbot", "x"), created_at: "x" })
    expect(nattensFunn(rader, NAA).funn.map((f) => f.id)).toEqual(["bra"])
  })
})

describe("koen", () => {
  it("teller alt som venter og finner den eldste", () => {
    const k = koen(
      [
        koeRad("ny", "2026-09-15T06:00:00Z"),
        koeRad("gammel", "2026-09-12T06:00:00Z"),
      ],
      NAA,
    )
    expect(k.antall).toBe(2)
    expect(k.eldste).toBe("2026-09-12T06:00:00Z")
    expect(k.eldsteAlder).toBe("4 dager")
  })

  it("er tom naar ingenting venter — ikke en feil", () => {
    const k = koen([], NAA)
    expect(k.antall).toBe(0)
    expect(k.eldste).toBeNull()
    expect(k.eldsteAlder).toBeNull()
  })
})

describe("venter", () => {
  it("summerer køene og finner den eldste", () => {
    const v = venter(
      [
        { antall: 22, eldste: "2026-09-11T06:00:00Z" },
        { antall: 8, eldste: "2026-09-09T06:00:00Z" },
      ],
      NAA,
    )
    expect(v.totalt).toBe(30)
    expect(v.eldsteAlder).toBe("7 dager")
  })

  it("er null naar ingen kø er koblet til — ikke en feil", () => {
    expect(venter([], NAA)).toEqual({ totalt: 0, eldsteAlder: null })
  })

  it("taler naar en kø mangler eldste-tidspunkt", () => {
    const v = venter([{ antall: 5, eldste: null }], NAA)
    expect(v.totalt).toBe(5)
    expect(v.eldsteAlder).toBeNull()
  })
})

describe("lede", () => {
  const tomNatt = nattensFunn([], NAA)
  const ingenVenter = venter([], NAA)

  // «Venter på et ja eller nei» stod i leden fram til 17.09 og telte
  // agentenes arbeidskø. Nå er den lov — men bare fordi `koer` faktisk
  // teller eiernes køer. Disse testene holder den koblingen ærlig.
  it("sier fra om det som venter på et menneske, først", () => {
    const v = venter([{ antall: 22, eldste: "2026-09-12T06:00:00Z" }], NAA)
    const k = koen([koeRad("a", "2026-09-12T06:00:00Z")], NAA)
    const natt = nattensFunn(
      [funn("f", "agent-anakinbot", "2026-09-16T03:00:00Z")],
      NAA,
    )
    expect(lede(v, k, natt)).toBe(
      "22 ting venter på et ja eller nei fra dere. Den eldste har ventet 4 dager.",
    )
  })

  it("påstår IKKE at noe venter på et menneske naar koer er tom", () => {
    const k = koen([koeRad("a", "2026-09-12T06:00:00Z")], NAA)
    const natt = nattensFunn(
      [funn("f", "agent-anakinbot", "2026-09-16T03:00:00Z")],
      NAA,
    )
    const tekst = lede(ingenVenter, k, natt)
    expect(tekst).toBe(
      "Ingenting venter på dere. Agentene la fra seg 1 funn i natt. 1 oppdrag står i kø.",
    )
    expect(tekst).not.toMatch(/ja eller nei/i)
  })

  it("nevner agentkøen som en tilstand naar natten var tom", () => {
    const k = koen(
      [
        koeRad("a", "2026-09-12T06:00:00Z"),
        koeRad("b", "2026-09-13T06:00:00Z"),
        koeRad("c", "2026-09-15T06:00:00Z"),
      ],
      NAA,
    )
    expect(lede(ingenVenter, k, tomNatt)).toBe(
      "Ingenting venter på dere. 3 oppdrag står i kø hos agentene.",
    )
  })

  it("sier det som det er når alt er tomt", () => {
    expect(lede(ingenVenter, koen([], NAA), tomNatt)).toBe(
      "Stille natt, og ingenting i kø.",
    )
  })
})
