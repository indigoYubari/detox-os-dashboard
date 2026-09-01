import type { MetricsResponse, ChannelMetrics, DeltaValue } from "@/lib/detox-api"

// Rene funksjoner for /butikk. Skilt ut fra siden slik at reglene under kan
// testes uten aa rendre React - saerlig at en manglende kilde aldri stille
// blir til et null-tall.

/**
 * Hvor ferske dataene er. Ad-agenten synker Shopify en gang i doegnet rundt
 * 04:00 UTC, saa noe over ett doegn er normalt; over 36 timer betyr at en
 * synk har hoppet over.
 */
export const STALE_ETTER_TIMER = 36

export type Datafriskhet = {
  data_mode: "live" | "stale"
  sist_synket: string | null
  timer_siden: number | null
}

export function vurderFriskhet(
  lastSync: string | null | undefined,
  naa: Date,
): Datafriskhet {
  if (!lastSync) {
    // Ingen synk registrert er ikke det samme som en fersk synk.
    return { data_mode: "stale", sist_synket: null, timer_siden: null }
  }
  const t = new Date(lastSync).getTime()
  if (Number.isNaN(t)) {
    return { data_mode: "stale", sist_synket: null, timer_siden: null }
  }
  const timer = (naa.getTime() - t) / 3_600_000
  return {
    data_mode: timer > STALE_ETTER_TIMER ? "stale" : "live",
    sist_synket: lastSync,
    timer_siden: Math.max(0, Math.round(timer)),
  }
}

export type ButikkTall = {
  omsetning: number
  ordrer: number
  snittordre: number
  /** Antall distinkte produkter med salg i perioden. */
  produkter: number
  /** Antall solgte enheter i perioden. */
  enheter: number
  delta: {
    omsetning: DeltaValue | null
    ordrer: DeltaValue | null
    snittordre: DeltaValue | null
  }
}

function shopifyKanal(m: MetricsResponse): ChannelMetrics | null {
  return m.channels.find((c) => c.channel === "shopify") ?? null
}

function delta(naa: number, forrige: number): DeltaValue {
  const abs = Number((naa - forrige).toFixed(2))
  const pct = forrige !== 0 ? Number(((abs / forrige) * 100).toFixed(1)) : null
  return { abs, pct, dir: abs > 0 ? "up" : abs < 0 ? "down" : "flat" }
}

/**
 * Plukker Shopify-tallene ut av metrics-svaret. Returnerer null naar kanalen
 * ikke finnes i perioden - kalleren skal si "ingen data", ikke vise nuller.
 *
 * Merk hvilke nivaaer som brukes: omsetning og ordrer leses fra `order`-rader
 * (samme headline-nivaa som ad-agenten selv bruker), mens produkttallene leses
 * fra `product`-rader. De to summerer bevisst ikke likt - en ordre med tre
 * ulike varer gir en order-rad og tre product-rader.
 */
export function lesButikkTall(m: MetricsResponse): ButikkTall | null {
  const shopify = shopifyKanal(m)
  if (!shopify) return null

  const omsetning = shopify.revenue
  const ordrer = shopify.conversions
  const snittordre = ordrer > 0 ? omsetning / ordrer : 0

  const produktRad = shopify.byType.find((t) => t.entity_type === "product")
  const cmp = m.comparison?.channels?.shopify ?? null

  // Forrige periode utledes av deltaene API-et allerede gir, slik at
  // snittordre-endringen regnes paa samme grunnlag som de to andre.
  let snittordreDelta: DeltaValue | null = null
  if (cmp) {
    const forrigeOmsetning = omsetning - cmp.revenue.abs
    const forrigeOrdrer = ordrer - cmp.conversions.abs
    if (forrigeOrdrer > 0) {
      snittordreDelta = delta(snittordre, forrigeOmsetning / forrigeOrdrer)
    }
  }

  return {
    omsetning,
    ordrer,
    snittordre,
    produkter: produktRad?.rows ?? 0,
    enheter: produktRad?.conversions ?? 0,
    delta: {
      omsetning: cmp?.revenue ?? null,
      ordrer: cmp?.conversions ?? null,
      snittordre: snittordreDelta,
    },
  }
}

/**
 * Det den gamle mock-siden viste, som ikke finnes noe sted i dag. Listes
 * eksplisitt i UI-et heller enn aa forsvinne stille - da vet vi hva neste
 * slice faktisk maa laase opp, og ingen tror tallene bare ble borte.
 */
export const IKKE_TILGJENGELIG: { navn: string; hvorfor: string }[] = [
  {
    navn: "Topprodukter med navn",
    hvorfor:
      "channel_metrics har radene, men /api/metrics aggregerer bort entity_name. Krever et per-produkt-endepunkt i ad-agenten.",
  },
  {
    navn: "Lagerstatus og low-stock",
    hvorfor:
      "getProductCatalog() finnes i ad-agenten, men kalles aldri og lagres ingen steder. Lager er en punkt-i-tid-tilstand, ikke en tidsserie.",
  },
  {
    navn: "Refusjoner",
    hvorfor: "Hentes ikke fra Shopify i det hele tatt i dag.",
  },
  {
    navn: "Konvertering og besøkende",
    hvorfor: "Ingen analytics-kilde er koblet til Detox OS.",
  },
  {
    navn: "Siste ordrer",
    hvorfor:
      "Ligger i raw-feltet per ordre, men eksponeres ikke. Krever også en personvernvurdering før kundenavn vises.",
  },
  {
    navn: "Nye vs. returnerende kunder",
    hvorfor:
      "Ad-agenten regner det ut og lagrer det, men /api/metrics slår segmentene sammen til ett tall.",
  },
]
