import { describe, expect, it } from "vitest"

import type { ButikkTall, LagerTall, ProduktTall } from "@/lib/butikk"

import {
  kundeSvar,
  lagerSvar,
  nettoTekst,
  omsetningHjelp,
  omsetningTekst,
  retning,
  toppProdukt,
} from "../butikken/butikken"

// Setningene paa /butikken. Tallene er formen fra et ekte metrics-svar
// (se butikk.test.ts), ikke oppdiktet virkelighet.

function m(s: string): string {
  return s.replace(/[  ]/g, " ")
}

const BUTIKK: ButikkTall = {
  omsetning: 154422.4,
  ordrer: 128,
  snittordre: 1206.4,
  enheter: 301,
  delta: {
    omsetning: { abs: 6200, pct: 4.2, dir: "up" },
    ordrer: { abs: -1, pct: -0.8, dir: "down" },
    snittordre: { abs: 60, pct: 5.3, dir: "up" },
  },
}

describe("salget", () => {
  it("retningen foerst, saa tallet", () => {
    expect(retning(4.2)).toEqual({ hook: "Litt opp", ned: false })
    expect(retning(-12)).toEqual({ hook: "Klart ned", ned: true })
    expect(retning(0.4)).toEqual({ hook: "Flatt", ned: false })
    expect(retning(null)).toEqual({ hook: "Siste 30 dager", ned: false })
    expect(m(omsetningTekst(BUTIKK))).toBe("154 422 kr på 128 ordrer")
  })

  it("hjelpelinja har forrige periode, snittordre og enheter", () => {
    expect(m(omsetningHjelp(BUTIKK))).toBe(
      "Mot forrige 30 dager: omsetning +4,2 %, ordrer -0,8 %. Snittordre 1 206 kr (+5,3 %), 301 solgte enheter.",
    )
  })

  it("uten sammenligning sier den det", () => {
    const uten = { ...BUTIKK, delta: { omsetning: null, ordrer: null, snittordre: null } }
    expect(m(omsetningHjelp(uten))).toContain("Ingen forrige periode å sammenligne med.")
  })
})

const PRODUKT: ProduktTall = {
  ulikeProdukter: 42,
  topp: [
    { navn: "Magnesium Threonate", enheter: 31, omsetning: 18600 },
    { navn: "L-Theanine", enheter: 40, omsetning: 12000 },
  ],
  netto: { omsetning: 150000, ordrer: 125, utelatt: 3, delvisRefundert: 1 },
  kunder: {
    nye: { ordrer: 70, andel: 0.55 },
    returnerende: { ordrer: 55, andel: 0.43 },
    ukjent: { ordrer: 3 },
  },
}

describe("produktene og kundene", () => {
  it("topp = hoeyest omsetning, ikke flest enheter", () => {
    expect(toppProdukt(PRODUKT)?.navn).toBe("Magnesium Threonate")
    expect(toppProdukt({ ...PRODUKT, topp: [] })).toBeNull()
  })

  it("netto sier hva som er holdt utenfor", () => {
    expect(m(nettoTekst(PRODUKT))).toBe(
      "Netto 150 000 kr på 125 ordrer. 3 ordrer holdt utenfor (refundert eller annullert). 1 delvis refundert, beløpet er ukjent og er med.",
    )
  })

  it("kundene: hook etter hvem det er flest av", () => {
    const k = kundeSvar(PRODUKT)
    expect(k.hook).toBe("Flest nye kunder")
    expect(k.tekst).toBe("70 ordrer fra nye (55 %), 55 fra returnerende (43 %). 3 uten kundeprofil.")
    expect(kundeSvar({ ...PRODUKT, kunder: { ...PRODUKT.kunder, nye: { ordrer: 55, andel: null } } }).hook).toBe(
      "Likt fordelt",
    )
  })
})

const LAGER: LagerTall = {
  hentet: "2026-09-25T04:00:00Z",
  produkter: 60,
  enheter: 2400,
  utsolgt: 2,
  lavt: 5,
  terskel: 10,
  lavtListe: [{ navn: "Paratox", antall: 0 }],
}

describe("lageret", () => {
  it("utsolgt gaar foran lite igjen, og ingenting gir null", () => {
    expect(lagerSvar(LAGER).varsel).toBe("2 produkter er utsolgt")
    expect(lagerSvar({ ...LAGER, utsolgt: 0 }).varsel).toBe("5 produkter har lite igjen")
    expect(lagerSvar({ ...LAGER, utsolgt: 0, lavt: 0 }).varsel).toBeNull()
    expect(m(lagerSvar(LAGER).tekst)).toBe(
      "2 400 enheter på lager fordelt på 60 produkter. Lite igjen betyr 10 eller færre.",
    )
  })
})
