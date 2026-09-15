import type {
  MetricsResponse,
  ChannelMetrics,
  DeltaValue,
  InventoryResponse,
  ShopifyDetailResponse,
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
 * Produkt-, netto- og kundetall fra /api/metrics/shopify (ad-agenten,
 * 2026-09-15). Returnerer null naar svaret ikke har noen ordrer i perioden -
 * kalleren skal si "ingen data", ikke vise nuller.
 */
export type ProduktTall = {
  ulikeProdukter: number
  topp: { navn: string; enheter: number; omsetning: number }[]
  netto: {
    omsetning: number
    ordrer: number
    /** Ordrer holdt utenfor netto: refunderte + annullerte. */
    utelatt: number
    /** Delvis refunderte ordrer - er MED i netto, men flagges. */
    delvisRefundert: number
  }
  kunder: {
    nye: { ordrer: number; andel: number | null }
    returnerende: { ordrer: number; andel: number | null }
    ukjent: { ordrer: number }
  }
}

export function lesProduktTall(d: ShopifyDetailResponse): ProduktTall | null {
  if (d.orders.gross.orders === 0 && d.products.distinct === 0) return null
  const seg = (navn: "new" | "returning" | "unknown") =>
    d.segments.find((s) => s.segment === navn) ?? {
      orders: 0,
      revenue: 0,
      share: null,
    }
  const nye = seg("new")
  const ret = seg("returning")
  const ukj = seg("unknown")
  return {
    ulikeProdukter: d.products.distinct,
    topp: d.products.top.map((p) => ({
      navn: p.name ?? `Produkt ${p.productId}`,
      enheter: p.units,
      omsetning: p.revenue,
    })),
    netto: {
      omsetning: d.orders.net.revenue,
      ordrer: d.orders.net.orders,
      utelatt: d.orders.excluded.refunded + d.orders.excluded.voided,
      delvisRefundert: d.orders.partiallyRefunded,
    },
    kunder: {
      nye: { ordrer: nye.orders, andel: nye.share },
      returnerende: { ordrer: ret.orders, andel: ret.share },
      ukjent: { ordrer: ukj.orders },
    },
  }
}

export type LagerTall = {
  hentet: string
  produkter: number
  enheter: number
  utsolgt: number
  lavt: number
  terskel: number
  lavtListe: { navn: string; antall: number }[]
}

export function lesLagerTall(d: InventoryResponse): LagerTall {
  return {
    hentet: d.fetchedAt,
    produkter: d.products,
    enheter: d.totalUnits,
    utsolgt: d.outOfStock,
    lavt: d.lowStock,
    terskel: d.threshold,
    lavtListe: d.lowStockItems.map((p) => ({
      navn: p.title,
      antall: p.inventory,
    })),
  }
}

/**
 * Det som fortsatt ikke har en kilde. `status` er den ene linja eieren ser;
 * `detaljer` er for utvikleren, bak "Vis detaljer". Fram til 2026-09-15 sto
 * detaljene som broedtekst paa aatte kort, og for Kim og Anniken leste det som
 * en tom side. De fem andre kortene som sto her er naa koblet til.
 */
export const IKKE_KOBLET: {
  navn: string
  status: string
  detaljer: string
  krever: "beslutning" | "bygging"
}[] = [
  {
    navn: "Refusjoner",
    status: "Ikke koblet til ennå.",
    detaljer:
      "Refusjonsbeløp hentes ikke fra Shopify i dag. Krever en ny synk i ad-agenten (refunds per ordre). Netto-tallet over utelater hele refunderte ordrer, men kjenner ikke beløpet på delvise refusjoner.",
    krever: "bygging",
  },
  {
    navn: "Konvertering og besøkende",
    status: "Krever en ny datakilde. Venter på beslutning.",
    detaljer:
      "Ingen analytics-kilde (Shopify Analytics, GA4 eller lignende) er koblet til Detox OS. Ny datakilde krever Adrians ja.",
    krever: "beslutning",
  },
  {
    navn: "Siste ordrer",
    status: "Venter på personvernvurdering.",
    detaljer:
      "Ordrene ligger i ad-agentens rådata, men kundenavn skal ikke vises før det er vurdert hvem som skal se dem og hvorfor. Beslutning hos Adrian.",
    krever: "beslutning",
  },
]
