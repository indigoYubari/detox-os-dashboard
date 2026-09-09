import type {
  MetricsResponse,
  ChannelMetrics,
  DeltaValue,
} from "@/lib/detox-api"

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

/**
 * Datovinduet siden ber om. Ad-agenten synker Shopify per DAG (en jobb rundt
 * 04:00 UTC som henter gaarsdagen), saa dagens dato har aldri tall foer i
 * morgen. Vinduet slutter derfor i gaar og strekker seg `dager` hele dager
 * bakover - `dager` datoer inklusive begge ender. Den foerste versjonen brukte
 * subDays(naa, 30)..naa, som er 31 datoer der den siste alltid var tom.
 */
export function butikkVindu(
  naa: Date,
  dager: number,
): { since: string; until: string } {
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const igaar = new Date(naa.getTime() - 86_400_000)
  const start = new Date(igaar.getTime() - (dager - 1) * 86_400_000)
  return { since: ymd(start), until: ymd(igaar) }
}

export type ButikkTall = {
  omsetning: number
  ordrer: number
  snittordre: number
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
 * (samme headline-nivaa som ad-agenten selv bruker), mens enheter leses fra
 * `product`-rader. De to summerer bevisst ikke likt - en ordre med tre ulike
 * varer gir en order-rad og tre product-rader.
 *
 * `product.rows` brukes IKKE: ad-agenten skriver en product-rad per produkt
 * per synkdag (shopify.service.js: bestsellers(orders) for ett doegn), saa
 * over 30 dager er rows antall produkt-dager, ikke antall ulike produkter.
 * Live 2026-09-09 ga 214 rows for 31 dager - Detox har ikke 214 produkter.
 *
 * Alle ordrer telles uansett status: synken henter `status: 'any'` og
 * filtrerer ikke paa financial_status. Kansellerte og refunderte ordrer er
 * altsaa MED i baade omsetning og antall.
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
    navn: "Antall ulike produkter solgt",
    hvorfor:
      "/api/metrics gir én product-rad per produkt per synkdag, så rows over en periode er produkt-dager, ikke produkter. Krever distinct-telling i ad-agenten.",
  },
  {
    navn: "Omsetning uten kansellerte og refunderte ordrer",
    hvorfor:
      "Synken henter alle ordrestatuser (status: any) og lagrer financial_status bare i raw-feltet. Tallene her er brutto til ad-agenten filtrerer.",
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
