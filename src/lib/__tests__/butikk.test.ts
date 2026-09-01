import { describe, expect, it } from "vitest"

import {
  IKKE_TILGJENGELIG,
  lesButikkTall,
  STALE_ETTER_TIMER,
  vurderFriskhet,
} from "../butikk"
import type { MetricsResponse } from "../detox-api"

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
          { entity_type: "product", rows: 201, spend: 0, revenue: 173495.4, conversions: 311 },
          { entity_type: "order", rows: 128, spend: 0, revenue: 154422.4, conversions: 128 },
          { entity_type: "customer_segment", rows: 10, spend: 0, revenue: 153926.3, conversions: 127 },
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

  it("leser produkter og enheter fra product-nivaa", () => {
    const t = lesButikkTall(metrics())!
    expect(t.produkter).toBe(201)
    expect(t.enheter).toBe(311)
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
    expect(t.produkter).toBe(0)
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

describe("gjeldslisten", () => {
  it("navngir hvert punkt med en begrunnelse", () => {
    expect(IKKE_TILGJENGELIG.length).toBeGreaterThan(0)
    for (const rad of IKKE_TILGJENGELIG) {
      expect(rad.navn.length).toBeGreaterThan(0)
      expect(rad.hvorfor.length).toBeGreaterThan(20)
    }
  })
})

describe("kildekode-vakt", () => {
  it("/butikk har ingen hardkodede datakonstanter igjen", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const kode = readFileSync(
      resolve(__dirname, "../../app/(main)/butikk/page.tsx"),
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
    // Siden skal hente data, ikke baere dem.
    expect(kode).toContain("getMetrics")
  })
})
