import { NextResponse } from "next/server"

// Delt kontrakt for API-ruter som leser fra en ekstern kilde.
//
// Bakgrunn: fram til 2026-08-25 svarte fire slike ruter 200 OK med oppdiktede
// tall ved enhver feil - manglende token inkludert - og bare en av fire
// konsumenter rendret mock-flagget. Forsiden kunne dermed vise fabrikkert
// omsetning og innboks som om det var dagens virkelighet. Detox OS-byggeloepet
// SS4: "Mock eller seed-data skal aldri presenteres som live virkelighet."
//
// Kontrakten skiller fire tilstander som tidligere ble slaatt sammen til en:
//   live           - kilden svarte, tallene er ekte (ogsaa naar de er null)
//   forbidden      - kilden avviste noekkelen vaar (502): noekkelen finnes, men
//                    mangler rettigheten. Retry hjelper ikke; kontoeieren maa
//                    utvide scopet. Skilles ut 2026-09-15 fordi /status og
//                    /i-dag sto med "Kunne ikke hente" i to uker for en feil
//                    som var kjent og hadde en eier.
//   unavailable    - kilden feilet, vi har ingen tall (502)
//   not configured - vi mangler nokler, kilden ble aldri spurt (503)
//
// Alle feilsvar baerer `code` + `hint`: en kort, eier-lesbar setning UI-et kan
// vise paa en linje. Intern arkitektur (URL-er, scope-navn i teknisk form,
// feltnavn) hoerer hjemme i loggen, ikke i hint.

export type SourceName = "shopify" | "gmail" | "klaviyo"

export type LiveMeta = {
  source: SourceName
  data_mode: "live"
  generated_at: string
}

export type SourceErrorCode =
  | `${SourceName}_not_configured`
  | `${SourceName}_forbidden`
  | `${SourceName}_unavailable`

export type SourceErrorBody = {
  error: SourceErrorCode
  /** Samme som `error`. Finnes slik at alle feilsvar i appen har `code`. */
  code: SourceErrorCode
  message: string
  /** Kort, eier-lesbar forklaring. Alltid satt. */
  hint: string
  source: SourceName
  data_mode: "unavailable"
  generated_at: string
  /** HTTP-status kilden svarte med, naar vi har en. Et tall, aldri innhold. */
  upstream_status?: number
  /**
   * Kildens egen feilbeskrivelse (JSON:API errors[0]: code/title/detail),
   * avkortet. Aldri headere, aldri URL med noekkel - kun det kilden selv
   * sier er galt med forespoerselen.
   */
  upstream_error?: string
}

/**
 * Kastes naar kilden svarte med en HTTP-status vi ikke kan lese noe ut av.
 * Statusen tas med i feilsvaret som `upstream_status`, slik at "utilgjengelig"
 * kan diagnostiseres fra dashboardet uten aa maatte ha kildens noekkel
 * lokalt. Lagt til 2026-09-15 da Klaviyo-502-en viste seg aa IKKE vaere
 * 401/403, og ingen kunne se hva den var.
 */
export class UpstreamStatusError extends Error {
  readonly status: number
  readonly detail: string | null
  constructor(message: string, status: number, detail: string | null = null) {
    super(message)
    this.name = "UpstreamStatusError"
    this.status = status
    this.detail = detail
  }
}

/**
 * Plukker code/title/detail ut av et JSON:API-feilsvar (Klaviyo-formen) og
 * avkorter. Returnerer null hvis kroppen ikke er slik.
 */
export function upstreamErrorSummary(body: unknown, max = 240): string | null {
  const e = (body as { errors?: { code?: unknown; title?: unknown; detail?: unknown }[] } | null)
    ?.errors?.[0]
  if (!e) return null
  const parts = [e.code, e.title, e.detail]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
  if (parts.length === 0) return null
  return parts.join(" · ").slice(0, max)
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

/**
 * Kastes naar kilden svarer 401/403: noekkelen er gyldig men mangler
 * rettigheten. `hint` er det eieren skal lese.
 */
export class ForbiddenError extends Error {
  readonly hint: string
  constructor(message: string, hint: string) {
    super(message)
    this.name = "ForbiddenError"
    this.hint = hint
  }
}

/** Metadata som merker et vellykket svar som ekte. */
export function liveMeta(source: SourceName): LiveMeta {
  return { source, data_mode: "live", generated_at: new Date().toISOString() }
}

const MELDING: Record<
  SourceName,
  { mangler: string; nede: string; hintMangler: string; hintNede: string }
> = {
  shopify: {
    mangler: "Shopify-tilkoblingen er ikke konfigurert",
    nede: "Shopify er utilgjengelig akkurat nå",
    hintMangler: "Shopify er ikke koblet til ennå.",
    hintNede: "Shopify svarte ikke. Prøv igjen om litt.",
  },
  gmail: {
    mangler: "Gmail-tilkoblingen er ikke konfigurert",
    nede: "Gmail er utilgjengelig akkurat nå",
    hintMangler: "Gmail er ikke koblet til ennå.",
    hintNede: "Gmail svarte ikke. Prøv igjen om litt.",
  },
  klaviyo: {
    mangler: "Klaviyo-tilkoblingen er ikke konfigurert",
    nede: "Klaviyo er utilgjengelig akkurat nå",
    hintMangler: "Klaviyo er ikke koblet til ennå.",
    hintNede: "Klaviyo svarte ikke. Prøv igjen om litt.",
  },
}

/**
 * Bygger et feilsvar uten data. Rå feilmelding fra kilden slippes aldri ut til
 * klienten - den kan inneholde URL-er, tokens eller interne detaljer.
 *
 * 503 = ikke konfigurert (retry hjelper ikke, noen maa sette en noekkel).
 * 502 = kilden er nede ELLER avviste oss (forbidden). Begge er "ikke vaar
 *       server", men forbidden har en eier og et hint.
 */
export function sourceErrorResponse(
  source: SourceName,
  cause: unknown,
): NextResponse<SourceErrorBody> {
  const generated_at = new Date().toISOString()
  let body: SourceErrorBody
  let status: number
  if (cause instanceof NotConfiguredError) {
    const code = `${source}_not_configured` as const
    body = {
      error: code,
      code,
      message: MELDING[source].mangler,
      hint: MELDING[source].hintMangler,
      source,
      data_mode: "unavailable",
      generated_at,
    }
    status = 503
  } else if (cause instanceof ForbiddenError) {
    const code = `${source}_forbidden` as const
    body = {
      error: code,
      code,
      message: `${MELDING[source].nede.split(" er ")[0]} avviste tilgangen`,
      hint: cause.hint,
      source,
      data_mode: "unavailable",
      generated_at,
    }
    status = 502
  } else {
    const code = `${source}_unavailable` as const
    body = {
      error: code,
      code,
      message: MELDING[source].nede,
      hint: MELDING[source].hintNede,
      source,
      data_mode: "unavailable",
      generated_at,
    }
    if (cause instanceof UpstreamStatusError) {
      body.upstream_status = cause.status
      if (cause.detail) body.upstream_error = cause.detail
    }
    status = 502
  }
  return NextResponse.json(body, { status })
}
