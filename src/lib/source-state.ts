import { NextResponse } from "next/server"

// Delt kontrakt for API-ruter som leser fra en ekstern kilde.
//
// Bakgrunn: fram til 2026-08-25 svarte fire slike ruter 200 OK med oppdiktede
// tall ved enhver feil - manglende token inkludert - og bare en av fire
// konsumenter rendret mock-flagget. Forsiden kunne dermed vise fabrikkert
// omsetning og innboks som om det var dagens virkelighet. Detox OS-byggeloepet
// SS4: "Mock eller seed-data skal aldri presenteres som live virkelighet."
//
// Kontrakten skiller tre tilstander som tidligere ble slaatt sammen til en:
//   live         - kilden svarte, tallene er ekte (ogsaa naar de er null)
//   unavailable  - kilden feilet, vi har ingen tall (502)
//   not configured - vi mangler nokler, kilden ble aldri spurt (503)

export type SourceName = "shopify" | "gmail" | "klaviyo"

export type LiveMeta = {
  source: SourceName
  data_mode: "live"
  generated_at: string
}

export type SourceErrorBody = {
  error: `${SourceName}_not_configured` | `${SourceName}_unavailable`
  message: string
  source: SourceName
  data_mode: "unavailable"
  generated_at: string
}

/**
 * Kastes naar noekler mangler i miljoeet. Skilles fra vanlige feil fordi de to
 * krever ulik oppfoelging: denne er vaar, en oppstroems 500 er deres.
 */
export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotConfiguredError"
  }
}

/** Metadata som merker et vellykket svar som ekte. */
export function liveMeta(source: SourceName): LiveMeta {
  return { source, data_mode: "live", generated_at: new Date().toISOString() }
}

const MELDING: Record<SourceName, { mangler: string; nede: string }> = {
  shopify: {
    mangler: "Shopify-tilkoblingen er ikke konfigurert",
    nede: "Shopify er utilgjengelig akkurat nå",
  },
  gmail: {
    mangler: "Gmail-tilkoblingen er ikke konfigurert",
    nede: "Gmail er utilgjengelig akkurat nå",
  },
  klaviyo: {
    mangler: "Klaviyo-tilkoblingen er ikke konfigurert",
    nede: "Klaviyo er utilgjengelig akkurat nå",
  },
}

/**
 * Bygger et feilsvar uten data. Rå feilmelding fra kilden slippes aldri ut til
 * klienten - den kan inneholde URL-er, tokens eller interne detaljer.
 *
 * 503 = ikke konfigurert (retry hjelper ikke, noen maa sette en noekkel).
 * 502 = kilden er nede (kan gaa over av seg selv).
 */
export function sourceErrorResponse(
  source: SourceName,
  cause: unknown,
): NextResponse<SourceErrorBody> {
  const mangler = cause instanceof NotConfiguredError
  const body: SourceErrorBody = {
    error: mangler ? `${source}_not_configured` : `${source}_unavailable`,
    message: mangler ? MELDING[source].mangler : MELDING[source].nede,
    source,
    data_mode: "unavailable",
    generated_at: new Date().toISOString(),
  }
  return NextResponse.json(body, { status: mangler ? 503 : 502 })
}
