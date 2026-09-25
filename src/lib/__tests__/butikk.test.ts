import { describe, expect, it } from "vitest"

import {
  butikkVindu,
  IKKE_KOBLET,
  lesButikkTall,
  lesLagerTall,
  lesProduktTall,
  STALE_ETTER_TIMER,
  vurderFriskhet,
} from "../butikk"
import type {
  InventoryResponse,
  MetricsResponse,
  ShopifyDetailResponse,
} from "../detox-api"

// Formen under er kopiert fra et ekte svar fra /api/detox/metrics
// (2026-08-25, vindu 2026-07-26..2026-08-25), ikke oppdiktet.
function metrics(overstyr: Partial<MetricsResponse> = {}): MetricsResponse {
  return {
    range: { since: "2026-07-26", until: "2026-08-25" },
    previousRange: { since: "2026-06-25", until: "2026-07-25" },
    lastSync: "2026-08-25T04:01:03.464873+00:00",
    channels: [
      {
        channel: "shopify",
        rows: 339,
        spend: 0,
        revenue: 154422.4,
        roas: null,
        conversions: 128,
        impressions: 0,
        clicks: 0,
        byType: [
          {
            entity_type: "product",
            rows: 201,
            spend: 0,
            revenue: 173495.4,
            conversions: 311,
          },
          {
            entity_type: "order",
            rows: 128,
            spend: 0,
            revenue: 154422.4,
            conversions: 128,
          },
          {
            entity_type: "customer_segment",
            rows: 10,
            spend: 0,
            revenue: 153926.3,
            conversions: 127,
          },
        ],
      },
    ],
    totals: { adSpend: 6252.54, shopifyRevenue: 154422.4, shopifyOrders: 128 },
    comparison: {
      totals: {
        adSpend: { abs: 877.51, pct: 16.3, dir: "up" },
        shopifyRevenue: { abs: -239287.95, pct: -60.8, dir: "down" },
        shopifyOrders: { abs: -145, pct: -53.1, dir: "down" },
      },
      channels: {
        shopify: {
          spend: { abs: 0, pct: 0, dir: "flat" },
          revenue: { abs: -239287.95, pct: -60.8, dir: "down" },
          conversions: { abs: -145, pct: -53.1, dir: "down" },
          roas: { abs: 0, pct: 0, dir: "flat" },
        },
      },
    },
    ...overstyr,
  }
}

describe("lesButikkTall", () => {
  it("leser omsetning og ordrer fra order-nivaa, ikke summen av alle rader", () => {
    const t = lesButikkTall(metrics())!
    // 154422.4 er order-nivaaet. Summen av alle byType-rader ville blitt
    // 481844.1 - trippelttelling av de samme ordrene.
    expect(t.omsetning).toBe(154422.4)
    expect(t.ordrer).toBe(128)
  })

  it("regner snittordre av de to", () => {
    const t = lesButikkTall(metrics())!
    expect(t.snittordre).toBeCloseTo(154422.4 / 128, 6)
  })

  it("leser enheter fra product-nivaa, og lar product.rows ligge", () => {
    const t = lesButikkTall(metrics())!
    expect(t.enheter).toBe(311)
    // 201 er antall produkt-DAGER (en rad per produkt per synkdag), ikke
    // antall produkter. Tallet skal ikke finnes i resultatet under noe navn.
    expect(JSON.stringify(t)).not.toContain("201")
    expect(t).not.toHaveProperty("produkter")
  })

  it("utleder snittordre-delta fra forrige periode", () => {
    const t = lesButikkTall(metrics())!
    // Forrige periode: omsetning 393710.35 paa 273 ordrer = 1442.16 snitt.
    // Naa: 1206.42. Altsaa ned, selv om begge tallene isolert falt.
    expect(t.delta.snittordre?.dir).toBe("down")
    expect(t.delta.omsetning?.pct).toBe(-60.8)
    expect(t.delta.ordrer?.abs).toBe(-145)
  })

  it("gir null - ikke nuller - naar Shopify-kanalen mangler", () => {
    // Kjernen i hele slicen: en fraevaerende kilde skal aldri bli til
    // "kr 0 · 0 ordrer", som ser ut som en maaling av en doed butikk.
    const utenShopify = metrics({ channels: [] })
    expect(lesButikkTall(utenShopify)).toBeNull()
  })

  it("taaler at product-nivaaet mangler", () => {
    const m = metrics()
    m.channels[0].byType = m.channels[0].byType.filter(
      (t) => t.entity_type !== "product",
    )
    const t = lesButikkTall(m)!
    expect(t.enheter).toBe(0)
    expect(t.omsetning).toBe(154422.4)
  })

  it("taaler at comparison mangler helt", () => {
    const t = lesButikkTall(metrics({ comparison: undefined }))!
    expect(t.delta.omsetning).toBeNull()
    expect(t.delta.snittordre).toBeNull()
    expect(t.omsetning).toBe(154422.4)
  })

  it("gir ikke snittordre-delta naar forrige periode hadde null ordrer", () => {
    const m = metrics()
    m.comparison!.channels.shopify.conversions = {
      abs: 128,
      pct: null,
      dir: "up",
    }
    expect(lesButikkTall(m)!.delta.snittordre).toBeNull()
  })
})

describe("vurderFriskhet", () => {
  const synk = "2026-08-25T04:00:00.000Z"

  it("er live rett etter en synk", () => {
    const f = vurderFriskhet(synk, new Date("2026-08-25T10:00:00Z"))
    expect(f.data_mode).toBe("live")
    expect(f.timer_siden).toBe(6)
  })

  it("er live rett innenfor grensen", () => {
    const naa = new Date(
      new Date(synk).getTime() + (STALE_ETTER_TIMER - 1) * 3_600_000,
    )
    expect(vurderFriskhet(synk, naa).data_mode).toBe("live")
  })

  it("er stale rett utenfor grensen", () => {
    const naa = new Date(
      new Date(synk).getTime() + (STALE_ETTER_TIMER + 1) * 3_600_000,
    )
    expect(vurderFriskhet(synk, naa).data_mode).toBe("stale")
  })

  it("behandler manglende synk som stale, ikke som fersk", () => {
    const f = vurderFriskhet(null, new Date("2026-08-25T10:00:00Z"))
    expect(f.data_mode).toBe("stale")
    expect(f.sist_synket).toBeNull()
  })

  it("behandler ugyldig tidsstempel som stale", () => {
    expect(vurderFriskhet("ikke en dato", new Date()).data_mode).toBe("stale")
  })
})

describe("butikkVindu", () => {
  it("slutter i gaar og dekker noeyaktig N datoer", () => {
    const v = butikkVindu(new Date("2026-09-09T18:30:00Z"), 30)
    expect(v.until).toBe("2026-09-08")
    expect(v.since).toBe("2026-08-10")
    // 10. aug .. 8. sep inklusive = 30 datoer. Den gamle utregningen ga
    // 2026-08-10..2026-09-09 = 31, der den siste dagen aldri var synket.
    const dager = (Date.parse(v.until) - Date.parse(v.since)) / 86_400_000 + 1
    expect(dager).toBe(30)
  })

  it("tar ikke med dagens dato", () => {
    const v = butikkVindu(new Date("2026-09-09T00:10:00Z"), 7)
    expect(v.until).toBe("2026-09-08")
    expect(v.since).toBe("2026-09-02")
  })

  it("krysser maanedsskifte og aarsskifte", () => {
    expect(butikkVindu(new Date("2027-01-01T12:00:00Z"), 3)).toEqual({
      since: "2026-12-29",
      until: "2026-12-31",
    })
  })
})

// Formen er den /api/metrics/shopify i ad-agenten svarer med (shopify-summary.js).
function detalj(overstyr: Partial<ShopifyDetailResponse> = {}): ShopifyDetailResponse {
  return {
    range: { since: "2026-08-16", until: "2026-09-14" },
    lastSync: "2026-09-15T04:01:03Z",
    products: {
      distinct: 3,
      top: [
        { productId: "1", name: "Zeolitt", revenue: 4000, units: 40, days: 20 },
        { productId: "2", name: null, revenue: 100, units: 1, days: 1 },
      ],
    },
    orders: {
      gross: { revenue: 5000, orders: 10 },
      net: { revenue: 4500, orders: 8 },
      excluded: { refunded: 1, voided: 1 },
      partiallyRefunded: 1,
      unknownStatus: 0,
    },
    segments: [
      { segment: "new", orders: 6, revenue: 3000, share: 0.6 },
      { segment: "returning", orders: 4, revenue: 2000, share: 0.4 },
      { segment: "unknown", orders: 0, revenue: 0, share: 0 },
    ],
    ...overstyr,
  }
}

describe("lesProduktTall", () => {
  it("leser ulike produkter, topp, netto og segmenter", () => {
    const t = lesProduktTall(detalj())!
    expect(t.ulikeProdukter).toBe(3)
    expect(t.topp[0]).toEqual({ navn: "Zeolitt", enheter: 40, omsetning: 4000 })
    // Produkt uten navn faar en lesbar etikett, ikke "null".
    expect(t.topp[1].navn).toBe("Produkt 2")
    expect(t.netto).toEqual({ omsetning: 4500, ordrer: 8, utelatt: 2, delvisRefundert: 1 })
    expect(t.kunder.nye).toEqual({ ordrer: 6, andel: 0.6 })
    expect(t.kunder.returnerende.andel).toBe(0.4)
  })

  it("gir null - ikke nuller - naar perioden er tom", () => {
    const tom = detalj({
      products: { distinct: 0, top: [] },
      orders: {
        gross: { revenue: 0, orders: 0 },
        net: { revenue: 0, orders: 0 },
        excluded: { refunded: 0, voided: 0 },
        partiallyRefunded: 0,
        unknownStatus: 0,
      },
    })
    expect(lesProduktTall(tom)).toBeNull()
  })

  it("taaler at et segment mangler i svaret", () => {
    const t = lesProduktTall(detalj({ segments: [] }))!
    expect(t.kunder.nye).toEqual({ ordrer: 0, andel: null })
  })
})

describe("lesLagerTall", () => {
  it("oversetter lagersvaret en-til-en", () => {
    const d: InventoryResponse = {
      fetchedAt: "2026-09-15T12:00:00Z",
      threshold: 5,
      products: 120,
      totalUnits: 3400,
      outOfStock: 2,
      lowStock: 7,
      lowStockItems: [{ id: "a", title: "A", inventory: 0 }],
    }
    expect(lesLagerTall(d)).toEqual({
      hentet: "2026-09-15T12:00:00Z",
      produkter: 120,
      enheter: 3400,
      utsolgt: 2,
      lavt: 7,
      terskel: 5,
      lavtListe: [{ navn: "A", antall: 0 }],
    })
  })
})

describe("ikke-koblet-listen", () => {
  it("er kort, og eierens linje inneholder ingen intern arkitektur", () => {
    expect(IKKE_KOBLET.length).toBe(3)
    // Det eieren ser (navn + status) skal aldri naevne tabeller, endepunkter,
    // feltnavn eller funksjoner. Detaljene ligger bak "Vis detaljer".
    const internt = /channel_metrics|\/api\/|entity_name|raw-feltet|\(\)|financial_status|getProductCatalog/
    for (const rad of IKKE_KOBLET) {
      expect(rad.navn).not.toMatch(internt)
      expect(rad.status).not.toMatch(internt)
      expect(rad.status.length).toBeLessThan(80)
      expect(rad.detaljer.length).toBeGreaterThan(20)
    }
  })

  it("holder de to som krever Adrians beslutning utenfor bygging", () => {
    const beslutning = IKKE_KOBLET.filter((r) => r.krever === "beslutning").map((r) => r.navn)
    expect(beslutning).toEqual(["Konvertering og besøkende", "Siste ordrer"])
  })

  it("lister ikke lenger det som er koblet til", () => {
    const navn = IKKE_KOBLET.map((r) => r.navn)
    for (const koblet of [
      "Topprodukter med navn",
      "Antall ulike produkter solgt",
      "Omsetning uten kansellerte og refunderte ordrer",
      "Lagerstatus og low-stock",
      "Nye vs. returnerende kunder",
    ]) {
      expect(navn).not.toContain(koblet)
    }
  })
})

describe("kildekode-vakt", () => {
  it("/butikk (ButikkDykk) har ingen hardkodede datakonstanter igjen", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const kode = readFileSync(
      resolve(__dirname, "../../app/(ny)/butikk/ButikkDykk.tsx"),
      "utf-8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
    // De fire mock-konstantene som stod her fram til 2026-08-25.
    for (const navn of [
      "STORE_KPIS",
      "TOP_PRODUCTS",
      "LOW_STOCK_ALERTS",
      "RECENT_ORDERS",
    ]) {
      expect(kode).not.toContain(navn)
    }
    // Siden skal hente data, ikke baere dem - fra alle tre kildene.
    expect(kode).toContain("getMetrics")
    expect(kode).toContain("getShopifyDetail")
    expect(kode).toContain("getInventory")
    // Eier-flaten skal ikke forklare seg med intern arkitektur (Orion 15.09).
    // Tooltips og feilhint er tekst eieren leser; ingen av dem faar naevne
    // tabeller eller endepunkter.
    expect(kode).not.toMatch(/channel_metrics|entity_name|\/api\/metrics/)
    // Den nye flatens form: Seksjon/Svar/Hjelp, ikke Tremor-graa kort.
    expect(kode).toContain("Seksjon")
    expect(kode).not.toMatch(/border-gray-200 bg-white/)
    // Vinduet skal komme fra butikkVindu (til og med i gaar), ikke regnes
    // lokalt med subDays - det ga 31 dager med en tom siste dag.
    expect(kode).toContain("butikkVindu")
    expect(kode).not.toContain("subDays")
    // Tooltipen paastod at kansellerte ordrer var utelatt; synken henter
    // status: any. Paastanden skal ikke komme tilbake.
    expect(kode).not.toMatch(/Kansellerte ordrer er ikke med/)
    expect(kode).not.toContain("tall.produkter")
  })
})
